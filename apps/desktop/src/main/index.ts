import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { StoreManager } from './store-manager';
import { ServerManager } from './server-manager';
import { PrinterManager } from './printer-manager';
import { PostgresManager } from './postgres-manager';
import { LanDiscoveryResponder } from './lan-discovery';
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
  discoveryResponder?: LanDiscoveryResponder;
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
 * Builds a self-contained Arabic HTML recovery & connection wizard page
 * displayed when client mode cannot reach the central center server.
 */
export function getConnectionSetupFallbackHtml(
  targetUrl: string,
  errorReason: string,
  isFirstLaunch = false,
): string {
  const badgeStyle = isFirstLaunch
    ? 'background: #dbeafe; color: #1d4ed8;'
    : 'background: #fee2e2; color: #991b1b;';
  const badgeText = isFirstLaunch ? 'التشغيل الأول للبرنامج' : 'تعذر الاتصال بالسيرفر';
  const descHtml = isFirstLaunch
    ? 'اختر ما إذا كان هذا الجهاز هو <strong>السيرفر الرئيسي للسنتر</strong> أو محطة استقبال متصلة بالسيرفر عبر الشبكة.'
    : `لم نتمكن من الوصول إلى السيرفر على العنوان:<br><strong style="color: #0f172a; direction: ltr; display: inline-block;">${targetUrl}</strong><br><span style="font-size: 12px; color: #94a3b8;">(${errorReason})</span>`;
  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>نظام إدارة السنتر التعليمي - إعداد الاتصال</title>
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
    .input-group {
      text-align: right;
      margin-bottom: 20px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #334155;
      margin-bottom: 8px;
    }
    input[type="text"] {
      width: 100%;
      direction: ltr;
      text-align: left;
      padding: 12px 14px;
      font-size: 15px;
      border: 1.5px solid #cbd5e1;
      border-radius: 10px;
      outline: none;
      transition: border-color 0.2s;
    }
    input[type="text"]:focus {
      border-color: #2563eb;
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
      margin-top: 10px;
      min-height: 20px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge" style="${badgeStyle}">${badgeText}</div>
    <h1>إعداد الاتصال بشبكة السنتر</h1>
    <p class="desc">${descHtml}</p>

    <div class="input-group">
      <label for="serverUrlInput">عنوان خادم السنتر (IP / URL):</label>
      <input type="text" id="serverUrlInput" value="${targetUrl}" placeholder="http://192.168.1.50:4000">
    </div>

    <div id="discoveredList" style="display:none; text-align:right; margin-bottom:16px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px;"></div>

    <div class="actions">
      <button class="btn-secondary" id="discoverBtn" onclick="discoverLan()" style="background:#ecfdf5; color:#065f46; border:1px solid #a7f3d0;">البحث التلقائي عن سيرفر السنتر في الشبكة</button>
      <button class="btn-primary" id="retryBtn" onclick="retryConnection()">فحص الاتصال وإعادة المحاولة</button>
      <button class="btn-secondary" id="serverModeBtn" onclick="switchToServerMode()">تشغيل هذا الجهاز كسيرفر رئيسي للسنتر</button>
    </div>

    <div class="error-msg" id="statusMsg"></div>
  </div>

  <script>
    async function discoverLan() {
      const btn = document.getElementById('discoverBtn');
      const list = document.getElementById('discoveredList');
      const msg = document.getElementById('statusMsg');

      if (!window.desktopApi || typeof window.desktopApi.discoverServers !== 'function') {
        msg.innerText = 'ميزة البحث التلقائي غير متاحة حالياً';
        return;
      }

      btn.disabled = true;
      btn.innerText = 'جاري البحث عن السيرفر في الشبكة...';
      msg.innerText = '';
      list.style.display = 'none';
      list.innerHTML = '';

      try {
        const servers = await window.desktopApi.discoverServers();
        if (!servers || servers.length === 0) {
          msg.innerText = 'لم يتم العثور على سيرفر يعمل على الشبكة حالياً — تأكد من فتح السيرفر على الجهاز الرئيسي';
          return;
        }

        list.style.display = 'block';
        list.innerHTML = '<div style="font-size:12px; font-weight:700; color:#334155; margin-bottom:8px;">السيرفرات المكتشفة:</div>';
        servers.forEach((srv) => {
          const item = document.createElement('div');
          item.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px; background:#fff; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:6px;';
          item.innerHTML =
            '<div><div style="font-size:13px; font-weight:700; color:#0f172a;">' + (srv.name || 'سيرفر السنتر') + '</div>' +
            '<div style="font-size:11px; color:#64748b; direction:ltr;">' + srv.url + '</div></div>' +
            '<button style="padding:6px 12px; font-size:12px; background:#2563eb; color:#fff; border-radius:6px; cursor:pointer; border:none;">اتصال الآن</button>';
          item.querySelector('button').onclick = async () => {
            document.getElementById('serverUrlInput').value = srv.url;
            await retryConnection();
          };
          list.appendChild(item);
        });
      } catch (err) {
        msg.innerText = 'حدث خطأ أثناء البحث التلقائي عن السيرفر';
      } finally {
        btn.disabled = false;
        btn.innerText = 'البحث التلقائي عن سيرفر السنتر في الشبكة';
      }
    }

    async function retryConnection() {
      const input = document.getElementById('serverUrlInput');
      const msg = document.getElementById('statusMsg');
      const btn = document.getElementById('retryBtn');
      const url = input.value.trim();

      if (!url) {
        msg.innerText = 'يرجى إدخال عنوان الخادم';
        return;
      }

      btn.disabled = true;
      btn.innerText = 'جاري الفحص...';
      msg.innerText = '';

      try {
        if (window.desktopApi && typeof window.desktopApi.testConnection === 'function') {
          const res = await window.desktopApi.testConnection(url);
          if (res.ok) {
            await window.desktopApi.saveConfig({ serverUrl: url });
            window.location.href = url;
            return;
          } else {
            msg.innerText = res.error || 'فشل الاتصال بهذا العنوان، تأكد من تشغيل السيرفر الرئيسي';
          }
        } else {
          window.location.href = url;
        }
      } catch (err) {
        msg.innerText = 'حدث خطأ غير متوقع أثناء الفحص';
      } finally {
        btn.disabled = false;
        btn.innerText = 'فحص الاتصال وإعادة المحاولة';
      }
    }

    async function switchToServerMode() {
      const msg = document.getElementById('statusMsg');
      const btn = document.getElementById('serverModeBtn');
      const targetUrl = 'http://localhost:4000';
      btn.disabled = true;
      btn.innerText = 'جاري تشغيل السيرفر وقاعدة البيانات...';
      msg.innerText = '';

      try {
        if (window.desktopApi && typeof window.desktopApi.saveConfig === 'function') {
          await window.desktopApi.saveConfig({ serverMode: 'server', serverUrl: targetUrl });
          if (typeof window.desktopApi.startServer === 'function') {
            const startRes = await window.desktopApi.startServer();
            if (startRes && startRes.success === false) {
              msg.innerText = startRes.error || 'تعذر تشغيل الخادم المحلي';
              return;
            }
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
            msg.innerText = 'استغرق بدء السيرفر وقتاً أطول من المعتاد — اضغط "فحص الاتصال" للمتابعة.';
          } else {
            window.location.href = targetUrl;
          }
        }
      } catch (err) {
        msg.innerText = 'تعذر التبديل إلى وضع السيرفر';
      } finally {
        btn.disabled = false;
        btn.innerText = 'تشغيل هذا الجهاز كسيرفر رئيسي للسنتر';
      }
    }
  </script>
</body>
</html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

/**
 * Loads the application content into the main browser window based on server/client configuration.
 */
export async function loadAppContent(
  window: BrowserWindow,
  context: AppContext,
  options?: LoadOptions,
): Promise<void> {
  const { storeManager, serverManager } = context;
  const config = storeManager.getConfig();
  const testConn = options?.testConnectionFn || testServerConnection;

  if (config.serverMode === 'server') {
    // 1. Server Mode: ensure local NestJS API is started & LAN discovery announces it
    const status = serverManager.getStatus();
    if (!status.running) {
      await serverManager.start();
    }

    try {
      await context.discoveryResponder?.start();
    } catch (err) {
      console.warn('[App] LAN discovery responder start skipped:', err);
    }

    const serverUrl = config.serverUrl || 'http://localhost:4000';
    let isReady = false;

    // Retry checking health while PostgreSQL + NestJS + Drizzle bootstrap settle
    for (let i = 0; i < 15; i++) {
      const health = await testConn(serverUrl, 1500);
      if (health.ok) {
        isReady = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (isReady) {
      await window.loadURL(serverUrl);
    } else {
      window.loadURL(serverUrl).catch(() => {
        window.loadURL(
          getConnectionSetupFallbackHtml(
            serverUrl,
            'جاري بدء تشغيل السيرفر المحلي للسنتر...',
          ),
        );
      });
    }
  } else {
    // 2. Client Mode: stop any LAN broadcast and test connection to remote server
    try {
      await context.discoveryResponder?.stop();
    } catch {
      // Ignore responder stop errors
    }

    const targetUrl = config.serverUrl || 'http://localhost:4000';
    const connection = await testConn(targetUrl, 3000);

    if (connection.ok) {
      await window.loadURL(targetUrl);
    } else {
      await window.loadURL(
        getConnectionSetupFallbackHtml(
          targetUrl,
          connection.error || 'تعذر الوصول إلى الخادم عبر الشبكة المحلية',
          Boolean(config.isFirstLaunch),
        ),
      );
    }
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
      latestConfig.serverMode === 'server' &&
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
      if (saved.serverMode === 'server') {
        await context.discoveryResponder?.start();
      } else {
        await context.discoveryResponder?.stop();
      }
      context.trayManager?.refreshMenu();
      context.trayManager?.syncStartupPreference(Boolean(saved.launchOnStartup));
      context.updateManager?.syncConfiguration();
    },
  });

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
    const stopTasks: Promise<unknown>[] = [];
    if (context.discoveryResponder) {
      stopTasks.push(
        Promise.resolve(context.discoveryResponder.stop()).catch((err) => {
          console.error('[App] Failed to stop LAN discovery responder on quit:', err);
        }),
      );
    }
    if (context.serverManager) {
      stopTasks.push(
        Promise.resolve(context.serverManager.stop()).catch((err) => {
          console.error('[App] Failed to gracefully stop server on quit:', err);
        }),
      );
    }
    await Promise.all(stopTasks);
  };

  if (customContext) {
    context = customContext;
  } else {
    const storeManager = new StoreManager();
    const postgresManager = new PostgresManager();
    const discoveryResponder = new LanDiscoveryResponder(4000);
    const serverManager = new ServerManager({
      postgresManager,
      onRunningChange: (running) => {
        if (!running) {
          void discoveryResponder.stop();
        }
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
      discoveryResponder,
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
    if (!forceQuitting && cfg.serverMode === 'server' && cfg.keepRunningInTray !== false) {
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
