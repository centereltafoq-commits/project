import {
  StudentMonthOverviewItem,
  StudentProfileData,
} from '../students.types';

export type YearMonthCellState =
  | 'PAID'
  | 'PARTIAL'
  | 'UNPAID'
  | 'NO_DUES'
  | 'NOT_PRESENT'
  | 'UPCOMING';

export interface StudentYearMonthCell {
  yearMonth: string;
  monthNumber: number;
  monthName: string;
  state: YearMonthCellState;
  totalDue: number;
  totalPaid: number;
  remaining: number;
  groupsCount: number;
  paymentsCount: number;
  presentCount: number;
  totalSessions: number;
  isClosed: boolean;
  isCurrentMonth: boolean;
}

export interface StudentYearSummaryData {
  year: number;
  availableYears: number[];
  cells: StudentYearMonthCell[];
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

export function extractStudentAvailableYears(params: {
  registrationDate?: string | null;
  monthsList: StudentMonthOverviewItem[];
  selectedYearMonth: string;
  currentYearMonth: string;
}): number[] {
  const years = new Set<number>();

  const tryAddYear = (ymOrDate?: string | null) => {
    if (!ymOrDate) return;
    const y = Number(ymOrDate.slice(0, 4));
    if (Number.isInteger(y) && y >= 2000 && y <= 2100) {
      years.add(y);
    }
  };

  tryAddYear(params.currentYearMonth);
  tryAddYear(params.selectedYearMonth);
  tryAddYear(params.registrationDate);
  for (const m of params.monthsList) {
    tryAddYear(m.yearMonth);
  }

  return Array.from(years).sort((a, b) => a - b);
}

export function buildStudentYearSummary(params: {
  year: number;
  data: StudentProfileData;
  monthsList: StudentMonthOverviewItem[];
  selectedYearMonth: string;
  currentYearMonth: string;
}): StudentYearSummaryData {
  const { year, data, monthsList, selectedYearMonth, currentYearMonth } = params;
  const monthMap = new Map(monthsList.map((m) => [m.yearMonth, m]));
  const registrationYm = data.student.registrationDate
    ? data.student.registrationDate.slice(0, 7)
    : '';

  const availableYears = extractStudentAvailableYears({
    registrationDate: data.student.registrationDate,
    monthsList,
    selectedYearMonth,
    currentYearMonth,
  });

  const cells: StudentYearMonthCell[] = [];
  const counts = {
    paid: 0,
    partial: 0,
    unpaid: 0,
    noDues: 0,
    notPresent: 0,
    upcoming: 0,
  };
  let totalDueSum = 0;
  let totalPaidSum = 0;
  let remainingSum = 0;

  for (let m = 1; m <= 12; m++) {
    const ym = `${year}-${String(m).padStart(2, '0')}`;
    const item = monthMap.get(ym);

    const hasActiveEnrollmentInMonth = (data.enrollments ?? []).some((enr) => {
      const startYm = enr.startDate ? enr.startDate.slice(0, 7) : '';
      const endYm = enr.endDate ? enr.endDate.slice(0, 7) : '9999-12';
      return (!startYm || startYm <= ym) && endYm >= ym;
    });

    const hasFinancialOrSessionActivity =
      Boolean(item) &&
      (item!.totalDue > 0.009 ||
        item!.totalPaid > 0.009 ||
        item!.paymentsCount > 0 ||
        item!.totalSessions > 0 ||
        item!.groupsCount > 0);

    let state: YearMonthCellState;
    if (hasFinancialOrSessionActivity && item) {
      state = item.paymentStatus;
    } else if (ym > currentYearMonth && !hasActiveEnrollmentInMonth) {
      state = 'UPCOMING';
    } else if (registrationYm && ym < registrationYm) {
      state = 'NOT_PRESENT';
    } else if (!hasActiveEnrollmentInMonth) {
      state = 'NOT_PRESENT';
    } else {
      state = 'NO_DUES';
    }

    if (state === 'PAID') counts.paid += 1;
    else if (state === 'PARTIAL') counts.partial += 1;
    else if (state === 'UNPAID') counts.unpaid += 1;
    else if (state === 'NO_DUES') counts.noDues += 1;
    else if (state === 'NOT_PRESENT') counts.notPresent += 1;
    else if (state === 'UPCOMING') counts.upcoming += 1;

    const totalDue = item?.totalDue ?? 0;
    const totalPaid = item?.totalPaid ?? 0;
    const remaining = item?.remaining ?? 0;

    totalDueSum += totalDue;
    totalPaidSum += totalPaid;
    remainingSum += remaining;

    cells.push({
      yearMonth: ym,
      monthNumber: m,
      monthName: ARABIC_MONTH_NAMES[m - 1]!,
      state,
      totalDue,
      totalPaid,
      remaining,
      groupsCount: item?.groupsCount ?? 0,
      paymentsCount: item?.paymentsCount ?? 0,
      presentCount: item?.presentCount ?? 0,
      totalSessions: item?.totalSessions ?? 0,
      isClosed: item?.isClosed ?? false,
      isCurrentMonth: ym === currentYearMonth,
    });
  }

  return {
    year,
    availableYears,
    cells,
    counts,
    totals: {
      totalDue: Number(totalDueSum.toFixed(2)),
      totalPaid: Number(totalPaidSum.toFixed(2)),
      remaining: Number(remainingSum.toFixed(2)),
    },
  };
}
