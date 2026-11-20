import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn(),
  },
  ipcRenderer: {
    invoke: vi.fn(),
  },
}));

import { DESKTOP_CHANNELS } from './desktop-api.types';
import { createDesktopApi } from './index';

describe('Desktop Preload API Channels', () => {
  it('defines explicit whitelisted IPC channels', () => {
    expect(DESKTOP_CHANNELS.GET_CONFIG).toBe('desktop:get-config');
    expect(DESKTOP_CHANNELS.SAVE_CONFIG).toBe('desktop:save-config');
    expect(DESKTOP_CHANNELS.TEST_CONNECTION).toBe('desktop:test-connection');
    expect(DESKTOP_CHANNELS.GET_LOCAL_IPS).toBe('desktop:get-local-ips');
    expect(DESKTOP_CHANNELS.GET_SERVER_STATUS).toBe('desktop:get-server-status');
    expect(DESKTOP_CHANNELS.START_SERVER).toBe('desktop:start-server');
    expect(DESKTOP_CHANNELS.STOP_SERVER).toBe('desktop:stop-server');
    expect(DESKTOP_CHANNELS.GET_PRINTERS).toBe('desktop:get-printers');
    expect(DESKTOP_CHANNELS.PRINT_RECEIPT).toBe('desktop:print-receipt');
  });
});

describe('createDesktopApi Bridge', () => {
  let mockIpcRenderer: { invoke: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockIpcRenderer = {
      invoke: vi.fn(),
    };
  });

  it('exposes desktop metadata properties', () => {
    const api = createDesktopApi(mockIpcRenderer as any);
    expect(api.isDesktop).toBe(true);
    expect(api.platform).toBe(process.platform);
    expect(api.version).toBe('1.0.0');
  });

  it('delegates getConfig to DESKTOP_CHANNELS.GET_CONFIG', async () => {
    mockIpcRenderer.invoke.mockResolvedValueOnce({ serverMode: 'client' });
    const api = createDesktopApi(mockIpcRenderer as any);

    const config = await api.getConfig();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(DESKTOP_CHANNELS.GET_CONFIG);
    expect(config).toEqual({ serverMode: 'client' });
  });

  it('delegates saveConfig to DESKTOP_CHANNELS.SAVE_CONFIG with params', async () => {
    mockIpcRenderer.invoke.mockResolvedValueOnce({ serverMode: 'server' });
    const api = createDesktopApi(mockIpcRenderer as any);

    const update = { serverMode: 'server' as const };
    const res = await api.saveConfig(update);
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(DESKTOP_CHANNELS.SAVE_CONFIG, update);
    expect(res).toEqual({ serverMode: 'server' });
  });

  it('delegates testConnection to DESKTOP_CHANNELS.TEST_CONNECTION with url', async () => {
    mockIpcRenderer.invoke.mockResolvedValueOnce({ ok: true });
    const api = createDesktopApi(mockIpcRenderer as any);

    const res = await api.testConnection('http://192.168.1.10:4000');
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(DESKTOP_CHANNELS.TEST_CONNECTION, 'http://192.168.1.10:4000');
    expect(res.ok).toBe(true);
  });

  it('delegates getLocalIps to DESKTOP_CHANNELS.GET_LOCAL_IPS', async () => {
    mockIpcRenderer.invoke.mockResolvedValueOnce(['192.168.1.5']);
    const api = createDesktopApi(mockIpcRenderer as any);

    const ips = await api.getLocalIps();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(DESKTOP_CHANNELS.GET_LOCAL_IPS);
    expect(ips).toEqual(['192.168.1.5']);
  });

  it('delegates getServerStatus to DESKTOP_CHANNELS.GET_SERVER_STATUS', async () => {
    mockIpcRenderer.invoke.mockResolvedValueOnce({ running: true, port: 4000 });
    const api = createDesktopApi(mockIpcRenderer as any);

    const status = await api.getServerStatus();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(DESKTOP_CHANNELS.GET_SERVER_STATUS);
    expect(status.running).toBe(true);
  });

  it('delegates startServer to DESKTOP_CHANNELS.START_SERVER', async () => {
    mockIpcRenderer.invoke.mockResolvedValueOnce({ success: true });
    const api = createDesktopApi(mockIpcRenderer as any);

    const res = await api.startServer();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(DESKTOP_CHANNELS.START_SERVER);
    expect(res.success).toBe(true);
  });

  it('delegates stopServer to DESKTOP_CHANNELS.STOP_SERVER', async () => {
    mockIpcRenderer.invoke.mockResolvedValueOnce({ success: true });
    const api = createDesktopApi(mockIpcRenderer as any);

    const res = await api.stopServer();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(DESKTOP_CHANNELS.STOP_SERVER);
    expect(res.success).toBe(true);
  });

  it('delegates getPrinters to DESKTOP_CHANNELS.GET_PRINTERS', async () => {
    mockIpcRenderer.invoke.mockResolvedValueOnce([{ name: 'POS-80', isDefault: true }]);
    const api = createDesktopApi(mockIpcRenderer as any);

    const printers = await api.getPrinters();
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(DESKTOP_CHANNELS.GET_PRINTERS);
    expect(printers).toHaveLength(1);
    expect(printers[0].name).toBe('POS-80');
  });

  it('delegates printReceipt to DESKTOP_CHANNELS.PRINT_RECEIPT with options', async () => {
    mockIpcRenderer.invoke.mockResolvedValueOnce({ success: true });
    const api = createDesktopApi(mockIpcRenderer as any);

    const opts = { htmlContent: '<div>receipt</div>' };
    const res = await api.printReceipt(opts);
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(DESKTOP_CHANNELS.PRINT_RECEIPT, opts);
    expect(res.success).toBe(true);
  });

  it('delegates openWhatsApp to DESKTOP_CHANNELS.OPEN_WHATSAPP with url', async () => {
    mockIpcRenderer.invoke.mockResolvedValueOnce({ success: true });
    const api = createDesktopApi(mockIpcRenderer as any);

    const url = 'https://web.whatsapp.com/send?phone=201012345678';
    const res = await api.openWhatsApp?.(url);
    expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(DESKTOP_CHANNELS.OPEN_WHATSAPP, url);
    expect(res?.success).toBe(true);
  });
});
