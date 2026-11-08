import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DESKTOP_CHANNELS } from '../preload/desktop-api.types';
import { registerIpcHandlers } from './ipc-handlers';

describe('registerIpcHandlers', () => {
  let registeredHandlers: Map<string, Function>;
  let mockIpcMain: {
    handle: ReturnType<typeof vi.fn>;
    removeHandler: ReturnType<typeof vi.fn>;
  };
  let mockStoreManager: any;
  let mockServerManager: any;
  let mockPrinterManager: any;
  let mockNetworkUtils: any;
  let mockWebContentsGetter: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    registeredHandlers = new Map();

    mockIpcMain = {
      handle: vi.fn().mockImplementation((channel: string, handler: Function) => {
        registeredHandlers.set(channel, handler);
      }),
      removeHandler: vi.fn().mockImplementation((channel: string) => {
        registeredHandlers.delete(channel);
      }),
    };

    mockStoreManager = {
      getConfig: vi.fn().mockReturnValue({
        serverMode: 'client',
        serverUrl: 'http://localhost:4000',
        directPrintEnabled: true,
        defaultThermalPrinter: 'POS-Default',
        isFirstLaunch: false,
        windowBounds: { width: 1280, height: 850 },
      }),
      saveConfig: vi.fn().mockImplementation((updates) => ({
        serverMode: updates.serverMode || 'client',
        serverUrl: updates.serverUrl || 'http://localhost:4000',
        directPrintEnabled: updates.directPrintEnabled ?? true,
        defaultThermalPrinter: updates.defaultThermalPrinter || 'POS-Default',
        isFirstLaunch: false,
        windowBounds: updates.windowBounds || { width: 1280, height: 850 },
      })),
    };

    mockServerManager = {
      getStatus: vi.fn().mockReturnValue({
        running: true,
        pid: 1234,
        port: 4000,
        uptime: 120,
      }),
      start: vi.fn().mockResolvedValue({ success: true }),
      stop: vi.fn().mockResolvedValue({ success: true }),
    };

    mockPrinterManager = {
      getInstalledPrinters: vi.fn().mockResolvedValue([
        { name: 'POS-80', isDefault: true, status: 0 },
      ]),
      printReceiptSilent: vi.fn().mockResolvedValue({ success: true }),
    };

    mockNetworkUtils = {
      getLocalNetworkIps: vi.fn().mockReturnValue(['192.168.1.50']),
      testServerConnection: vi.fn().mockResolvedValue({ ok: true, status: 200 }),
    };

    mockWebContentsGetter = vi.fn().mockReturnValue({ id: 'webContentsMock' });
  });

  it('registers handlers for all DESKTOP_CHANNELS and returns an unregister cleanup function', () => {
    const unregister = registerIpcHandlers({
      ipcMain: mockIpcMain as any,
      storeManager: mockStoreManager,
      serverManager: mockServerManager,
      printerManager: mockPrinterManager,
      webContentsGetter: mockWebContentsGetter,
      networkUtils: mockNetworkUtils,
    });

    for (const channel of Object.values(DESKTOP_CHANNELS)) {
      expect(mockIpcMain.handle).toHaveBeenCalledWith(channel, expect.any(Function));
      expect(registeredHandlers.has(channel)).toBe(true);
    }

    unregister();
    for (const channel of Object.values(DESKTOP_CHANNELS)) {
      expect(mockIpcMain.removeHandler).toHaveBeenCalledWith(channel);
    }
  });

  describe('GET_CONFIG channel', () => {
    it('returns config from storeManager', async () => {
      registerIpcHandlers({
        ipcMain: mockIpcMain as any,
        storeManager: mockStoreManager,
        serverManager: mockServerManager,
        printerManager: mockPrinterManager,
        webContentsGetter: mockWebContentsGetter,
        networkUtils: mockNetworkUtils,
      });

      const handler = registeredHandlers.get(DESKTOP_CHANNELS.GET_CONFIG)!;
      const result = await handler({} as any);

      expect(mockStoreManager.getConfig).toHaveBeenCalled();
      expect(result.serverMode).toBe('client');
      expect(result.serverUrl).toBe('http://localhost:4000');
    });
  });

  describe('SAVE_CONFIG channel', () => {
    it('sanitizes inputs and saves config', async () => {
      registerIpcHandlers({
        ipcMain: mockIpcMain as any,
        storeManager: mockStoreManager,
        serverManager: mockServerManager,
        printerManager: mockPrinterManager,
        webContentsGetter: mockWebContentsGetter,
        networkUtils: mockNetworkUtils,
      });

      const handler = registeredHandlers.get(DESKTOP_CHANNELS.SAVE_CONFIG)!;
      const result = await handler({} as any, {
        serverMode: 'server',
        serverUrl: 'http://192.168.1.100:4000/',
        defaultThermalPrinter: 'POS-80-USB',
        directPrintEnabled: true,
        windowBounds: { width: 1400, height: 900, x: 50, y: 50 },
      });

      expect(mockStoreManager.saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          serverMode: 'server',
          serverUrl: 'http://192.168.1.100:4000',
          defaultThermalPrinter: 'POS-80-USB',
          directPrintEnabled: true,
        }),
      );
      expect(result.serverMode).toBe('server');
    });

    it('ignores invalid serverMode and invalid URL schemes', async () => {
      registerIpcHandlers({
        ipcMain: mockIpcMain as any,
        storeManager: mockStoreManager,
        serverManager: mockServerManager,
        printerManager: mockPrinterManager,
        webContentsGetter: mockWebContentsGetter,
        networkUtils: mockNetworkUtils,
      });

      const handler = registeredHandlers.get(DESKTOP_CHANNELS.SAVE_CONFIG)!;
      await handler({} as any, {
        serverMode: 'invalid-mode',
        serverUrl: 'javascript:alert(1)',
      });

      expect(mockStoreManager.saveConfig).toHaveBeenCalledWith({});
    });
  });

  describe('TEST_CONNECTION channel', () => {
    it('validates URL and calls testServerConnection', async () => {
      registerIpcHandlers({
        ipcMain: mockIpcMain as any,
        storeManager: mockStoreManager,
        serverManager: mockServerManager,
        printerManager: mockPrinterManager,
        webContentsGetter: mockWebContentsGetter,
        networkUtils: mockNetworkUtils,
      });

      const handler = registeredHandlers.get(DESKTOP_CHANNELS.TEST_CONNECTION)!;
      const res = await handler({} as any, 'http://192.168.1.50:4000');

      expect(mockNetworkUtils.testServerConnection).toHaveBeenCalledWith('http://192.168.1.50:4000');
      expect(res.ok).toBe(true);
    });

    it('rejects invalid or non-http URLs with descriptive error', async () => {
      registerIpcHandlers({
        ipcMain: mockIpcMain as any,
        storeManager: mockStoreManager,
        serverManager: mockServerManager,
        printerManager: mockPrinterManager,
        webContentsGetter: mockWebContentsGetter,
        networkUtils: mockNetworkUtils,
      });

      const handler = registeredHandlers.get(DESKTOP_CHANNELS.TEST_CONNECTION)!;
      const res = await handler({} as any, 'ftp://invalid-url');

      expect(mockNetworkUtils.testServerConnection).not.toHaveBeenCalled();
      expect(res.ok).toBe(false);
      expect(res.error).toBeDefined();
    });
  });

  describe('GET_LOCAL_IPS channel', () => {
    it('delegates to networkUtils.getLocalNetworkIps', async () => {
      registerIpcHandlers({
        ipcMain: mockIpcMain as any,
        storeManager: mockStoreManager,
        serverManager: mockServerManager,
        printerManager: mockPrinterManager,
        webContentsGetter: mockWebContentsGetter,
        networkUtils: mockNetworkUtils,
      });

      const handler = registeredHandlers.get(DESKTOP_CHANNELS.GET_LOCAL_IPS)!;
      const ips = await handler({} as any);

      expect(mockNetworkUtils.getLocalNetworkIps).toHaveBeenCalled();
      expect(ips).toEqual(['192.168.1.50']);
    });
  });

  describe('Server management channels', () => {
    it('GET_SERVER_STATUS delegates to serverManager.getStatus', async () => {
      registerIpcHandlers({
        ipcMain: mockIpcMain as any,
        storeManager: mockStoreManager,
        serverManager: mockServerManager,
        printerManager: mockPrinterManager,
        webContentsGetter: mockWebContentsGetter,
        networkUtils: mockNetworkUtils,
      });

      const handler = registeredHandlers.get(DESKTOP_CHANNELS.GET_SERVER_STATUS)!;
      const status = await handler({} as any);

      expect(mockServerManager.getStatus).toHaveBeenCalled();
      expect(status.running).toBe(true);
    });

    it('START_SERVER delegates to serverManager.start', async () => {
      registerIpcHandlers({
        ipcMain: mockIpcMain as any,
        storeManager: mockStoreManager,
        serverManager: mockServerManager,
        printerManager: mockPrinterManager,
        webContentsGetter: mockWebContentsGetter,
        networkUtils: mockNetworkUtils,
      });

      const handler = registeredHandlers.get(DESKTOP_CHANNELS.START_SERVER)!;
      const res = await handler({} as any);

      expect(mockServerManager.start).toHaveBeenCalled();
      expect(res.success).toBe(true);
    });

    it('STOP_SERVER delegates to serverManager.stop', async () => {
      registerIpcHandlers({
        ipcMain: mockIpcMain as any,
        storeManager: mockStoreManager,
        serverManager: mockServerManager,
        printerManager: mockPrinterManager,
        webContentsGetter: mockWebContentsGetter,
        networkUtils: mockNetworkUtils,
      });

      const handler = registeredHandlers.get(DESKTOP_CHANNELS.STOP_SERVER)!;
      const res = await handler({} as any);

      expect(mockServerManager.stop).toHaveBeenCalled();
      expect(res.success).toBe(true);
    });
  });

  describe('Printer management channels', () => {
    it('GET_PRINTERS retrieves webContents from getter and calls getInstalledPrinters', async () => {
      registerIpcHandlers({
        ipcMain: mockIpcMain as any,
        storeManager: mockStoreManager,
        serverManager: mockServerManager,
        printerManager: mockPrinterManager,
        webContentsGetter: mockWebContentsGetter,
        networkUtils: mockNetworkUtils,
      });

      const handler = registeredHandlers.get(DESKTOP_CHANNELS.GET_PRINTERS)!;
      const printers = await handler({} as any);

      expect(mockWebContentsGetter).toHaveBeenCalled();
      expect(mockPrinterManager.getInstalledPrinters).toHaveBeenCalledWith({ id: 'webContentsMock' });
      expect(printers).toHaveLength(1);
    });

    it('PRINT_RECEIPT delegates with specified printerName and htmlContent', async () => {
      registerIpcHandlers({
        ipcMain: mockIpcMain as any,
        storeManager: mockStoreManager,
        serverManager: mockServerManager,
        printerManager: mockPrinterManager,
        webContentsGetter: mockWebContentsGetter,
        networkUtils: mockNetworkUtils,
      });

      const handler = registeredHandlers.get(DESKTOP_CHANNELS.PRINT_RECEIPT)!;
      const res = await handler({} as any, {
        printerName: 'Custom-Thermal',
        htmlContent: '<div>receipt</div>',
      });

      expect(mockPrinterManager.printReceiptSilent).toHaveBeenCalledWith(
        expect.objectContaining({
          printerName: 'Custom-Thermal',
          htmlContent: '<div>receipt</div>',
        }),
      );
      expect(res.success).toBe(true);
    });

    it('PRINT_RECEIPT falls back to defaultThermalPrinter from store if printerName is not provided', async () => {
      registerIpcHandlers({
        ipcMain: mockIpcMain as any,
        storeManager: mockStoreManager,
        serverManager: mockServerManager,
        printerManager: mockPrinterManager,
        webContentsGetter: mockWebContentsGetter,
        networkUtils: mockNetworkUtils,
      });

      const handler = registeredHandlers.get(DESKTOP_CHANNELS.PRINT_RECEIPT)!;
      await handler({} as any, {
        htmlContent: '<div>receipt</div>',
      });

      expect(mockPrinterManager.printReceiptSilent).toHaveBeenCalledWith(
        expect.objectContaining({
          printerName: 'POS-Default',
          htmlContent: '<div>receipt</div>',
        }),
      );
    });

    it('PRINT_RECEIPT rejects empty htmlContent', async () => {
      registerIpcHandlers({
        ipcMain: mockIpcMain as any,
        storeManager: mockStoreManager,
        serverManager: mockServerManager,
        printerManager: mockPrinterManager,
        webContentsGetter: mockWebContentsGetter,
        networkUtils: mockNetworkUtils,
      });

      const handler = registeredHandlers.get(DESKTOP_CHANNELS.PRINT_RECEIPT)!;
      const res = await handler({} as any, {
        htmlContent: '   ',
      });

      expect(mockPrinterManager.printReceiptSilent).not.toHaveBeenCalled();
      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();
    });
  });
});
