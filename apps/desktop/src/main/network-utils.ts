/**
 * Tests connection to the local server by pinging its /api/settings endpoint.
 *
 * @param baseUrl Base URL of the local backend server (e.g. http://localhost:4000)
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
