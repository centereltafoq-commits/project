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

    this.tray.setToolTip('EduCenter ERP — الخادم المحلي يعمل في الخلفية');

    const template: Electron.MenuItemConstructorOptions[] = [
      {
        label: 'فتح لوحة الإدارة',
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
        label: 'إيقاف الخادم والخروج نهائياً',
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
        title: 'EduCenter ERP - البرنامج مستمر في العمل',
        content:
          'تم تصغير النافذة بجانب الساعة لاستمرار عمل الخادم المحلي في الخلفية. اضغط كليك يمين على الأيقونة للإغلاق النهائي.',
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
          path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath,
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
