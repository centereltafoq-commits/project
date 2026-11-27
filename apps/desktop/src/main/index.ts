import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { StoreManager } from './store-manager';
import { ServerManager } from './server-manager';
import { PrinterManager } from './printer-manager';
import { PostgresManager } from './postgres-manager';
import { registerIpcHandlers } from './ipc-handlers';
import { testServerConnection } from './network-utils';
import { TrayManager } from './tray-manager';
import { UpdateManager } from './update-manager';
import { WhatsappWindowManager } from './whatsapp-window-manager';
import { DESKTOP_EVENTS } from '../preload/desktop-api.types';

export interface AppContext {
  storeManager: StoreManager;
  serverManager: ServerManager;
  printerManager: PrinterManager;
  trayManager?: TrayManager;
  updateManager?: UpdateManager;
  whatsappWindowManager?: WhatsappWindowManager;
  isForceQuitting?: () => boolean;
  mainWindow: BrowserWindow | null;
}

export interface LoadOptions {
  testConnectionFn?: typeof testServerConnection;
}

/**
 * Instant Arabic splash page displayed as soon as the Electron window opens so the user
 * never sees a blank/hidden startup while PostgreSQL and NestJS initialize in the background.
 */
export function getStartupSplashHtml(): string {
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>EduCenter ERP - جاري التشغيل</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 55%, #0f172a 100%);
      color: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }
    .box {
      text-align: center;
      max-width: 420px;
      padding: 40px 32px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.45);
    }
    .spinner {
      width: 46px;
      height: 46px;
      margin: 0 auto 20px;
      border-radius: 50%;
      border: 4px solid rgba(96, 165, 250, 0.25);
      border-top-color: #60a5fa;
      animation: spin 0.85s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    h1 { font-size: 22px; font-weight: 800; margin-bottom: 10px; }
    p { font-size: 14px; line-height: 1.7; color: #cbd5e1; }
  </style>
</head>
<body>
  <div class="box">
    <div class="spinner"></div>
    <h1>EduCenter ERP</h1>
    <p>جاري تشغيل النظام وتجهيز قاعدة البيانات والخادم المحلي...<br>يرجى الانتظار لحظات</p>
  </div>
</body>
</html>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

/**
 * Builds a self-contained Arabic HTML recovery page displayed when the local
 * embedded backend server or database fails to start within timeout.
 */
export function getServerRecoveryFallbackHtml(
  targetUrl: string,
  errorReason: string,
): string {
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>نظام إدارة السنتر التعليمي - تشغيل الخادم المحلي</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      background: #f1f5f9;
      color: #1e293b;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
      width: 100%;
      max-width: 520px;
      padding: 36px 32px;
      text-align: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      background: #fee2e2;
      color: #991b1b;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 12px;
    }
    p.desc {
      color: #64748b;
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 24px;
    }
    button {
      padding: 12px 20px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: background-color 0.2s, transform 0.1s;
    }
    button:active {
      transform: scale(0.99);
    }
    .btn-primary {
      background: #2563eb;
      color: #ffffff;
    }
    .btn-primary:hover {
      background: #1d4ed8;
    }
    .btn-secondary {
      background: #f1f5f9;
      color: #334155;
    }
    .btn-secondary:hover {
      background: #e2e8f0;
    }
    .error-msg {
      color: #dc2626;
      font-size: 13px;
      margin-top: 12px;
      min-height: 20px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">تعذر تشغيل الخادم المحلي</div>
    <h1>إعادة تشغيل السيرفر المحلي</h1>
    <p class="desc">تعذر الاتصال بالخادم المحلي على الجهاز.<br><span style="font-size: 12px; color: #94a3b8; direction: ltr; display: inline-block;">(${errorReason})</span></p>

    <div class="actions">
      <button class="btn-primary" id="restartBtn" onclick="restartLocalServer()">إعادة تشغيل الخادم والمحاولة الآن</button>
      <button class="btn-secondary" id="retryBtn" onclick="retryLocalConnection()">فحص الجاهزية والمتابعة</button>
    </div>

    <div class="error-msg" id="statusMsg"></div>
  </div>

  <script>
    const targetUrl = '${targetUrl}';

    async function retryLocalConnection() {
      const msg = document.getElementById('statusMsg');
      const btn = document.getElementById('retryBtn');
      btn.disabled = true;
      btn.innerText = 'جاري الفحص...';
      msg.innerText = '';

      try {
        if (window.desktopApi && typeof window.desktopApi.testConnection === 'function') {
          const res = await window.desktopApi.testConnection(targetUrl);
          if (res.ok) {
            window.location.href = targetUrl;
            return;
          }
          msg.innerText = res.error || 'الخادم المحلي غير جاهز بعد';
        } else {
          window.location.href = targetUrl;
        }
      } catch (err) {
        msg.innerText = 'حدث خطأ أثناء الفحص';
      } finally {
        btn.disabled = false;
        btn.innerText = 'فحص الجاهزية والمتابعة';
      }
    }

    async function restartLocalServer() {
      const msg = document.getElementById('statusMsg');
      const btn = document.getElementById('restartBtn');
      btn.disabled = true;
      btn.innerText = 'جاري تشغيل السيرفر وقاعدة البيانات...';
      msg.innerText = '';

      try {
        if (window.desktopApi && typeof window.desktopApi.startServer === 'function') {
          const startRes = await window.desktopApi.startServer();
          if (startRes && startRes.success === false) {
            msg.innerText = startRes.error || 'تعذر تشغيل الخادم المحلي';
            return;
          }

          if (typeof window.desktopApi.testConnection === 'function') {
            for (let i = 0; i < 25; i++) {
              const res = await window.desktopApi.testConnection(targetUrl);
              if (res && res.ok) {
                window.location.href = targetUrl;
                return;
              }
              await new Promise((r) => setTimeout(r, 1000));
            }
            msg.innerText = 'استغرق بدء السيرفر وقتاً أطول من المعتاد — اضغط "فحص الجاهزية" للمتابعة.';
          } else {
            window.location.href = targetUrl;
          }
        }
      } catch (err) {
        msg.innerText = 'تعذر تشغيل الخادم المحلي';
      } finally {
        btn.disabled = false;
        btn.innerText = 'إعادة تشغيل الخادم والمحاولة الآن';
      }
    }
  </script>
</body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

/**
 * Always boots the embedded local NestJS API & PostgreSQL server and loads http://localhost:4000.
 */
export async function loadAppContent(
  window: BrowserWindow,
  context: AppContext,
  options?: LoadOptions,
): Promise<void> {
  const { storeManager, serverManager } = context;
  const config = storeManager.getConfig();
  const testConn = options?.testConnectionFn || testServerConnection;
  const isLocalTarget =
    Boolean(config.serverUrl) &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(config.serverUrl.trim());
  const serverUrl = isLocalTarget ? config.serverUrl : 'http://localhost:4000';

  if (!isLocalTarget) {
    try {
      storeManager.saveConfig({ serverUrl });
    } catch {}
  }

  const status = serverManager.getStatus();
  if (!status.running) {
    const startResult = await serverManager.start();
    if (startResult && startResult.success === false) {
      await window.loadURL(
        getServerRecoveryFallbackHtml(
          serverUrl,
          startResult.error || 'تعذر بدء تشغيل السيرفر المحلي للسنتر',
        ),
      );
      return;
    }
  }

  let isReady = false;

  // Retry checking health while PostgreSQL + NestJS + Drizzle bootstrap settle
  for (let i = 0; i < 25; i++) {
    const health = await testConn(serverUrl, 1500);
    if (health.ok) {
      isReady = true;
      break;
    }
    const curStatus = serverManager.getStatus();
    if (!curStatus.running && curStatus.error) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (isReady) {
    await window.loadURL(serverUrl);
  } else {
    await window.loadURL(
      getServerRecoveryFallbackHtml(
        serverUrl,
        serverManager.getStatus().error ||
          'استغرق بدء تشغيل السيرفر وقتاً أطول من المعتاد — اضغط "فحص الجاهزية" للمتابعة',
      ),
    );
  }
}

/**
 * Creates the primary application window with secure sandbox & context bridge configuration.
 */
export async function createMainWindow(
  context: AppContext,
  options?: LoadOptions,
): Promise<BrowserWindow> {
  const { storeManager, serverManager, printerManager } = context;
  const config = storeManager.getConfig();
  const bounds = config.windowBounds || { width: 1280, height: 850 };

  const preloadPath = path.join(__dirname, '../preload/index.js');

  const mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 1024,
    minHeight: 700,
    autoHideMenuBar: true,
    show: false,
    title: 'EduCenter ERP - إدارة السنتر التعليمي',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  context.mainWindow = mainWindow;

  // Persist window geometry & hide to System Tray in Server Mode unless force-quitting
  const saveBounds = () => {
    if (!mainWindow.isDestroyed()) {
      const currentBounds = mainWindow.getBounds();
      storeManager.saveConfig({ windowBounds: currentBounds });
    }
  };

  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);
  mainWindow.on('close', (event?: any) => {
    saveBounds();

    const latestConfig = storeManager.getConfig();
    const shouldHideToTray =
      !context.isForceQuitting?.() &&
      latestConfig.keepRunningInTray !== false &&
      Boolean(context.trayManager) &&
      typeof mainWindow.hide === 'function';

    if (shouldHideToTray && event && typeof event.preventDefault === 'function') {
      event.preventDefault();
      mainWindow.hide();
      context.trayManager?.notifyHiddenToTray();
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Register all desktop IPC handlers
  registerIpcHandlers({
    ipcMain,
    storeManager,
    serverManager,
    printerManager,
    updateManager: context.updateManager,
    whatsappWindowManager: context.whatsappWindowManager,
    webContentsGetter: () => (mainWindow.isDestroyed() ? null : mainWindow.webContents),
    onConfigSaved: async (saved) => {
      context.trayManager?.refreshMenu();
      context.trayManager?.syncStartupPreference(Boolean(saved.launchOnStartup));
      context.updateManager?.syncConfiguration();
    },
  });

  await mainWindow.loadURL(getStartupSplashHtml());
  if (typeof mainWindow.show === 'function') {
    mainWindow.show();
  }

  await loadAppContent(mainWindow, context, options);

  return mainWindow;
}

/**
 * Initializes the full Electron application lifecycle.
 */
export function setupApp(customContext?: AppContext) {
  let context: AppContext;
  let forceQuitting = false;

  const stopDesktopServices = async (): Promise<void> => {
    context.whatsappWindowManager?.close();
    if (context.serverManager) {
      await Promise.resolve(context.serverManager.stop()).catch((err) => {
        console.error('[App] Failed to gracefully stop server on quit:', err);
      });
    }
  };

  if (customContext) {
    context = customContext;
  } else {
    const storeManager = new StoreManager();
    const postgresManager = new PostgresManager();
    const serverManager = new ServerManager({
      postgresManager,
      onRunningChange: () => {
        context?.trayManager?.refreshMenu();
      },
    });
    const updateManager = new UpdateManager({
      storeManager,
      onStatusChange: (status) => {
        if (context?.mainWindow && !context.mainWindow.isDestroyed()) {
          context.mainWindow.webContents.send(DESKTOP_EVENTS.UPDATE_STATUS_CHANGED, status);
        }
      },
      onBeforeInstallQuit: async () => {
        forceQuitting = true;
        await stopDesktopServices();
      },
    });
    const trayManager = new TrayManager({
      storeManager,
      getWindow: () => context.mainWindow,
      onCheckForUpdates: () => {
        void updateManager.checkForUpdates();
      },
      onRequestQuit: () => {
        forceQuitting = true;
        app.quit();
      },
    });

    context = {
      storeManager,
      serverManager,
      printerManager: new PrinterManager(),
      trayManager,
      updateManager,
      whatsappWindowManager: new WhatsappWindowManager(),
      isForceQuitting: () => forceQuitting,
      mainWindow: null,
    };
  }

  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
    return;
  }

  app.on('second-instance', () => {
    if (context.mainWindow) {
      if (context.mainWindow.isMinimized()) {
        context.mainWindow.restore();
      }
      if (typeof context.mainWindow.show === 'function') {
        context.mainWindow.show();
      }
      context.mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    context.trayManager?.init();
    const cfg = context.storeManager.getConfig();
    context.trayManager?.syncStartupPreference(Boolean(cfg.launchOnStartup));
    await createMainWindow(context);

    if (cfg.updateSettings?.autoCheck && context.updateManager?.getStatus().isConfigured) {
      void context.updateManager.checkForUpdates();
    }
  });

  app.on('window-all-closed', () => {
    const cfg = context.storeManager.getConfig();
    if (!forceQuitting && cfg.keepRunningInTray !== false) {
      return;
    }
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow(context);
    } else if (context.mainWindow && typeof context.mainWindow.show === 'function') {
      context.mainWindow.show();
      context.mainWindow.focus();
    }
  });

  let isQuitting = false;
  app.on('before-quit', (event?: any) => {
    forceQuitting = true;
    if (isQuitting) return;
    isQuitting = true;
    context.trayManager?.destroy();

    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
      void stopDesktopServices().finally(() => {
        app.quit();
      });
    } else {
      void stopDesktopServices();
    }
  });
}

// Automatically launch lifecycle when run as the Electron entrypoint
if (typeof process.env.VITEST === 'undefined') {
  setupApp();
}
