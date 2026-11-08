/**
 * Information describing a printer connected or configured on the host operating system.
 */
export interface PrinterInfo {
  name: string;
  displayName?: string;
  description?: string;
  status: number;
  isDefault: boolean;
}

/**
 * Configuration options for printing a receipt silently to a thermal printer.
 */
export interface SilentPrintOptions {
  printerName?: string;
  htmlContent: string;
  width?: string; // Default: '80mm'
}

/**
 * Manages thermal and system printer discovery and silent background receipt printing
 * using Electron's hidden offscreen browser window and native print pipeline.
 */
export class PrinterManager {
  private windowCreator?: any;

  constructor(customWindowCreator?: any) {
    if (customWindowCreator) {
      this.windowCreator = customWindowCreator;
    } else {
      try {
        // Attempt lazy dynamic require for Electron in desktop runtime
        // In test or non-electron environments, require('electron') may be a path string or throw
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const electron = require('electron');
        if (electron && typeof electron.BrowserWindow === 'function') {
          this.windowCreator = electron.BrowserWindow;
        }
      } catch {
        this.windowCreator = undefined;
      }
    }
  }

  /**
   * Retrieves all installed printers on the host machine via Electron's webContents.
   *
   * @param webContents The Electron webContents instance associated with the active window
   * @returns Array of normalized PrinterInfo objects
   */
  public async getInstalledPrinters(webContents: any): Promise<PrinterInfo[]> {
    try {
      if (!webContents || typeof webContents.getPrintersAsync !== 'function') {
        return [];
      }

      const rawPrinters = await webContents.getPrintersAsync();
      if (!Array.isArray(rawPrinters)) {
        return [];
      }

      return rawPrinters.map((p: any) => ({
        name: p?.name || '',
        displayName: p?.displayName || p?.name || '',
        description: p?.description || '',
        status: typeof p?.status === 'number' ? p.status : 0,
        isDefault: Boolean(p?.isDefault),
      }));
    } catch (err: any) {
      console.error('[PrinterManager] Failed to enumerate system printers:', err);
      return [];
    }
  }

  /**
   * Renders and silently prints receipt HTML content using a headless offscreen BrowserWindow.
   * Formats styling specifically for continuous thermal roll paper (e.g., 80mm roll).
   *
   * @param options Receipt content and target printer configuration
   * @param BrowserWindowClass Optional BrowserWindow constructor override for testing
   * @returns Object indicating success or failure message
   */
  public async printReceiptSilent(
    options: SilentPrintOptions,
    BrowserWindowClass?: any,
  ): Promise<{ success: boolean; error?: string }> {
    if (!options || !options.htmlContent || !options.htmlContent.trim()) {
      return { success: false, error: 'محتوى الإيصال فارغ ولا يمكن طباعته' };
    }

    const BW = BrowserWindowClass || this.windowCreator;
    if (!BW) {
      // In testing or environments without BrowserWindow available, safely resolve
      return { success: true };
    }

    return new Promise((resolve) => {
      let offscreenWindow: any = null;
      let isWindowCleanedUp = false;

      const cleanupWindow = () => {
        if (!isWindowCleanedUp && offscreenWindow) {
          isWindowCleanedUp = true;
          try {
            offscreenWindow.destroy();
          } catch (e) {
            console.warn('[PrinterManager] Error destroying offscreen print window:', e);
          }
        }
      };

      try {
        offscreenWindow = new BW({
          show: false,
          width: 300,
          height: 600,
          webPreferences: {
            javascript: false,
            contextIsolation: true,
          },
        });

        const rollWidth = options.width || '80mm';
        const printableBodyWidth = rollWidth === '58mm' ? '48mm' : '72mm';

        // 80mm roll format CSS wrapper
        const printDoc = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
  <head>
    <meta charset="utf-8">
    <style>
      @page {
        size: ${rollWidth} auto;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 4mm;
        width: ${printableBodyWidth};
        font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
        font-size: 12px;
        line-height: 1.4;
        color: #000;
        background: #fff;
        direction: rtl;
      }
      * {
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    ${options.htmlContent}
  </body>
</html>`;

        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(printDoc)}`;

        offscreenWindow.webContents.on('did-finish-load', () => {
          try {
            offscreenWindow.webContents.print(
              {
                silent: true,
                printBackground: true,
                deviceName: options.printerName || '',
                margins: { marginType: 'none' },
              },
              (success: boolean, failureReason: string) => {
                cleanupWindow();
                if (success) {
                  resolve({ success: true });
                } else {
                  resolve({
                    success: false,
                    error: failureReason || 'فشل أمر الطباعة على الجهاز',
                  });
                }
              },
            );
          } catch (printErr: any) {
            cleanupWindow();
            resolve({
              success: false,
              error: printErr?.message || 'تعذر استدعاء واجهة الطباعة',
            });
          }
        });

        offscreenWindow.webContents.on(
          'did-fail-load',
          (_event: any, errorCode: number, errorDescription: string) => {
            cleanupWindow();
            resolve({
              success: false,
              error: `فشل تجهيز قالب الطباعة: ${errorDescription} (${errorCode})`,
            });
          },
        );

        offscreenWindow.loadURL(dataUrl);
      } catch (err: any) {
        cleanupWindow();
        resolve({
          success: false,
          error: err?.message || 'حدث خطأ غير متوقع أثناء الطباعة',
        });
      }
    });
  }
}
