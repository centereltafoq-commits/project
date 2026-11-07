import { randomBytes } from 'crypto';

/**
 * Rounds monetary amounts cleanly to 2 decimal places using Number.EPSILON
 * to prevent IEEE-754 floating-point drift.
 */
export function roundMoney(val: number): number {
  if (!Number.isFinite(val) || val === 0) return 0;
  if (val < 0) {
    return -Math.round((Math.abs(val) + Number.EPSILON) * 100) / 100;
  }
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function parseMoney(val: string | number | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0;
  const parsed = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(parsed) ? roundMoney(parsed) : 0;
}

export function toMoneyString(val: number): string {
  return roundMoney(val).toFixed(2);
}

export function getMonthDateBounds(yearMonth: string): {
  monthStart: string;
  monthEnd: string;
} {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const paddedMonth = String(month).padStart(2, '0');
  const paddedDay = String(lastDay).padStart(2, '0');

  return {
    monthStart: `${year}-${paddedMonth}-01`,
    monthEnd: `${year}-${paddedMonth}-${paddedDay}`,
  };
}

const ALPHANUMERIC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateReferenceCode(
  prefix: 'RCP' | 'TPY' | 'APY',
  yearMonth: string,
  suffixLength = 6,
): string {
  const compactMonth = yearMonth.replace('-', '');
  const bytes = randomBytes(suffixLength);
  let suffix = '';
  for (let i = 0; i < suffixLength; i += 1) {
    suffix += ALPHANUMERIC[bytes[i]! % ALPHANUMERIC.length];
  }
  return `${prefix}-${compactMonth}-${suffix}`;
}
