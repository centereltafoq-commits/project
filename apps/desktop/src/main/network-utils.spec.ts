import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'os';
import { getLocalNetworkIps, testServerConnection } from './network-utils';

describe('Network Utilities', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getLocalNetworkIps', () => {
    it('returns valid IPv4 addresses excluding loopback and internal', () => {
      const ips = getLocalNetworkIps();
      expect(Array.isArray(ips)).toBe(true);
      expect(ips.length).toBeGreaterThan(0);
      for (const ip of ips) {
        expect(ip).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
      }
    });

    it('falls back to 127.0.0.1 if no external IPv4 interfaces exist', () => {
      const mockInterfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = {
        lo: [
          {
            address: '127.0.0.1',
            netmask: '255.0.0.0',
            family: 'IPv4',
            mac: '00:00:00:00:00:00',
            internal: true,
            cidr: '127.0.0.1/8',
          },
        ],
        eth0: [
          {
            address: 'fe80::1',
            netmask: 'ffff:ffff:ffff:ffff::',
            family: 'IPv6',
            mac: '00:00:00:00:00:00',
            internal: false,
            cidr: 'fe80::1/64',
            scopeid: 1,
          },
        ],
      };

      const ips = getLocalNetworkIps(mockInterfaces);
      expect(ips).toEqual(['127.0.0.1']);
    });

    it('collects all active non-internal IPv4 interfaces', () => {
      const mockInterfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]> = {
        eth0: [
          {
            address: '192.168.1.50',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: 'aa:bb:cc:dd:ee:01',
            internal: false,
            cidr: '192.168.1.50/24',
          },
        ],
        wlan0: [
          {
            address: '10.0.0.12',
            netmask: '255.255.255.0',
            family: 'IPv4',
            mac: 'aa:bb:cc:dd:ee:02',
            internal: false,
            cidr: '10.0.0.12/24',
          },
        ],
      };

      const ips = getLocalNetworkIps(mockInterfaces);
      expect(ips).toEqual(['192.168.1.50', '10.0.0.12']);
    });
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
