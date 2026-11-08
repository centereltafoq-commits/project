const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export const ARABIC_DAYS = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

export function formatCurrency(
  value: number | string | null | undefined,
  symbol: string = 'ج.م',
): string {
  const num = Number(value ?? 0);
  if (Number.isNaN(num)) return `0 ${symbol}`;
  return `${num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${symbol}`;
}

export function formatYearMonthAr(yearMonth: string): string {
  if (!yearMonth || !yearMonth.includes('-')) return yearMonth;
  const [year, monthStr] = yearMonth.split('-');
  const idx = Number(monthStr) - 1;
  if (idx < 0 || idx > 11) return yearMonth;
  return `${ARABIC_MONTHS[idx]} ${year}`;
}

export function getCurrentYearMonth(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
}

export function getTodayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateAr(isoDate: string | Date | null | undefined): string {
  if (!isoDate || isoDate === 'null' || isoDate === 'undefined') return '—';
  const d =
    typeof isoDate === 'string'
      ? /^\d{4}-\d{2}-\d{2}$/.test(isoDate)
        ? new Date(`${isoDate}T00:00:00`)
        : new Date(isoDate)
      : isoDate;
  if (Number.isNaN(d.getTime())) return String(isoDate);
  return d.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format any time string ('14:30', '14:30:00', ISO string, or Date)
 * into friendly 12-hour Arabic format with ص (صباحاً) / م (مساءً)
 * Examples: '14:30' -> '02:30 م', '09:00' -> '09:00 ص'
 */
export function formatTimeAr(time: string | Date | null | undefined): string {
  if (!time) return '—';

  let hours: number;
  let minutes: number;

  if (time instanceof Date) {
    if (Number.isNaN(time.getTime())) return '—';
    hours = time.getHours();
    minutes = time.getMinutes();
  } else if (typeof time === 'string') {
    const trimmed = time.trim();
    if (trimmed.includes('T')) {
      const d = new Date(trimmed);
      if (Number.isNaN(d.getTime())) return trimmed;
      hours = d.getHours();
      minutes = d.getMinutes();
    } else if (trimmed.includes(':')) {
      const parts = trimmed.split(':');
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10);
      if (Number.isNaN(hours) || Number.isNaN(minutes)) return trimmed;
    } else {
      return trimmed;
    }
  } else {
    return String(time);
  }

  const period = hours >= 12 ? 'م' : 'ص';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${pad(h12)}:${pad(minutes)} ${period}`;
}

/**
 * Formats a time range, e.g. ('14:00', '16:00') -> '02:00 م - 04:00 م'
 */
export function formatTimeRangeAr(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): string {
  if (!startTime && !endTime) return '—';
  if (startTime && !endTime) return formatTimeAr(startTime);
  if (!startTime && endTime) return formatTimeAr(endTime);
  return `${formatTimeAr(startTime)} إلى ${formatTimeAr(endTime)}`;
}

/**
 * Format date & time into complete Arabic representation
 * Example: '07 نوفمبر 2026، 02:30 م'
 */
export function formatDateTimeAr(isoDate: string | Date | null | undefined): string {
  if (!isoDate || isoDate === 'null' || isoDate === 'undefined') return '—';
  const d = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
  if (Number.isNaN(d.getTime())) return String(isoDate);

  const datePart = formatDateAr(d);
  const timePart = formatTimeAr(d);
  return `${datePart} - ${timePart}`;
}
