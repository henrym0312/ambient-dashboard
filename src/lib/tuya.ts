import crypto from 'crypto';

interface TuyaStatusItem {
  code: string;
  value: boolean | number | string;
}

export interface TuyaDevicesState {
  fan: boolean | null;
  lamp: boolean | null;
  error?: string | null;
  updatedAt?: string;
}

// In-memory token cache to prevent requesting a new token on every poll
let cachedToken: {
  token: string;
  expiresAt: number;
} | null = null;

function getSignContent(body?: Record<string, unknown> | null) {
  const stringBody = body && Object.keys(body).length > 0 ? JSON.stringify(body) : '';
  return crypto.createHash('sha256').update(stringBody).digest('hex');
}

function calculateSign({
  clientId,
  secretKey,
  timestamp,
  accessToken = '',
  method,
  urlPath,
  body,
}: {
  clientId: string;
  secretKey: string;
  timestamp: string;
  accessToken?: string;
  method: string;
  urlPath: string;
  body?: Record<string, unknown> | null;
}) {
  const contentHash = getSignContent(body);
  const headersStr = '';

  const stringToSign = [method.toUpperCase(), contentHash, headersStr, urlPath].join('\n');

  let signingStr = clientId + timestamp + stringToSign;
  if (accessToken) {
    signingStr = clientId + accessToken + timestamp + stringToSign;
  }

  return crypto
    .createHmac('sha256', secretKey)
    .update(signingStr, 'utf8')
    .digest('hex')
    .toUpperCase();
}

async function fetchAccessToken(
  clientId: string,
  secretKey: string,
  host: string
): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60000) {
    return cachedToken.token;
  }

  const method = 'GET';
  const urlPath = '/v1.0/token?grant_type=1';
  const timestamp = now.toString();

  const sign = calculateSign({
    clientId,
    secretKey,
    timestamp,
    method,
    urlPath,
  });

  const headers = {
    client_id: clientId,
    t: timestamp,
    sign_method: 'HMAC-SHA256',
    sign,
  };

  try {
    const res = await fetch(`${host}${urlPath}`, {
      method,
      headers,
      cache: 'no-store',
    });
    const data = await res.json();
    if (data.success && data.result?.access_token) {
      cachedToken = {
        token: data.result.access_token,
        expiresAt: now + (data.result.expire_time ?? 7200) * 1000,
      };
      return data.result.access_token;
    }
    return null;
  } catch (err) {
    console.error('Failed to fetch Tuya access token:', err);
    return null;
  }
}

async function fetchDeviceState(
  clientId: string,
  secretKey: string,
  host: string,
  token: string,
  deviceId: string
): Promise<{ state: boolean | null; error?: string }> {
  const method = 'GET';
  const urlPath = `/v1.0/devices/${deviceId}/status`;
  const timestamp = Date.now().toString();

  const sign = calculateSign({
    clientId,
    secretKey,
    timestamp,
    accessToken: token,
    method,
    urlPath,
  });

  const headers = {
    client_id: clientId,
    access_token: token,
    t: timestamp,
    sign_method: 'HMAC-SHA256',
    sign,
  };

  try {
    const res = await fetch(`${host}${urlPath}`, {
      method,
      headers,
      cache: 'no-store',
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.result)) {
      const switchItem = data.result.find(
        (item: TuyaStatusItem) =>
          item.code === 'switch_1' || item.code === 'switch' || item.code.startsWith('switch')
      );
      if (switchItem && typeof switchItem.value === 'boolean') {
        return { state: switchItem.value };
      }
      return { state: null };
    }
    return { state: null, error: data.msg || `Tuya error code ${data.code}` };
  } catch (err: unknown) {
    return { state: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getTuyaDevices(): Promise<TuyaDevicesState> {
  const clientId = process.env.TUYA_CLIENT_ID || 'dgpagf3kwwgpwxhkgjy4';
  const secretKey = process.env.TUYA_SECRET_KEY || '42cd3037778d48f8abf7b97d14bc5cf8';
  const fanDeviceId = process.env.TUYA_FAN_DEVICE_ID || 'bfdf661c3db5909ad4eokx';
  const lampDeviceId = process.env.TUYA_LAMP_DEVICE_ID || 'bfcadb0a2b913a58cfxhq4';
  const host = process.env.TUYA_HOST || 'https://openapi.tuyaeu.com';

  if (!clientId || !secretKey || (!fanDeviceId && !lampDeviceId)) {
    return { fan: null, lamp: null, error: 'Tuya credentials not configured' };
  }

  const token = await fetchAccessToken(clientId, secretKey, host);
  if (!token) {
    return { fan: null, lamp: null, error: 'Failed to authenticate with Tuya Cloud' };
  }

  const [fanResult, lampResult] = await Promise.all([
    fanDeviceId
      ? fetchDeviceState(clientId, secretKey, host, token, fanDeviceId)
      : Promise.resolve({ state: null, error: undefined }),
    lampDeviceId
      ? fetchDeviceState(clientId, secretKey, host, token, lampDeviceId)
      : Promise.resolve({ state: null, error: undefined }),
  ]);

  return {
    fan: fanResult.state,
    lamp: lampResult.state,
    error: fanResult.error || lampResult.error || null,
    updatedAt: new Date().toISOString(),
  };
}
