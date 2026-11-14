import {
  ARABIC_MONTH_NAMES,
  YearMonthCellState,
  YearSummaryCellItem,
  YearSummaryData,
  createEmptyYearCounts,
  formatYearMonthKey,
  incrementYearCount,
} from '@/components/year-summary/year-summary.types';
import { AssistantMonthOverviewItem, AssistantProfileData } from '../assistants.types';

function toValidYearMonth(dateValue?: string | null): string | null {
  if (!dateValue) return null;
  const ym = String(dateValue).slice(0, 7);
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym) ? ym : null;
}

/**
 * Classifies all 12 months of a given calendar year for an Assistant profile,
 * distinguishing Paid / Partial / Unpaid / No Dues / Not Present (before creation) / Upcoming.
 */
export function buildAssistantYearSummary(params: {
  year: number;
  data: Pick<AssistantProfileData, 'assistant' | 'linkedGroups'>;
  monthsList: AssistantMonthOverviewItem[];
  selectedYearMonth: string;
  currentYearMonth: string;
}): YearSummaryData {
  const { year, data, monthsList, selectedYearMonth, currentYearMonth } = params;
  const monthsMap = new Map<string, AssistantMonthOverviewItem>();
  for (const item of monthsList) {
    monthsMap.set(item.yearMonth, item);
  }

  const createdYm = toValidYearMonth(data.assistant.createdAt);
  const hasActiveLinks = data.linkedGroups.some((g) => g.isActive);

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

    const isAfterOrEqualCreation = !createdYm || yearMonth >= createdYm;

    let state: YearMonthCellState;
    if (hasFinancialActivity && item) {
      state = item.payoutStatus;
    } else if (yearMonth > currentYearMonth) {
      state = 'UPCOMING';
    } else if (
      isAfterOrEqualCreation &&
      ((item && item.groupsCount > 0) || hasActiveLinks || item !== undefined)
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
      noDuesSubtitle: `${item?.groupsCount ?? data.linkedGroups.length} مجموعة`,
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
