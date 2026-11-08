import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => {
  const listeners: Record<string, Function[]> = {};
  return {
    app: {
      requestSingleInstanceLock: vi.fn().mockReturnValue(true),
      quit: vi.fn(),
      on: vi.fn().mockImplementation((event: string, callback: Function) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
      }),
      whenReady: vi.fn().mockReturnValue(Promise.resolve()),
      _emit: (event: string, ...args: any[]) => {
        const handlers = listeners[event] || [];
        for (const h of handlers) h(...args);
      },
    },
    BrowserWindow: vi.fn().mockImplementation(function (options: any) {
      const windowListeners: Record<string, Function[]> = {};
      return {
        options,
        show: vi.fn(),
        isMinimized: vi.fn().mockReturnValue(false),
        restore: vi.fn(),
        focus: vi.fn(),
        isDestroyed: vi.fn().mockReturnValue(false),
        getBounds: vi.fn().mockReturnValue({ width: 1280, height: 850, x: 10, y: 10 }),
        loadURL: vi.fn().mockResolvedValue(undefined),
        webContents: { id: 'test-webContents' },
        on: vi.fn().mockImplementation((evt: string, cb: Function) => {
          if (!windowListeners[evt]) windowListeners[evt] = [];
          windowListeners[evt].push(cb);
        }),
        once: vi.fn().mockImplementation((evt: string, cb: Function) => {
          if (!windowListeners[evt]) windowListeners[evt] = [];
          windowListeners[evt].push(cb);
        }),
        _emit: (evt: string, ...args: any[]) => {
          const handlers = windowListeners[evt] || [];
          for (const h of handlers) h(...args);
        },
      };
    }),
    ipcMain: {
      handle: vi.fn(),
      removeHandler: vi.fn(),
    },
  };
});

import { app, BrowserWindow } from 'electron';
import { createMainWindow, loadAppContent, setupApp, AppContext } from './index';

describe('Electron Main Process (index.ts)', () => {
  let mockContext: AppContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      storeManager: {
        getConfig: vi.fn().mockReturnValue({
          serverMode: 'client',
          serverUrl: 'http://localhost:4000',
          directPrintEnabled: true,
          windowBounds: { width: 1280, height: 850, x: 20, y: 20 },
        }),
        saveConfig: vi.fn(),
      } as any,
      serverManager: {
        getStatus: vi.fn().mockReturnValue({ running: false, port: 4000 }),
        start: vi.fn().mockResolvedValue({ success: true }),
        stop: vi.fn().mockResolvedValue({ success: true }),
      } as any,
      printerManager: {
        getInstalledPrinters: vi.fn().mockResolvedValue([]),
        printReceiptSilent: vi.fn().mockResolvedValue({ success: true }),
      } as any,
      mainWindow: null,
    };
  });

  describe('createMainWindow', () => {
    it('creates BrowserWindow with security preferences (contextIsolation, no nodeIntegration, sandbox)', async () => {
      const window = await createMainWindow(mockContext, {
        testConnectionFn: vi.fn().mockResolvedValue({ ok: true }),
      });

      expect(BrowserWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 1280,
          height: 850,
          webPreferences: expect.objectContaining({
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          }),
        }),
      );
      expect(window).toBeDefined();
    });

    it('listens for resize, move, and close to persist window bounds', async () => {
      const window: any = await createMainWindow(mockContext, {
        testConnectionFn: vi.fn().mockResolvedValue({ ok: true }),
      });

      expect(window.on).toHaveBeenCalledWith('resize', expect.any(Function));
      expect(window.on).toHaveBeenCalledWith('move', expect.any(Function));
      expect(window.on).toHaveBeenCalledWith('close', expect.any(Function));

      // Trigger resize
      window._emit('resize');
      expect(mockContext.storeManager.saveConfig).toHaveBeenCalledWith({
        windowBounds: { width: 1280, height: 850, x: 10, y: 10 },
      });
    });
  });

  describe('loadAppContent', () => {
    it('in Server Mode: starts server if not running and loads server URL', async () => {
      mockContext.storeManager.getConfig = vi.fn().mockReturnValue({
        serverMode: 'server',
        serverUrl: 'http://localhost:4000',
      });
      mockContext.serverManager.getStatus = vi.fn().mockReturnValue({ running: false });

      const mockWindow = {
        loadURL: vi.fn().mockResolvedValue(undefined),
      } as any;

      const mockTestConn = vi.fn().mockResolvedValue({ ok: true });

      await loadAppContent(mockWindow, mockContext, { testConnectionFn: mockTestConn });

      expect(mockContext.serverManager.start).toHaveBeenCalled();
      expect(mockWindow.loadURL).toHaveBeenCalledWith('http://localhost:4000');
    });

    it('in Client Mode: tests connection and loads serverUrl when reachable', async () => {
      mockContext.storeManager.getConfig = vi.fn().mockReturnValue({
        serverMode: 'client',
        serverUrl: 'http://192.168.1.100:4000',
      });

      const mockWindow = {
        loadURL: vi.fn().mockResolvedValue(undefined),
      } as any;

      const mockTestConn = vi.fn().mockResolvedValue({ ok: true });

      await loadAppContent(mockWindow, mockContext, { testConnectionFn: mockTestConn });

      expect(mockTestConn).toHaveBeenCalledWith('http://192.168.1.100:4000', expect.any(Number));
      expect(mockWindow.loadURL).toHaveBeenCalledWith('http://192.168.1.100:4000');
    });

    it('in Client Mode: displays setup fallback screen when server is unreachable', async () => {
      mockContext.storeManager.getConfig = vi.fn().mockReturnValue({
        serverMode: 'client',
        serverUrl: 'http://192.168.1.100:4000',
      });

      const mockWindow = {
        loadURL: vi.fn().mockResolvedValue(undefined),
      } as any;

      const mockTestConn = vi.fn().mockResolvedValue({ ok: false, error: 'ECONNREFUSED' });

      await loadAppContent(mockWindow, mockContext, { testConnectionFn: mockTestConn });

      expect(mockWindow.loadURL).toHaveBeenCalledWith(
        expect.stringContaining('data:text/html'),
      );
    });
  });

  describe('setupApp lifecycle', () => {
    it('quits when single instance lock is not acquired', () => {
      (app.requestSingleInstanceLock as any).mockReturnValueOnce(false);

      setupApp(mockContext);
      expect(app.quit).toHaveBeenCalled();
    });

    it('terminates local server on before-quit event', async () => {
      (app.requestSingleInstanceLock as any).mockReturnValueOnce(true);

      setupApp(mockContext);

      // Trigger before-quit
      (app as any)._emit('before-quit');
      expect(mockContext.serverManager.stop).toHaveBeenCalled();
    });
  });
});
