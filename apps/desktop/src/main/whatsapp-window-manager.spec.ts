import { describe, expect, it, vi } from 'vitest';
import {
  WHATSAPP_CHROME_USER_AGENT,
  WhatsappWindowManager,
  isAllowedWhatsAppUrl,
} from './whatsapp-window-manager';

describe('WhatsappWindowManager', () => {
  it('validates allowed HTTPS WhatsApp URLs strictly and rejects unsafe URLs', () => {
    expect(isAllowedWhatsAppUrl('https://web.whatsapp.com/send?phone=201012345678&text=hi')).toBe(true);
    expect(isAllowedWhatsAppUrl('https://wa.me/201012345678?text=hi')).toBe(true);
    expect(isAllowedWhatsAppUrl('https://api.whatsapp.com/send?phone=201012345678')).toBe(true);

    expect(isAllowedWhatsAppUrl('http://web.whatsapp.com/send?phone=201012345678')).toBe(false);
    expect(isAllowedWhatsAppUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedWhatsAppUrl('https://evil.example.com/phish')).toBe(false);
    expect(isAllowedWhatsAppUrl('')).toBe(false);
  });

  it('creates an isolated persist:whatsapp window on first open and reuses it on subsequent calls', async () => {
    const loadURL = vi.fn().mockResolvedValue(undefined);
    const focus = vi.fn();
    const show = vi.fn();
    const restore = vi.fn();
    const destroy = vi.fn();
    const on = vi.fn();
    const instances: any[] = [];

    const MockBrowserWindow = vi.fn().mockImplementation((opts: any) => {
      const win = {
        opts,
        loadURL,
        focus,
        show,
        restore,
        destroy,
        on,
        isDestroyed: () => false,
        isMinimized: () => true,
      };
      instances.push(win);
      return win;
    });

    const manager = new WhatsappWindowManager(MockBrowserWindow as any);

    const first = await manager.openUrl('https://web.whatsapp.com/send?phone=201012345678');
    expect(first).toEqual({ success: true });
    expect(MockBrowserWindow).toHaveBeenCalledTimes(1);
    expect(instances[0].opts.webPreferences).toMatchObject({
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      partition: 'persist:whatsapp',
    });
    expect(loadURL).toHaveBeenCalledWith(
      'https://web.whatsapp.com/send?phone=201012345678',
      { userAgent: WHATSAPP_CHROME_USER_AGENT },
    );

    const second = await manager.openUrl('https://wa.me/201099887766?text=test');
    expect(second).toEqual({ success: true });
    expect(MockBrowserWindow).toHaveBeenCalledTimes(1);
    expect(restore).toHaveBeenCalledTimes(1);
    expect(show).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledTimes(1);
    expect(loadURL).toHaveBeenLastCalledWith(
      'https://wa.me/201099887766?text=test',
      { userAgent: WHATSAPP_CHROME_USER_AGENT },
    );

    const rejected = await manager.openUrl('https://evil.example.com');
    expect(rejected.success).toBe(false);

    manager.close();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
