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
import {
  createMainWindow,
  getServerRecoveryFallbackHtml,
  getStartupSplashHtml,
  loadAppContent,
  setupApp,
  AppContext,
} from './index';

describe('Electron Main Process (index.ts)', () => {
  let mockContext: AppContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      storeManager: {
        getConfig: vi.fn().mockReturnValue({
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

    it('loads the Arabic startup splash screen and shows the window immediately before connecting', async () => {
      const window: any = await createMainWindow(mockContext, {
        testConnectionFn: vi.fn().mockResolvedValue({ ok: true }),
      });

      const splashUrl = getStartupSplashHtml();
      expect(decodeURIComponent(splashUrl)).toContain('جاري تشغيل النظام وتجهيز قاعدة البيانات');
      expect(window.show).toHaveBeenCalled();
      expect(window.loadURL.mock.calls[0][0]).toBe(splashUrl);
      expect(window.loadURL.mock.calls[1][0]).toBe('http://localhost:4000');
    });
  });

  describe('loadAppContent', () => {
    it('starts local server if not running and loads http://localhost:4000', async () => {
      mockContext.storeManager.getConfig = vi.fn().mockReturnValue({
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

    it('overrides stale LAN client serverUrl back to localhost:4000 and boots locally', async () => {
      mockContext.storeManager.getConfig = vi.fn().mockReturnValue({
        serverUrl: 'http://192.168.1.100:4000',
      });
      mockContext.serverManager.getStatus = vi.fn().mockReturnValue({ running: false });

      const mockWindow = {
        loadURL: vi.fn().mockResolvedValue(undefined),
      } as any;

      const mockTestConn = vi.fn().mockResolvedValue({ ok: true });

      await loadAppContent(mockWindow, mockContext, { testConnectionFn: mockTestConn });

      expect(mockContext.storeManager.saveConfig).toHaveBeenCalledWith({
        serverUrl: 'http://localhost:4000',
      });
      expect(mockContext.serverManager.start).toHaveBeenCalled();
      expect(mockWindow.loadURL).toHaveBeenCalledWith('http://localhost:4000');
    });

    it('displays local server recovery fallback screen when local server fails to start', async () => {
      mockContext.storeManager.getConfig = vi.fn().mockReturnValue({
        serverUrl: 'http://localhost:4000',
      });
      mockContext.serverManager.start = vi
        .fn()
        .mockResolvedValue({ success: false, error: 'PostgreSQL failed' });

      const mockWindow = {
        loadURL: vi.fn().mockResolvedValue(undefined),
      } as any;

      await loadAppContent(mockWindow, mockContext, { testConnectionFn: vi.fn() });

      expect(mockWindow.loadURL).toHaveBeenCalledWith(
        expect.stringContaining('data:text/html'),
      );
      const html = decodeURIComponent(
        mockWindow.loadURL.mock.calls[0][0].replace('data:text/html;charset=utf-8,', ''),
      );
      expect(html).toContain('إعادة تشغيل السيرفر المحلي');
      expect(html).not.toContain('إعداد الاتصال بشبكة السنتر');
      expect(html).not.toContain('البحث التلقائي عن سيرفر السنتر');
    });

    it('recovery fallback page navigates to localhost:4000 without LAN inputs', () => {
      const encoded = getServerRecoveryFallbackHtml('http://localhost:4000', 'Process exited with code 1');
      const html = decodeURIComponent(encoded.replace('data:text/html;charset=utf-8,', ''));

      expect(html).toContain('تعذر تشغيل الخادم المحلي');
      expect(html).toContain('window.location.href = targetUrl');
      expect(html).not.toContain('window.location.reload()');
      expect(html).not.toContain('discoverLan');
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
      (app.whenReady as any).mockReturnValueOnce(new Promise(() => {}));

      setupApp(mockContext);

      // Trigger before-quit
      (app as any)._emit('before-quit');
      expect(mockContext.serverManager.stop).toHaveBeenCalled();
    });
  });
});
