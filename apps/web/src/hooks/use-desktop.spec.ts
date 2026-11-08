import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDesktop } from './use-desktop';

describe('useDesktop Hook', () => {
  beforeEach(() => {
    delete (window as any).desktopApi;
  });

  it('detects standard web browser mode when desktopApi is absent', async () => {
    const { result } = renderHook(() => useDesktop());
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.platform).toBe('web');
    expect(result.current.config).toBeNull();
    expect(result.current.serverStatus).toBeNull();
    expect(result.current.localIps).toEqual([]);
    expect(result.current.printers).toEqual([]);
    expect(result.current.isLoading).toBe(false);

    // Browser fallbacks for actions
    const saveRes = await result.current.saveConfig({ directPrintEnabled: true });
    expect(saveRes).toBeNull();

    const pingRes = await result.current.testConnection('http://localhost:4000');
    expect(pingRes.ok).toBe(false);

    const printRes = await result.current.printReceipt({ htmlContent: 'test' });
    expect(printRes.success).toBe(false);
  });

  it('detects desktop mode when desktopApi is present in window', async () => {
    const mockConfig = {
      serverMode: 'client' as const,
      serverUrl: 'http://192.168.1.50:4000',
      directPrintEnabled: true,
      isFirstLaunch: false,
    };
    const mockPrinters = [{ name: 'POS-80', displayName: 'POS-80', isDefault: true, status: 0 }];
    const mockStatus = { running: true, port: 4000 };
    const mockIps = ['192.168.1.50'];

    (window as any).desktopApi = {
      isDesktop: true,
      platform: 'win32',
      version: '1.0.0',
      getConfig: vi.fn().mockResolvedValue(mockConfig),
      getPrinters: vi.fn().mockResolvedValue(mockPrinters),
      getServerStatus: vi.fn().mockResolvedValue(mockStatus),
      getLocalIps: vi.fn().mockResolvedValue(mockIps),
      saveConfig: vi.fn().mockImplementation((updates) => Promise.resolve({ ...mockConfig, ...updates })),
      testConnection: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
      startServer: vi.fn().mockResolvedValue({ success: true }),
      stopServer: vi.fn().mockResolvedValue({ success: true }),
      printReceipt: vi.fn().mockResolvedValue({ success: true }),
    };

    const { result } = renderHook(() => useDesktop());
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.platform).toBe('win32');

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.config).toEqual(mockConfig);
      expect(result.current.printers).toEqual(mockPrinters);
      expect(result.current.serverStatus).toEqual(mockStatus);
      expect(result.current.localIps).toEqual(mockIps);
    });

    await act(async () => {
      await result.current.saveConfig({ directPrintEnabled: false });
    });
    expect((window as any).desktopApi.saveConfig).toHaveBeenCalledWith({ directPrintEnabled: false });

    await act(async () => {
      const ping = await result.current.testConnection('http://192.168.1.50:4000');
      expect(ping.ok).toBe(true);
    });

    await act(async () => {
      const printRes = await result.current.printReceipt({ htmlContent: '<p>receipt</p>' });
      expect(printRes.success).toBe(true);
    });
  });
});
