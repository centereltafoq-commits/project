import { TableColumn } from '@/design-system';
import { formatCurrency } from '@/lib/formatters';
import { ReportSummaryKpiItem, ReportTypeSlug } from '../reports.types';
import {
  getAttendanceColumns,
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
  let cols: TableColumn<Record<string, unknown>>[];
  switch (slug) {
    case 'students':
      cols = getStudentsColumns();
      break;
    case 'attendance':
      cols = getAttendanceColumns();
      break;
    case 'student-statement':
      cols = getStudentStatementColumns();
      break;
    case 'groups-revenue':
      cols = getGroupsRevenueColumns();
      break;
    case 'teacher-statement':
      cols = getTeacherStatementColumns();
      break;
    case 'assistant-statement':
      cols = getAssistantStatementColumns();
      break;
    case 'collections':
      cols = getCollectionsColumns();
      break;
    case 'expenses':
      cols = getExpensesColumns();
      break;
    case 'classrooms':
      cols = getClassroomsColumns();
      break;
    case 'financial-summary':
      cols = getFinancialSummaryColumns();
      break;
  }

  return cols.map((col) => ({
    ...col,
    className: col.className ? `${col.className} whitespace-nowrap` : 'whitespace-nowrap',
  }));
}

export function formatReportKpiValue(item: ReportSummaryKpiItem): string | number {
  if (item.format === 'currency') return formatCurrency(item.value);
  if (item.format === 'percent') return `${item.value}%`;
  return item.value;
}
