import { TableColumn } from '@/design-system';
import { formatCurrency } from '@/lib/formatters';
import { ReportSummaryKpiItem, ReportTypeSlug } from '../reports.types';
import {
  getAttendanceColumns,
  getBookingsColumns,
  getClassroomsColumns,
  getStudentsColumns,
} from './academic-ops-columns';
import {
  getCollectionsColumns,
  getExpensesColumns,
  getFinancialSummaryColumns,
} from './cashflow-columns';
import {
  getAssistantStatementColumns,
  getGroupsRevenueColumns,
  getStudentStatementColumns,
  getTeacherStatementColumns,
} from './finance-columns';

export function resolveReportColumns(
  slug: ReportTypeSlug,
): TableColumn<Record<string, unknown>>[] {
  switch (slug) {
    case 'students':
      return getStudentsColumns();
    case 'attendance':
      return getAttendanceColumns();
    case 'student-statement':
      return getStudentStatementColumns();
    case 'groups-revenue':
      return getGroupsRevenueColumns();
    case 'teacher-statement':
      return getTeacherStatementColumns();
    case 'assistant-statement':
      return getAssistantStatementColumns();
    case 'collections':
      return getCollectionsColumns();
    case 'expenses':
      return getExpensesColumns();
    case 'bookings':
      return getBookingsColumns();
    case 'classrooms':
      return getClassroomsColumns();
    case 'financial-summary':
      return getFinancialSummaryColumns();
  }
}

export function formatReportKpiValue(item: ReportSummaryKpiItem): string | number {
  if (item.format === 'currency') return formatCurrency(item.value);
  if (item.format === 'percent') return `${item.value}%`;
  return item.value;
}
