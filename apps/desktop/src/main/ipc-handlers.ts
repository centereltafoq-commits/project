import { DESKTOP_CHANNELS } from '../preload/desktop-api.types';
import { StoreManager, DesktopConfig } from './store-manager';
import { ServerManager } from './server-manager';
import { PrinterManager } from './printer-manager';
import { getLocalNetworkIps, testServerConnection } from './network-utils';

export interface RegisterIpcHandlersOptions {
  ipcMain: any;
  storeManager: StoreManager;
  serverManager: ServerManager;
  printerManager: PrinterManager;
  webContentsGetter: () => any;
  networkUtils?: {
    getLocalNetworkIps: () => string[];
    testServerConnection: (url: string) => Promise<{ ok: boolean; status?: number; error?: string }>;
  };
}

/**
 * Validates and sanitizes partial configuration updates received over IPC from the renderer.
 */
function sanitizeConfigUpdates(raw: any): Partial<DesktopConfig> {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  const updates: Partial<DesktopConfig> = {};

  if (raw.serverMode === 'server' || raw.serverMode === 'client') {
    updates.serverMode = raw.serverMode;
  }

  if (typeof raw.serverUrl === 'string') {
    const trimmed = raw.serverUrl.trim();
    if (/^https?:\/\/[a-zA-Z0-9\-._~%!$&'()*+,;=:]+(\/[a-zA-Z0-9\-._~%!$&'()*+,;=:@]*)*\/?$/i.test(trimmed)) {
      updates.serverUrl = trimmed.replace(/\/+$/, '');
    }
  }

  if (typeof raw.directPrintEnabled === 'boolean') {
    updates.directPrintEnabled = raw.directPrintEnabled;
  }

  if (typeof raw.defaultThermalPrinter === 'string') {
    updates.defaultThermalPrinter = raw.defaultThermalPrinter.trim().slice(0, 255);
  } else if (raw.defaultThermalPrinter === null || raw.defaultThermalPrinter === '') {
    updates.defaultThermalPrinter = undefined;
  }

  if (raw.windowBounds && typeof raw.windowBounds === 'object') {
    const { width, height, x, y } = raw.windowBounds;
    if (typeof width === 'number' && width >= 400 && typeof height === 'number' && height >= 300) {
      updates.windowBounds = {
        width: Math.round(width),
        height: Math.round(height),
        x: typeof x === 'number' ? Math.round(x) : undefined,
        y: typeof y === 'number' ? Math.round(y) : undefined,
      };
    }
  }

  return updates;
}

/**
 * Validates that an input URL is a non-empty string and uses http or https protocols.
 */
function isValidHttpUrl(url: any): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!/^https?:\/\/.+/i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Registers all desktop IPC handlers with electron's ipcMain, applying strict input validation
 * and delegating execution to the respective subsystem managers.
 *
 * @param options Subsystem instances and utilities required for IPC operations
 * @returns Cleanup function unregistering all attached IPC handlers
 */
export function registerIpcHandlers(options: RegisterIpcHandlersOptions): () => void {
  const {
    ipcMain,
    storeManager,
    serverManager,
    printerManager,
    webContentsGetter,
    networkUtils = { getLocalNetworkIps, testServerConnection },
  } = options;

  const registeredChannels: string[] = [];

  const registerHandler = (
    channel: string,
    handler: (event: any, ...args: any[]) => Promise<any> | any,
  ) => {
    try {
      if (typeof ipcMain.removeHandler === 'function') {
        ipcMain.removeHandler(channel);
      }
    } catch {
      // Ignore if handler did not exist
    }

    ipcMain.handle(channel, async (event: any, ...args: any[]) => {
      try {
        return await handler(event, ...args);
      } catch (err: any) {
        console.error(`[IPC Error: ${channel}]`, err);
        return {
          success: false,
          error: err?.message || 'حدث خطأ داخلي أثناء معالجة الطلب',
        };
      }
    });

    registeredChannels.push(channel);
  };

  // 1. Desktop Configuration Channels
  registerHandler(DESKTOP_CHANNELS.GET_CONFIG, async () => {
    return storeManager.getConfig();
  });

  registerHandler(DESKTOP_CHANNELS.SAVE_CONFIG, async (_event, rawUpdates) => {
    const sanitized = sanitizeConfigUpdates(rawUpdates);
    return storeManager.saveConfig(sanitized);
  });

  // 2. Network & Health Channels
  registerHandler(DESKTOP_CHANNELS.TEST_CONNECTION, async (_event, url) => {
    if (!isValidHttpUrl(url)) {
      return {
        ok: false,
        error: 'رابط الخادم غير صالح (يجب أن يبدأ بـ http:// أو https://)',
      };
    }
    return networkUtils.testServerConnection(url.trim());
  });

  registerHandler(DESKTOP_CHANNELS.GET_LOCAL_IPS, async () => {
    return networkUtils.getLocalNetworkIps();
  });

  // 3. Local Server Management Channels
  registerHandler(DESKTOP_CHANNELS.GET_SERVER_STATUS, async () => {
    return serverManager.getStatus();
  });

  registerHandler(DESKTOP_CHANNELS.START_SERVER, async () => {
    return serverManager.start();
  });

  registerHandler(DESKTOP_CHANNELS.STOP_SERVER, async () => {
    return serverManager.stop();
  });

  // 4. Hardware & Thermal Printing Channels
  registerHandler(DESKTOP_CHANNELS.GET_PRINTERS, async () => {
    const wc = typeof webContentsGetter === 'function' ? webContentsGetter() : null;
    return printerManager.getInstalledPrinters(wc);
  });

  registerHandler(DESKTOP_CHANNELS.PRINT_RECEIPT, async (_event, rawOptions) => {
    if (!rawOptions || typeof rawOptions !== 'object') {
      return { success: false, error: 'بيانات أمر الطباعة غير صالحة' };
    }

    const htmlContent = typeof rawOptions.htmlContent === 'string' ? rawOptions.htmlContent.trim() : '';
    if (!htmlContent) {
      return { success: false, error: 'محتوى الإيصال فارغ ولا يمكن طباعته' };
    }

    const currentConfig = storeManager.getConfig();
    const printerName = typeof rawOptions.printerName === 'string' && rawOptions.printerName.trim()
      ? rawOptions.printerName.trim()
      : currentConfig.defaultThermalPrinter;

    return printerManager.printReceiptSilent({
      printerName,
      htmlContent,
      width: typeof rawOptions.width === 'string' ? rawOptions.width : '80mm',
    });
  });

  return () => {
    for (const channel of registeredChannels) {
      try {
        if (typeof ipcMain.removeHandler === 'function') {
          ipcMain.removeHandler(channel);
        }
      } catch {
        // Cleanup error ignore
      }
    }
  };
}
