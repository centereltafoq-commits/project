import * as os from 'os';

/**
 * Scans local network interfaces and returns all active non-internal IPv4 addresses.
 * Falls back to ['127.0.0.1'] if no active LAN interface is detected.
 *
 * @param interfaces Optional network interface dictionary (defaults to os.networkInterfaces())
 */
export function getLocalNetworkIps(
  interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = os.networkInterfaces()
): string[] {
  const validIps: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (!ifaceList) continue;

    for (const iface of ifaceList) {
      // Filter out internal/loopback and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        validIps.push(iface.address);
      }
    }
  }

  return validIps.length > 0 ? validIps : ['127.0.0.1'];
}

/**
 * Tests connection to the target server by pinging its /api/settings endpoint.
 *
 * @param baseUrl Base URL of the backend server (e.g. http://192.168.1.50:4000)
 * @param timeoutMs Timeout in milliseconds (default: 4000ms)
 * @returns Status of connection: ok (true for 200/401), HTTP status code, or error description
 */
export async function testServerConnection(
  baseUrl: string,
  timeoutMs = 4000
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const pingEndpoint = `${cleanUrl}/api/settings`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(pingEndpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (response.ok || response.status === 200 || response.status === 401) {
        return { ok: true, status: response.status };
      }

      return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'انتهت مهلة الاتصال بالسيرفر (Timeout)' };
    }
    return { ok: false, error: err.message || 'تعذر الوصول إلى خادم السنتر' };
  }
}
