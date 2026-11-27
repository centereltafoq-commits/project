import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testServerConnection } from './network-utils';

describe('Network Utilities', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('testServerConnection', () => {
    it('returns ok: true with 200 when endpoint is reachable', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = mockFetch;

      const result = await testServerConnection('http://192.168.1.50:4000');
      expect(result.ok).toBe(true);
      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.50:4000/api/settings',
        expect.objectContaining({
          method: 'GET',
          headers: { Accept: 'application/json' },
        })
      );
    });

    it('returns ok: true with 401 when endpoint responds with unauthorized (still valid server)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });
      global.fetch = mockFetch;

      const result = await testServerConnection('http://192.168.1.50:4000/');
      expect(result.ok).toBe(true);
      expect(result.status).toBe(401);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://192.168.1.50:4000/api/settings',
        expect.any(Object)
      );
    });

    it('returns ok: false when endpoint returns server error (e.g. 500)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });
      global.fetch = mockFetch;

      const result = await testServerConnection('http://192.168.1.50:4000');
      expect(result.ok).toBe(false);
      expect(result.status).toBe(500);
      expect(result.error).toBe('HTTP 500');
    });

    it('handles connection timeout or abort gracefully', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      global.fetch = vi.fn().mockRejectedValue(abortError);

      const result = await testServerConnection('http://192.168.1.99:4000', 100);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('انتهت مهلة الاتصال بالسيرفر');
    });

    it('handles network errors gracefully (e.g. ECONNREFUSED)', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 192.168.1.99:4000'));

      const result = await testServerConnection('http://192.168.1.99:4000');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('ECONNREFUSED');
    });
  });
});
