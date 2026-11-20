import { app, Menu, nativeImage, Tray, type BrowserWindow } from 'electron';
import { resolveDesktopIconPath } from './runtime-paths';
import type { StoreManager } from './store-manager';

export interface TrayManagerOptions {
  storeManager: StoreManager;
  getWindow: () => BrowserWindow | null;
  onCheckForUpdates?: () => void;
  onRequestQuit: () => void;
}

/**
 * Manages the Windows system tray icon and menu so Server Mode stays alive
 * in the background even when users close the main window.
 */
export class TrayManager {
  private tray: Tray | null = null;
  private balloonShown = false;

  constructor(private readonly options: TrayManagerOptions) {}

  public init(): void {
    if (this.tray || typeof Tray !== 'function' || typeof Menu?.buildFromTemplate !== 'function') {
      return;
    }

    const iconPath = resolveDesktopIconPath();
    const icon = iconPath ? nativeImage.createFromPath(iconPath) : nativeImage.createEmpty();

    this.tray = new Tray(icon);
    this.tray.on('click', () => {
      this.showMainWindow();
    });
    this.tray.on('double-click', () => {
      this.showMainWindow();
    });

    this.refreshMenu();
  }

  public showMainWindow(): void {
    const win = this.options.getWindow();
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) {
      win.restore();
    }
    win.show();
    win.focus();
  }

  public refreshMenu(): void {
    if (!this.tray || typeof Menu?.buildFromTemplate !== 'function') {
      return;
    }

    const config = this.options.storeManager.getConfig();
    const isServer = config.serverMode === 'server';
    this.tray.setToolTip(
      isServer
        ? 'EduCenter ERP — سيرفر السنتر يعمل في الخلفية'
        : 'EduCenter ERP — محطة استقبال',
    );

    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: isServer ? 'فتح لوحة الإدارة (السيرفر يعمل)' : 'فتح نافذة البرنامج',
        click: () => this.showMainWindow(),
      },
      {
        label: 'التحقق من وجود تحديثات',
        click: () => {
          this.showMainWindow();
          this.options.onCheckForUpdates?.();
        },
      },
      { type: 'separator' },
      {
        label: isServer ? 'إيقاف السيرفر والخروج نهائياً' : 'إغلاق البرنامج نهائياً',
        click: () => this.options.onRequestQuit(),
      },
    ];

    this.tray.setContextMenu(Menu.buildFromTemplate(template));
  }

  public notifyHiddenToTray(): void {
    if (!this.tray || this.balloonShown || typeof this.tray.displayBalloon !== 'function') {
      return;
    }
    this.balloonShown = true;
    try {
      this.tray.displayBalloon({
        title: 'EduCenter ERP - السيرفر مستمر في العمل',
        content:
          'تم تصغير النافذة بجانب الساعة ليظل السيرفر متاحاً لباقي أجهزة السنتر. اضغط كليك يمين على الأيقونة للإغلاق النهائي.',
      });
    } catch {
      // Ignore balloon failures on unsupported platforms
    }
  }

  public syncStartupPreference(enabled: boolean): void {
    try {
      if (typeof app?.setLoginItemSettings === 'function' && app?.isPackaged) {
        app.setLoginItemSettings({
          openAtLogin: Boolean(enabled),
          openAsHidden: true,
        });
      }
    } catch (err) {
      console.warn('[TrayManager] Unable to update Windows startup item:', err);
    }
  }

  public destroy(): void {
    if (this.tray) {
      try {
        this.tray.destroy();
      } catch {
        // Ignore tray teardown issues
      }
      this.tray = null;
    }
  }
}
