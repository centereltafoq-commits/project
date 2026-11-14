import * as React from 'react';
import { YearSummaryGrid } from '@/components/year-summary/year-summary-grid';
import {
  STUDENT_YEAR_SUMMARY_LABELS,
  YearSummaryData,
} from '@/components/year-summary/year-summary.types';
import { StudentYearSummaryData } from './student-year-grid.helper';

interface StudentYearSummaryGridProps {
  summary: StudentYearSummaryData;
  selectedYearMonth: string;
  canViewFinance: boolean;
  onChangeYear: (year: number) => void;
  onSelectMonth: (yearMonth: string) => void;
}

export function StudentYearSummaryGrid({
  summary,
  selectedYearMonth,
  canViewFinance,
  onChangeYear,
  onSelectMonth,
}: StudentYearSummaryGridProps) {
  const mappedSummary: YearSummaryData = React.useMemo(
    () => ({
      year: summary.year,
      counts: summary.counts,
      totals: summary.totals,
      cells: summary.cells.map((cell) => ({
        yearMonth: cell.yearMonth,
        monthNumber: cell.monthNumber,
        monthName: cell.monthName,
        state: cell.state,
        isCurrentMonth: cell.isCurrentMonth,
        isSelected: cell.yearMonth === selectedYearMonth,
        isClosed: cell.isClosed,
        paidAmount: cell.totalPaid,
        remainingAmount: cell.remaining,
        noDuesSubtitle: `${cell.groupsCount} مجموعة`,
        restrictedLabel: `${cell.presentCount}/${cell.totalSessions} حصة`,
      })),
    }),
    [summary],
  );

  return (
    <YearSummaryGrid
      summary={mappedSummary}
      selectedYearMonth={selectedYearMonth}
      canViewFinance={canViewFinance}
      onChangeYear={onChangeYear}
      onSelectMonth={onSelectMonth}
      labels={STUDENT_YEAR_SUMMARY_LABELS}
    />
  );
}
