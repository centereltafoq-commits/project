import {
  ARABIC_MONTH_NAMES,
  YearMonthCellState,
  YearSummaryCellItem,
  YearSummaryData,
  createEmptyYearCounts,
  formatYearMonthKey,
  incrementYearCount,
} from '@/components/year-summary/year-summary.types';
import { TeacherMonthOverviewItem, TeacherProfileData } from '../teachers.types';

function toValidYearMonth(dateValue?: string | null): string | null {
  if (!dateValue) return null;
  const ym = String(dateValue).slice(0, 7);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym) ? ym : null;
}

/**
 * Classifies all 12 months of a given calendar year for a Teacher profile,
 * distinguishing Paid / Partial / Unpaid / No Dues / Not Present (before contract) / Upcoming.
 */
export function buildTeacherYearSummary(params: {
  year: number;
  data: {
    teacher: Pick<TeacherProfileData['teacher'], 'contractDate'>;
    assignedGroups: Array<{ isActive: boolean }>;
  };
  monthsList: TeacherMonthOverviewItem[];
  selectedYearMonth: string;
  currentYearMonth: string;
}): YearSummaryData {
  const { year, data, monthsList, selectedYearMonth, currentYearMonth } = params;
  const monthsMap = new Map<string, TeacherMonthOverviewItem>();
  for (const item of monthsList) {
    monthsMap.set(item.yearMonth, item);
  }

  const contractYm = toValidYearMonth(data.teacher.contractDate);
  const hasActiveGroups = data.assignedGroups.some((g) => g.isActive);

  const counts = createEmptyYearCounts();
  let totalDue = 0;
  let totalPaid = 0;
  let remaining = 0;

  const cells: YearSummaryCellItem[] = ARABIC_MONTH_NAMES.map((monthName, idx) => {
    const monthNumber = idx + 1;
    const yearMonth = formatYearMonthKey(year, monthNumber);
    const item = monthsMap.get(yearMonth);

    const hasFinancialActivity = Boolean(
      item &&
        (item.totalDues > 0.009 ||
          item.totalPayouts > 0.009 ||
          item.payoutsCount > 0 ||
          item.executedSessionsCount > 0 ||
          item.isClosed),
    );

    const isAfterOrEqualContract = !contractYm || yearMonth >= contractYm;

    let state: YearMonthCellState;
    if (hasFinancialActivity && item) {
      state = item.payoutStatus;
    } else if (yearMonth > currentYearMonth) {
      state = 'UPCOMING';
    } else if (
      isAfterOrEqualContract &&
      ((item && item.groupsCount > 0) || hasActiveGroups)
    ) {
      state = 'NO_DUES';
    } else {
      state = 'NOT_PRESENT';
    }

    incrementYearCount(counts, state);

    const monthDue = item?.totalDues ?? 0;
    const monthPaid = item?.totalPayouts ?? 0;
    const monthRemaining = item?.remainingBalance ?? 0;

    if (hasFinancialActivity) {
      totalDue += monthDue;
      totalPaid += monthPaid;
      remaining += monthRemaining;
    }

    return {
      yearMonth,
      monthNumber,
      monthName,
      state,
      isCurrentMonth: yearMonth === currentYearMonth,
      isSelected: yearMonth === selectedYearMonth,
      isClosed: item?.isClosed ?? false,
      paidAmount: monthPaid,
      remainingAmount: monthRemaining,
      noDuesSubtitle: `${item?.groupsCount ?? data.assignedGroups.length} مجموعة`,
      restrictedLabel: `${item?.executedSessionsCount ?? 0} حصة`,
    };
  });

  return {
    year,
    cells,
    counts,
    totals: {
      totalDue: Math.round(totalDue * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
    },
  };
}
