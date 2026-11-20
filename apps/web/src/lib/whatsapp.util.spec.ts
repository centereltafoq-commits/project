import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildWhatsAppUrl,
  normalizeWhatsAppPhone,
  openWhatsAppLink,
  renderWhatsAppTemplate,
} from './whatsapp.util';

describe('whatsapp.util', () => {
  const originalDesktopApi = (window as any).desktopApi;

  afterEach(() => {
    (window as any).desktopApi = originalDesktopApi;
    vi.restoreAllMocks();
  });

  it('normalizes Egyptian, Arabic-Indic numerals, and international phone numbers properly', () => {
    expect(normalizeWhatsAppPhone('01012345678')).toEqual({
      valid: true,
      normalized: '201012345678',
      display: '+201012345678',
    });

    expect(normalizeWhatsAppPhone('٠١٠١٢٣٤٥٦٧٨')).toEqual({
      valid: true,
      normalized: '201012345678',
      display: '+201012345678',
    });

    expect(normalizeWhatsAppPhone('+20 111 222 3334')).toEqual({
      valid: true,
      normalized: '201112223334',
      display: '+201112223334',
    });

    expect(normalizeWhatsAppPhone('00966501234567')).toEqual({
      valid: true,
      normalized: '966501234567',
      display: '+966501234567',
    });

    expect(normalizeWhatsAppPhone('12345')).toEqual({
      valid: false,
      normalized: '',
      display: '',
    });
  });

  it('renders Arabic template tokens cleanly while preserving newlines and cleaning empty parentheses', () => {
    const rendered = renderWhatsAppTemplate(
      'السلام عليكم {اسم_الطالب}،\nمجموعة ({المجموعة}) - {المادة}\nتحيات {اسم_السنتر}',
      {
        studentName: 'سيف الدين',
        groupName: '',
        subject: 'الكيمياء',
        centerName: 'سنتر التفوق',
      },
    );

    expect(rendered).toBe(
      'السلام عليكم سيف الدين،\nمجموعة - الكيمياء\nتحيات سنتر التفوق',
    );
  });

  it('builds web.whatsapp.com and wa.me URLs with encoded message', () => {
    const webUrl = buildWhatsAppUrl('01099887766', 'أهلاً بك يا بطل', 'web');
    expect(webUrl).toBe(
      `https://web.whatsapp.com/send?phone=201099887766&text=${encodeURIComponent('أهلاً بك يا بطل')}`,
    );

    const appUrl = buildWhatsAppUrl('+201099887766', 'موعد الحصة', 'app');
    expect(appUrl).toBe(
      `https://wa.me/201099887766?text=${encodeURIComponent('موعد الحصة')}`,
    );

    expect(buildWhatsAppUrl('123', 'test')).toBeNull();
  });

  it('launches desktop webview when desktopApi.openWhatsApp exists, or falls back to window.open', async () => {
    const openWhatsAppMock = vi.fn().mockResolvedValue({ success: true });
    (window as any).desktopApi = { isDesktop: true, openWhatsApp: openWhatsAppMock };

    const desktopRes = await openWhatsAppLink('https://web.whatsapp.com/send?phone=201012345678');
    expect(desktopRes).toEqual({ success: true, openedVia: 'desktop-webview' });
    expect(openWhatsAppMock).toHaveBeenCalledTimes(1);

    (window as any).desktopApi = undefined;
    const focusMock = vi.fn();
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({ focus: focusMock } as any);

    const webRes = await openWhatsAppLink('https://web.whatsapp.com/send?phone=201012345678');
    expect(webRes).toEqual({ success: true, openedVia: 'browser-window' });
    expect(openSpy).toHaveBeenCalledWith(
      'https://web.whatsapp.com/send?phone=201012345678',
      'educenter_whatsapp_webview',
      'width=1180,height=760',
    );
    expect(focusMock).toHaveBeenCalledTimes(1);
  });
});
