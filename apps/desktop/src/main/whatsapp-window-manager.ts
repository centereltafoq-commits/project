import type { BrowserWindow } from 'electron';

export const WHATSAPP_CHROME_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const ALLOWED_WHATSAPP_HOSTS = new Set([
  'web.whatsapp.com',
  'wa.me',
  'api.whatsapp.com',
]);

/**
 * Validates that a URL points strictly to an HTTPS WhatsApp domain.
 */
export function isAllowedWhatsAppUrl(rawUrl: unknown): boolean {
  if (typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    return (
      parsed.protocol === 'https:' &&
      ALLOWED_WHATSAPP_HOSTS.has(parsed.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

export class WhatsappWindowManager {
  private window: BrowserWindow | null = null;

  constructor(private readonly WindowCtor?: typeof BrowserWindow) {}

  async openUrl(url: string): Promise<{ success: boolean; error?: string }> {
    if (!isAllowedWhatsAppUrl(url)) {
      return { success: false, error: 'رابط واتساب غير صالح' };
    }

    const cleanUrl = url.trim();
    try {
      if (this.window && typeof this.window.isDestroyed === 'function' && !this.window.isDestroyed()) {
        if (typeof this.window.isMinimized === 'function' && this.window.isMinimized()) {
          this.window.restore();
        }
        if (typeof this.window.show === 'function') {
          this.window.show();
        }
        if (typeof this.window.focus === 'function') {
          this.window.focus();
        }
        await this.window.loadURL(cleanUrl, {
          userAgent: WHATSAPP_CHROME_USER_AGENT,
        });
        return { success: true };
      }

      const WindowClass =
        this.WindowCtor ??
        ((require('electron') as { BrowserWindow: typeof BrowserWindow }).BrowserWindow);

      const win = new WindowClass({
        width: 1180,
        height: 760,
        minWidth: 820,
        minHeight: 580,
        autoHideMenuBar: true,
        title: 'واتساب ويب — EduCenter ERP',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true,
          partition: 'persist:whatsapp',
        },
      });

      this.window = win;
      if (typeof win.on === 'function') {
        win.on('closed', () => {
          if (this.window === win) {
            this.window = null;
          }
        });
      }

      await win.loadURL(cleanUrl, {
        userAgent: WHATSAPP_CHROME_USER_AGENT,
      });

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'تعذر فتح نافذة واتساب ويب',
      };
    }
  }

  close(): void {
    if (this.window && typeof this.window.isDestroyed === 'function' && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = null;
  }
}
