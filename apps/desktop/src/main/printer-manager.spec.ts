import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrinterManager, PrinterInfo, SilentPrintOptions } from './printer-manager';

class MockWebContents {
  private listeners: Record<string, Function[]> = {};
  public print = vi.fn();

  public on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  public emit(event: string, ...args: any[]) {
    const handlers = this.listeners[event] || [];
    for (const h of handlers) {
      h(...args);
    }
  }
}

class MockBrowserWindow {
  public static lastCreatedInstance: MockBrowserWindow | null = null;
  public options: any;
  public webContents: MockWebContents;
  public destroyed = false;
  public loadedUrl = '';

  constructor(options: any) {
    this.options = options;
    this.webContents = new MockWebContents();
    MockBrowserWindow.lastCreatedInstance = this;
  }

  public loadURL(url: string) {
    this.loadedUrl = url;
  }

  public destroy() {
    this.destroyed = true;
  }
}

describe('PrinterManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockBrowserWindow.lastCreatedInstance = null;
  });

  describe('getInstalledPrinters', () => {
    it('enumerates and maps printers correctly from webContents', async () => {
      const mockWebContents = {
        getPrintersAsync: vi.fn().mockResolvedValue([
          {
            name: 'POS-80-Thermal',
            displayName: 'POS 80mm Receipt Printer',
            description: 'Direct Thermal Driver',
            status: 0,
            isDefault: true,
          },
          {
            name: 'Microsoft Print to PDF',
            displayName: 'Microsoft Print to PDF',
            description: 'Virtual PDF Writer',
            status: 0,
            isDefault: false,
          },
        ]),
      };

      const pm = new PrinterManager();
      const printers = await pm.getInstalledPrinters(mockWebContents as any);

      expect(printers).toHaveLength(2);
      expect(printers[0]).toEqual({
        name: 'POS-80-Thermal',
        displayName: 'POS 80mm Receipt Printer',
        description: 'Direct Thermal Driver',
        status: 0,
        isDefault: true,
      });
      expect(printers[1]).toEqual({
        name: 'Microsoft Print to PDF',
        displayName: 'Microsoft Print to PDF',
        description: 'Virtual PDF Writer',
        status: 0,
        isDefault: false,
      });
    });

    it('returns empty array when webContents is null or undefined', async () => {
      const pm = new PrinterManager();
      const resNull = await pm.getInstalledPrinters(null);
      const resUndef = await pm.getInstalledPrinters(undefined);

      expect(resNull).toEqual([]);
      expect(resUndef).toEqual([]);
    });

    it('returns empty array when webContents lacks getPrintersAsync method', async () => {
      const pm = new PrinterManager();
      const res = await pm.getInstalledPrinters({} as any);

      expect(res).toEqual([]);
    });

    it('handles getPrintersAsync rejection gracefully without throwing', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockWebContents = {
        getPrintersAsync: vi.fn().mockRejectedValue(new Error('Driver communication failure')),
      };

      const pm = new PrinterManager();
      const printers = await pm.getInstalledPrinters(mockWebContents as any);

      expect(printers).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('handles non-array response from getPrintersAsync safely', async () => {
      const mockWebContents = {
        getPrintersAsync: vi.fn().mockResolvedValue(null),
      };

      const pm = new PrinterManager();
      const printers = await pm.getInstalledPrinters(mockWebContents as any);

      expect(printers).toEqual([]);
    });
  });

  describe('printReceiptSilent', () => {
    it('rejects empty or whitespace-only htmlContent with an error message', async () => {
      const pm = new PrinterManager();

      const emptyRes = await pm.printReceiptSilent({ htmlContent: '' });
      expect(emptyRes.success).toBe(false);
      expect(emptyRes.error).toContain('محتوى الإيصال فارغ');

      const whitespaceRes = await pm.printReceiptSilent({ htmlContent: '   \n\t  ' });
      expect(whitespaceRes.success).toBe(false);
      expect(whitespaceRes.error).toContain('محتوى الإيصال فارغ');
    });

    it('resolves success: true when no BrowserWindow class is available in runtime or options', async () => {
      const pm = new PrinterManager(null);
      const res = await pm.printReceiptSilent({
        htmlContent: '<div><h1>Receipt #1001</h1></div>',
      });

      expect(res.success).toBe(true);
    });

    it('creates offscreen hidden BrowserWindow with secure webPreferences and loads formatted data URL', async () => {
      const pm = new PrinterManager(MockBrowserWindow);

      const printPromise = pm.printReceiptSilent({
        printerName: 'POS-80C',
        htmlContent: '<div class="receipt">Total: $120</div>',
      });

      const win = MockBrowserWindow.lastCreatedInstance!;
      expect(win).not.toBeNull();
      expect(win.options.show).toBe(false);
      expect(win.options.width).toBe(300);
      expect(win.options.height).toBe(600);
      expect(win.options.webPreferences).toEqual({
        javascript: false,
        contextIsolation: true,
      });

      expect(win.loadedUrl).toContain('data:text/html;charset=utf-8,');
      const decodedHtml = decodeURIComponent(win.loadedUrl);
      expect(decodedHtml).toContain('80mm auto');
      expect(decodedHtml).toContain('direction: rtl');
      expect(decodedHtml).toContain('<div class="receipt">Total: $120</div>');

      // Complete print callback to clean up promise
      win.webContents.print.mockImplementation((_opts, cb) => cb(true, ''));
      win.webContents.emit('did-finish-load');

      const result = await printPromise;
      expect(result.success).toBe(true);
      expect(win.destroyed).toBe(true);
    });

    it('triggers silent print with deviceName and margins: { marginType: none } on did-finish-load', async () => {
      const pm = new PrinterManager(MockBrowserWindow);

      const printPromise = pm.printReceiptSilent({
        printerName: 'Thermal-XP-80',
        htmlContent: '<p>Student Receipt</p>',
      });

      const win = MockBrowserWindow.lastCreatedInstance!;
      win.webContents.print.mockImplementation((options, callback) => {
        expect(options).toEqual({
          silent: true,
          printBackground: true,
          deviceName: 'Thermal-XP-80',
          margins: { marginType: 'none' },
        });
        callback(true, '');
      });

      win.webContents.emit('did-finish-load');

      const result = await printPromise;
      expect(result.success).toBe(true);
      expect(win.destroyed).toBe(true);
    });

    it('destroys offscreen window and returns failure when printer print callback reports failure', async () => {
      const pm = new PrinterManager(MockBrowserWindow);

      const printPromise = pm.printReceiptSilent({
        printerName: 'Thermal-XP-80',
        htmlContent: '<p>Receipt</p>',
      });

      const win = MockBrowserWindow.lastCreatedInstance!;
      win.webContents.print.mockImplementation((_options, callback) => {
        callback(false, 'Printer out of paper');
      });

      win.webContents.emit('did-finish-load');

      const result = await printPromise;
      expect(result.success).toBe(false);
      expect(result.error).toBe('Printer out of paper');
      expect(win.destroyed).toBe(true);
    });

    it('destroys offscreen window and returns failure when did-fail-load fires', async () => {
      const pm = new PrinterManager(MockBrowserWindow);

      const printPromise = pm.printReceiptSilent({
        printerName: 'Thermal-XP-80',
        htmlContent: '<p>Receipt</p>',
      });

      const win = MockBrowserWindow.lastCreatedInstance!;
      win.webContents.emit('did-fail-load', {}, -105, 'ERR_NAME_NOT_RESOLVED');

      const result = await printPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('ERR_NAME_NOT_RESOLVED');
      expect(result.error).toContain('-105');
      expect(win.destroyed).toBe(true);
    });

    it('handles unexpected exceptions during window creation and destroys window if instantiated', async () => {
      class FaultyBrowserWindow extends MockBrowserWindow {
        constructor(opts: any) {
          super(opts);
          throw new Error('Fatal GPU initialization error');
        }
      }

      const pm = new PrinterManager(FaultyBrowserWindow);
      const result = await pm.printReceiptSilent({
        htmlContent: '<p>Receipt</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Fatal GPU initialization error');
    });

    it('supports custom roll width like 58mm', async () => {
      const pm = new PrinterManager(MockBrowserWindow);

      const printPromise = pm.printReceiptSilent({
        printerName: 'POS-58',
        htmlContent: '<p>Small receipt</p>',
        width: '58mm',
      });

      const win = MockBrowserWindow.lastCreatedInstance!;
      const decodedHtml = decodeURIComponent(win.loadedUrl);
      expect(decodedHtml).toContain('58mm auto');
      expect(decodedHtml).toContain('width: 48mm');

      win.webContents.print.mockImplementation((_opts, cb) => cb(true, ''));
      win.webContents.emit('did-finish-load');

      const result = await printPromise;
      expect(result.success).toBe(true);
      expect(win.destroyed).toBe(true);
    });
  });
});
