import CryptoKit
import EventKit
import Foundation

struct ReminderPayload: Codable {
  let id: String
  let title: String
  let dueDate: String?
  let hasTime: Bool
  let priority: Int
  let list: String
  let notes: String?
}

struct SyncState: Codable {
  let sha256: String
  let pushedAt: TimeInterval
}

func loadDotEnv(at path: String) -> [String: String] {
  var result: [String: String] = [:]
  guard let content = try? String(contentsOfFile: path, encoding: .utf8) else {
    return result
  }
  for rawLine in content.components(separatedBy: .newlines) {
    let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
    if line.isEmpty || line.hasPrefix("#") { continue }
    let parts = line.split(separator: "=", maxSplits: 1)
    guard parts.count == 2 else { continue }
    let key = String(parts[0]).trimmingCharacters(in: .whitespaces)
    var val = String(parts[1]).trimmingCharacters(in: .whitespaces)
    if (val.hasPrefix("\"") && val.hasSuffix("\"")) || (val.hasPrefix("'") && val.hasSuffix("'")) {
      val = String(val.dropFirst().dropLast())
    }
    result[key] = val
  }
  return result
}

func sha256Hex(_ data: Data) -> String {
  let digest = SHA256.hash(data: data)
  return digest.map { String(format: "%02x", $0) }.joined()
}

let args = Set(CommandLine.arguments.dropFirst())
let isDryRun = args.contains("--dry-run")
let isForce = args.contains("--force")

let homeDir = FileManager.default.homeDirectoryForCurrentUser.path
let configFile = "\(homeDir)/.config/ambient-dashboard/reminders.env"
let fileEnv = loadDotEnv(at: configFile)
let procEnv = ProcessInfo.processInfo.environment

let rawUrl =
  procEnv["DASHBOARD_API_URL"]
  ?? procEnv["DASHBOARD_URL"]
  ?? fileEnv["DASHBOARD_API_URL"]
  ?? fileEnv["DASHBOARD_URL"]
  ?? ""

let cronSecret = procEnv["CRON_SECRET"] ?? fileEnv["CRON_SECRET"] ?? ""

let store = EKEventStore()
let accessSemaphore = DispatchSemaphore(value: 0)
nonisolated(unsafe) var accessGranted = false
nonisolated(unsafe) var accessError: Error?

if #available(macOS 14.0, *) {
  store.requestFullAccessToReminders { granted, err in
    accessGranted = granted
    accessError = err
    accessSemaphore.signal()
  }
} else {
  store.requestAccess(to: .reminder) { granted, err in
    accessGranted = granted
    accessError = err
    accessSemaphore.signal()
  }
}
accessSemaphore.wait()

guard accessGranted else {
  let errMsg = accessError?.localizedDescription ?? "Reminders permission denied"
  fputs("Error: \(errMsg). Grant Reminders access in System Settings > Privacy & Security > Reminders.\n", stderr)
  exit(1)
}

let fetchSemaphore = DispatchSemaphore(value: 0)
let predicate = store.predicateForIncompleteReminders(
  withDueDateStarting: nil,
  ending: nil,
  calendars: nil
)

nonisolated(unsafe) var fetchedReminders: [EKReminder] = []
store.fetchReminders(matching: predicate) { reminders in
  fetchedReminders = reminders ?? []
  fetchSemaphore.signal()
}
fetchSemaphore.wait()

let isoFormatter = ISO8601DateFormatter()
isoFormatter.formatOptions = [.withInternetDateTime]

var calendar = Calendar(identifier: .gregorian)
calendar.timeZone = TimeZone(identifier: "Europe/London") ?? .current

var payloads: [ReminderPayload] = fetchedReminders.compactMap { rem in
  let rawTitle = (rem.title ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
  guard !rawTitle.isEmpty, !rem.isCompleted else { return nil }

  var dueIso: String? = nil
  var hasTime = false

  if let comps = rem.dueDateComponents {
    hasTime = comps.hour != nil
    if let date = calendar.date(from: comps) {
      dueIso = isoFormatter.string(from: date)
    }
  }

  let notesTrimmed: String? = {
    guard let n = rem.notes?.trimmingCharacters(in: .whitespacesAndNewlines), !n.isEmpty else {
      return nil
    }
    return String(n.prefix(280))
  }()

  return ReminderPayload(
    id: rem.calendarItemIdentifier,
    title: rawTitle,
    dueDate: dueIso,
    hasTime: hasTime,
    priority: rem.priority,
    list: rem.calendar?.title ?? "Task",
    notes: notesTrimmed
  )
}

payloads.sort { a, b in
  if a.id != b.id { return a.id < b.id }
  return a.title < b.title
}

let encoder = JSONEncoder()
encoder.outputFormatting = [.sortedKeys]
guard let jsonData = try? encoder.encode(payloads) else {
  fputs("Error: Failed to encode reminders payload\n", stderr)
  exit(1)
}

if isDryRun {
  if let prettyStr = String(data: jsonData, encoding: .utf8) {
    print(prettyStr)
  }
  exit(0)
}

guard !rawUrl.isEmpty, !cronSecret.isEmpty else {
  fputs(
    "Error: Missing DASHBOARD_API_URL or CRON_SECRET. Configure ~/.config/ambient-dashboard/reminders.env or run scripts/reminders/install-sync.sh\n",
    stderr
  )
  exit(1)
}

let endpointStr: String = {
  let trimmed = rawUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
  if trimmed.hasSuffix("/api/reminders") {
    return trimmed
  }
  return "\(trimmed)/api/reminders"
}()

guard let endpointUrl = URL(string: endpointStr) else {
  fputs("Error: Invalid endpoint URL \(endpointStr)\n", stderr)
  exit(1)
}

let currentHash = sha256Hex(jsonData)
let cacheDir = "\(homeDir)/.cache/ambient-dashboard"
let stateFile = "\(cacheDir)/reminders-state.json"
let nowEpoch = Date().timeIntervalSince1970

if !isForce,
  let stateData = try? Data(contentsOf: URL(fileURLWithPath: stateFile)),
  let prevState = try? JSONDecoder().decode(SyncState.self, from: stateData)
{
  // Skip redundant push if payload hasn't changed and we pushed within the last 30 minutes
  if prevState.sha256 == currentHash && (nowEpoch - prevState.pushedAt) < 1800 {
    exit(0)
  }
}

var request = URLRequest(url: endpointUrl)
request.httpMethod = "POST"
request.timeoutInterval = 12
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
request.setValue("Bearer \(cronSecret)", forHTTPHeaderField: "Authorization")
request.httpBody = jsonData

let netSemaphore = DispatchSemaphore(value: 0)
nonisolated(unsafe) var statusCode = 0
nonisolated(unsafe) var netError: Error?
nonisolated(unsafe) var responseBody = ""

let task = URLSession.shared.dataTask(with: request) { data, response, error in
  netError = error
  if let httpResp = response as? HTTPURLResponse {
    statusCode = httpResp.statusCode
  }
  if let data = data, let body = String(data: data, encoding: .utf8) {
    responseBody = body
  }
  netSemaphore.signal()
}
task.resume()
netSemaphore.wait()

if let netError = netError {
  fputs("Error pushing reminders: \(netError.localizedDescription)\n", stderr)
  exit(1)
}

guard (200...299).contains(statusCode) else {
  fputs("Error pushing reminders: HTTP \(statusCode) - \(responseBody)\n", stderr)
  exit(1)
}

try? FileManager.default.createDirectory(
  atPath: cacheDir,
  withIntermediateDirectories: true,
  attributes: nil
)
let newState = SyncState(sha256: currentHash, pushedAt: nowEpoch)
if let encodedState = try? JSONEncoder().encode(newState) {
  try? encodedState.write(to: URL(fileURLWithPath: stateFile))
}

print("Synced \(payloads.count) active reminders -> \(endpointStr)")
