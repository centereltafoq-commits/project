import { printDocument } from '../../print-service';
import { ReportPrintContext, ReportTemplateResult } from './report-print-types';
import { renderStudentsReport } from './students-report';
import { renderAttendanceReport } from './attendance-report';
import { renderStudentStatementReport } from './student-statement-report';
import { renderGroupsRevenueReport } from './groups-revenue-report';
import { renderTeacherStatementReport } from './teacher-statement-report';
import { renderAssistantStatementReport } from './assistant-statement-report';
import { renderCollectionsReport } from './collections-report';
import { renderExpensesReport } from './expenses-report';
import { renderClassroomsReport } from './classrooms-report';
import { renderFinancialSummaryReport } from './financial-summary-report';

export * from './report-print-types';

export function resolveReportTemplate(ctx: ReportPrintContext): ReportTemplateResult {
  switch (ctx.slug) {
    case 'students':
      return renderStudentsReport(ctx);
    case 'attendance':
      return renderAttendanceReport(ctx);
    case 'student-statement':
      return renderStudentStatementReport(ctx);
    case 'groups-revenue':
      return renderGroupsRevenueReport(ctx);
    case 'teacher-statement':
      return renderTeacherStatementReport(ctx);
    case 'assistant-statement':
      return renderAssistantStatementReport(ctx);
    case 'collections':
      return renderCollectionsReport(ctx);
    case 'expenses':
      return renderExpensesReport(ctx);
    case 'classrooms':
      return renderClassroomsReport(ctx);
    case 'financial-summary':
      return renderFinancialSummaryReport(ctx);
    default:
      return renderStudentsReport(ctx);
  }
}

export async function printReportBySlug(ctx: ReportPrintContext): Promise<void> {
  const { bodyHtml, orientation } = resolveReportTemplate(ctx);
  await printDocument({
    title: `${ctx.title}_${ctx.yearMonth || new Date().toISOString().slice(0, 10)}`,
    bodyHtml,
    orientation,
  });
}

