export interface WhatsappTemplateVariables {
  studentName?: string | null;
  studentCode?: string | null;
  gradeLevel?: string | null;
  groupName?: string | null;
  subject?: string | null;
  teacherName?: string | null;
  centerName?: string | null;
  date?: string | null;
}

export interface WhatsappTemplateVariableMeta {
  token: string;
  label: string;
  sampleValue: string;
}

export const WHATSAPP_TEMPLATE_VARIABLES: ReadonlyArray<WhatsappTemplateVariableMeta> = [
  { token: '{اسم_الطالب}', label: 'اسم الطالب', sampleValue: 'أحمد محمد' },
  { token: '{كود_الطالب}', label: 'كود الطالب', sampleValue: 'STU-2026-1001' },
  { token: '{الصف_الدراسي}', label: 'الصف الدراسي', sampleValue: 'الأول الثانوي' },
  { token: '{المجموعة}', label: 'اسم المجموعة', sampleValue: 'مجموعة الفيزياء أ' },
  { token: '{المادة}', label: 'المادة', sampleValue: 'الفيزياء' },
  { token: '{المدرس}', label: 'المدرس', sampleValue: 'أ. كريم' },
  { token: '{اسم_السنتر}', label: 'اسم السنتر', sampleValue: 'سنتر التفوق التعليمي' },
  { token: '{التاريخ}', label: 'التاريخ', sampleValue: '2026-11-20' },
];

export type WhatsappLaunchMode = 'web' | 'app';

export interface NormalizedPhoneResult {
  valid: boolean;
  normalized: string;
  display: string;
}

const ARABIC_INDIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const EASTERN_INDIC_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

function normalizeNumerals(input: string): string {
  return input
    .replace(/[٠-٩]/g, (ch) => String(ARABIC_INDIC_DIGITS.indexOf(ch)))
    .replace(/[۰-۹]/g, (ch) => String(EASTERN_INDIC_DIGITS.indexOf(ch)));
}

/**
 * Normalizes Egyptian and international phone numbers to digits-only international format (e.g. 201012345678).
 */
export function normalizeWhatsAppPhone(
  raw: string | null | undefined,
  defaultCountryCode = '20',
): NormalizedPhoneResult {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, normalized: '', display: '' };
  }

  const normalizedChars = normalizeNumerals(raw).trim();
  const hasPlusPrefix = normalizedChars.startsWith('+');
  const hasDoubleZeroPrefix = normalizedChars.startsWith('00');
  let digits = normalizedChars.replace(/\D/g, '');

  if (!digits) {
    return { valid: false, normalized: '', display: '' };
  }

  if (hasDoubleZeroPrefix) {
    digits = digits.slice(2);
  } else if (!hasPlusPrefix) {
    if (digits.startsWith('01') && digits.length === 11) {
      digits = `${defaultCountryCode}${digits.slice(1)}`;
    } else if (/^1[0125]\d{8}$/.test(digits)) {
      digits = `${defaultCountryCode}${digits}`;
    } else if (digits.startsWith('0') && !digits.startsWith(`${defaultCountryCode}`)) {
      digits = `${defaultCountryCode}${digits.replace(/^0+/, '')}`;
    }
  }

  // Handle accidental '+20010...' -> '2010...'
  if (digits.startsWith(`${defaultCountryCode}01`) && digits.length === defaultCountryCode.length + 11) {
    digits = `${defaultCountryCode}${digits.slice(defaultCountryCode.length + 1)}`;
  }

  if (digits.length < 10 || digits.length > 15) {
    return { valid: false, normalized: '', display: '' };
  }

  return {
    valid: true,
    normalized: digits,
    display: `+${digits}`,
  };
}

/**
 * Replaces template tokens accurately with recipient/group context while preserving line breaks cleanly.
 */
export function renderWhatsAppTemplate(
  template: string,
  vars: WhatsappTemplateVariables,
): string {
  if (!template) return '';

  const replacements: Record<string, string> = {
    '{اسم_الطالب}': vars.studentName?.trim() || '',
    '{كود_الطالب}': vars.studentCode?.trim() || '',
    '{الصف_الدراسي}': vars.gradeLevel?.trim() || '',
    '{المجموعة}': vars.groupName?.trim() || '',
    '{المادة}': vars.subject?.trim() || '',
    '{المدرس}': vars.teacherName?.trim() || '',
    '{اسم_السنتر}': vars.centerName?.trim() || '',
    '{التاريخ}': vars.date?.trim() || new Date().toISOString().slice(0, 10),
  };

  let result = template;
  for (const [token, value] of Object.entries(replacements)) {
    result = result.split(token).join(value);
  }

  return result
    .split('\n')
    .map((line) =>
      line
        .replace(/\(\s*\)/g, '')
        .replace(/-\s*(?=$|[،.])/g, '')
        .replace(/[ \t]{2,}/g, ' ')
        .trimEnd(),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Builds the direct WhatsApp launch URL (WhatsApp Web view or wa.me deep link).
 */
export function buildWhatsAppUrl(
  rawPhone: string | null | undefined,
  message?: string,
  mode: WhatsappLaunchMode = 'web',
): string | null {
  const { valid, normalized } = normalizeWhatsAppPhone(rawPhone);
  if (!valid) {
    return null;
  }

  const trimmedMsg = message?.trim() || '';
  const encodedText = trimmedMsg ? encodeURIComponent(trimmedMsg) : '';

  if (mode === 'app') {
    return encodedText
      ? `https://wa.me/${normalized}?text=${encodedText}`
      : `https://wa.me/${normalized}`;
  }

  return encodedText
    ? `https://web.whatsapp.com/send?phone=${normalized}&text=${encodedText}`
    : `https://web.whatsapp.com/send?phone=${normalized}`;
}

export type OpenWhatsAppResult =
  | { success: true; openedVia: 'desktop-webview' | 'browser-window' }
  | { success: false; error: string };

/**
 * Opens the WhatsApp Web / wa.me URL in the embedded Desktop Electron window when running
 * inside EduCenter Desktop, or in a reusable named WebView popup tab/window in web browsers.
 */
export async function openWhatsAppLink(url: string): Promise<OpenWhatsAppResult> {
  if (typeof window === 'undefined') {
    return { success: false, error: 'بيئة المتصفح غير متاحة' };
  }

  if (window.desktopApi?.openWhatsApp) {
    const res = await window.desktopApi.openWhatsApp(url);
    if (!res.success) {
      return { success: false, error: res.error || 'تعذر فتح نافذة واتساب' };
    }
    return { success: true, openedVia: 'desktop-webview' };
  }

  const popup = window.open(
    url,
    'educenter_whatsapp_webview',
    'width=1180,height=760',
  );
  if (!popup) {
    return {
      success: false,
      error: 'قام المتصفح بحظر النافذة المنبثقة لواتساب، يرجى السماح بالنوافذ المنبثقة ثم المحاولة مرة أخرى',
    };
  }

  try {
    popup.focus();
  } catch {
    // Ignore cross-origin focus restrictions
  }
  return { success: true, openedVia: 'browser-window' };
}
