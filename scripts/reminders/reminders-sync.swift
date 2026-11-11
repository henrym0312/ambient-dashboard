import AppKit
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

struct EmailBoxPayload: Codable {
  let total: Int
  let unread: Int
}

struct EmailsPayload: Codable {
  let gmail: EmailBoxPayload
  let uni: EmailBoxPayload
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

func postJSON(url: URL, secret: String, body: Data) -> (ok: Bool, status: Int, response: String) {
  var request = URLRequest(url: url)
  request.httpMethod = "POST"
  request.timeoutInterval = 12
  request.setValue("application/json", forHTTPHeaderField: "Content-Type")
  request.setValue("Bearer \(secret)", forHTTPHeaderField: "Authorization")
  request.httpBody = body

  let sem = DispatchSemaphore(value: 0)
  nonisolated(unsafe) var statusCode = 0
  nonisolated(unsafe) var netError: Error?
  nonisolated(unsafe) var responseBody = ""

  let task = URLSession.shared.dataTask(with: request) { data, response, error in
    netError = error
    if let httpResp = response as? HTTPURLResponse {
      statusCode = httpResp.statusCode
    }
    if let data = data, let text = String(data: data, encoding: .utf8) {
      responseBody = text
    }
    sem.signal()
  }
  task.resume()
  sem.wait()

  if let netError = netError {
    return (false, statusCode, netError.localizedDescription)
  }
  return ((200...299).contains(statusCode), statusCode, responseBody)
}

func fetchAppleMailCountsIfRunning() -> EmailsPayload? {
  // Only query Mail if Mail.app is already running so we never pop open Mail.app when closed
  let isMailRunning = NSWorkspace.shared.runningApplications.contains {
    $0.bundleIdentifier == "com.apple.mail"
  }
  guard isMailRunning else { return nil }

  let scriptSource = """
    tell application "Mail"
      set gTot to count of messages of mailbox "INBOX" of account "Henry - Gmail"
      set gUnr to unread count of mailbox "INBOX" of account "Henry - Gmail"
      set globalTot to count of messages of inbox
      set globalUnr to unread count of inbox
      set uTot to globalTot - gTot
      set uUnr to globalUnr - gUnr
      if uTot < 0 then set uTot to 0
      if uUnr < 0 then set uUnr to 0
      return (gTot as string) & "," & (gUnr as string) & "," & (uTot as string) & "," & (uUnr as string)
    end tell
    """

  let proc = Process()
  proc.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
  proc.arguments = ["-e", scriptSource]
  let outPipe = Pipe()
  proc.standardOutput = outPipe
  proc.standardError = Pipe()

  do {
    try proc.run()
  } catch {
    return nil
  }

  // Enforce a 4-second timeout so osascript can never hang the daemon
  let deadline = Date().addingTimeInterval(4.0)
  while proc.isRunning && Date() < deadline {
    Thread.sleep(forTimeInterval: 0.05)
  }
  if proc.isRunning {
    proc.terminate()
    return nil
  }

  guard proc.terminationStatus == 0 else { return nil }
  let outData = outPipe.fileHandleForReading.readDataToEndOfFile()
  guard
    let raw = String(data: outData, encoding: .utf8)?.trimmingCharacters(
      in: .whitespacesAndNewlines
    )
  else {
    return nil
  }

  let parts = raw.split(separator: ",").compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }
  guard parts.count == 4 else { return nil }

  return EmailsPayload(
    gmail: EmailBoxPayload(total: parts[0], unread: parts[1]),
    uni: EmailBoxPayload(total: parts[2], unread: parts[3])
  )
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

// 1. Fetch Incomplete Reminders natively via EventKit (~15ms)
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
  fputs(
    "Error: \(errMsg). Grant Reminders access in System Settings > Privacy & Security > Reminders.\n",
    stderr
  )
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
guard let remindersJson = try? encoder.encode(payloads) else {
  fputs("Error: Failed to encode reminders payload\n", stderr)
  exit(1)
}

if isDryRun {
  if let prettyStr = String(data: remindersJson, encoding: .utf8) {
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

var baseUrl = rawUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
if baseUrl.hasSuffix("/api/reminders") {
  baseUrl = String(baseUrl.dropLast("/api/reminders".count))
}

let cacheDir = "\(homeDir)/.cache/ambient-dashboard"
try? FileManager.default.createDirectory(
  atPath: cacheDir,
  withIntermediateDirectories: true,
  attributes: nil
)
let nowEpoch = Date().timeIntervalSince1970

// 2. Push Reminders if changed (or every 30m heartbeat)
if let remUrl = URL(string: "\(baseUrl)/api/reminders") {
  let remHash = sha256Hex(remindersJson)
  let remStateFile = "\(cacheDir)/reminders-state.json"
  var shouldPushReminders = true

  if !isForce,
    let stateData = try? Data(contentsOf: URL(fileURLWithPath: remStateFile)),
    let prevState = try? JSONDecoder().decode(SyncState.self, from: stateData),
    prevState.sha256 == remHash && (nowEpoch - prevState.pushedAt) < 1800
  {
    shouldPushReminders = false
  }

  if shouldPushReminders {
    let res = postJSON(url: remUrl, secret: cronSecret, body: remindersJson)
    if res.ok {
      let newState = SyncState(sha256: remHash, pushedAt: nowEpoch)
      if let encoded = try? JSONEncoder().encode(newState) {
        try? encoded.write(to: URL(fileURLWithPath: remStateFile))
      }
      print("Synced \(payloads.count) active reminders -> \(remUrl.absoluteString)")
    } else {
      fputs("Error pushing reminders: HTTP \(res.status) - \(res.response)\n", stderr)
    }
  }
}

// 3. Push Apple Mail counts if Mail.app is running and counts changed
if let emailsPayload = fetchAppleMailCountsIfRunning(),
  let emailsJson = try? encoder.encode(emailsPayload),
  let emailUrl = URL(string: "\(baseUrl)/api/emails")
{
  let emailHash = sha256Hex(emailsJson)
  let emailStateFile = "\(cacheDir)/emails-state.json"
  var shouldPushEmails = true

  if !isForce,
    let stateData = try? Data(contentsOf: URL(fileURLWithPath: emailStateFile)),
    let prevState = try? JSONDecoder().decode(SyncState.self, from: stateData),
    prevState.sha256 == emailHash && (nowEpoch - prevState.pushedAt) < 1800
  {
    shouldPushEmails = false
  }

  if shouldPushEmails {
    let res = postJSON(url: emailUrl, secret: cronSecret, body: emailsJson)
    if res.ok {
      let newState = SyncState(sha256: emailHash, pushedAt: nowEpoch)
      if let encoded = try? JSONEncoder().encode(newState) {
        try? encoded.write(to: URL(fileURLWithPath: emailStateFile))
      }
      print(
        "Synced emails (Gmail: \(emailsPayload.gmail.unread)/\(emailsPayload.gmail.total), Uni: \(emailsPayload.uni.unread)/\(emailsPayload.uni.total)) -> \(emailUrl.absoluteString)"
      )
    } else {
      fputs("Error pushing emails: HTTP \(res.status) - \(res.response)\n", stderr)
    }
  }
}
