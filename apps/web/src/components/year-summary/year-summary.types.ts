export type YearMonthCellState =
  | 'PAID'
  | 'PARTIAL'
  | 'UNPAID'
  | 'NO_DUES'
  | 'NOT_PRESENT'
  | 'UPCOMING';

export const ARABIC_MONTH_NAMES = [
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
] as const;

export interface YearSummaryCellItem {
  yearMonth: string;
  monthNumber: number;
  monthName: string;
  state: YearMonthCellState;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isClosed: boolean;
  paidAmount: number;
  remainingAmount: number;
  noDuesSubtitle?: string;
  restrictedLabel?: string;
}

export interface YearSummaryData {
  year: number;
  cells: YearSummaryCellItem[];
  counts: {
    paid: number;
    partial: number;
    unpaid: number;
    noDues: number;
    notPresent: number;
    upcoming: number;
  };
  totals: {
    totalDue: number;
    totalPaid: number;
    remaining: number;
  };
}

export interface YearSummaryLabels {
  paidBadge: string;
  partialBadge: string;
  unpaidBadge: string;
  noDuesBadge: string;
  notPresentBadge: string;
  upcomingBadge: string;
  paidSummaryLabel: string;
  unpaidSummaryLabel: string;
  notPresentSummaryLabel: string;
  remainingYearLabel: string;
  partialAmountPrefix: string;
  unpaidAmountPrefix: string;
}

export const STUDENT_YEAR_SUMMARY_LABELS: YearSummaryLabels = {
  paidBadge: 'مدفوع',
  partialBadge: 'مدفوع جزئياً',
  unpaidBadge: 'غير مدفوع',
  noDuesBadge: 'بدون مستحقات',
  notPresentBadge: 'لم يكن موجوداً',
  upcomingBadge: 'شهر قادم',
  paidSummaryLabel: 'مدفوع',
  unpaidSummaryLabel: 'غير مدفوع / جزئي',
  notPresentSummaryLabel: 'لم يكن موجوداً',
  remainingYearLabel: 'متبقي السنة',
  partialAmountPrefix: 'متبقي',
  unpaidAmountPrefix: 'عليه',
};

export const PAYOUT_YEAR_SUMMARY_LABELS: YearSummaryLabels = {
  paidBadge: 'تم الصرف',
  partialBadge: 'صرف جزئي',
  unpaidBadge: 'لم يُصرف',
  noDuesBadge: 'بدون مستحقات',
  notPresentBadge: 'لم يكن موجوداً',
  upcomingBadge: 'شهر قادم',
  paidSummaryLabel: 'تم الصرف',
  unpaidSummaryLabel: 'بانتظار الصرف / جزئي',
  notPresentSummaryLabel: 'لم يكن موجوداً',
  remainingYearLabel: 'متبقي الصرف للسنة',
  partialAmountPrefix: 'متبقي',
  unpaidAmountPrefix: 'مستحق',
};

export function createEmptyYearCounts() {
  return {
    paid: 0,
    partial: 0,
    unpaid: 0,
    noDues: 0,
    notPresent: 0,
    upcoming: 0,
  };
}

export function incrementYearCount(
  counts: ReturnType<typeof createEmptyYearCounts>,
  state: YearMonthCellState,
) {
  if (state === 'PAID') counts.paid += 1;
  else if (state === 'PARTIAL') counts.partial += 1;
  else if (state === 'UNPAID') counts.unpaid += 1;
  else if (state === 'NO_DUES') counts.noDues += 1;
  else if (state === 'NOT_PRESENT') counts.notPresent += 1;
  else counts.upcoming += 1;
}

export function formatYearMonthKey(year: number, monthNumber: number): string {
  return `${year}-${String(monthNumber).padStart(2, '0')}`;
}
