import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PERMISSIONS, SystemRole } from '@edu-center/shared';
import { CacheService } from '../../common/cache/cache.module';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { normalizePagination } from '../../common/utils/pagination.util';
import { REPORT_TYPES, ReportQueryDto, ReportType } from './dto/report-query.dto';
import { AcademicReportsRepository } from './repositories/academic-reports.repository';
import { CashflowReportsRepository } from './repositories/cashflow-reports.repository';
import { FinanceStatementsRepository } from './repositories/finance-statements.repository';
import { FinancialSummaryRepository } from './repositories/financial-summary.repository';
import { OperationsReportsRepository } from './repositories/operations-reports.repository';
import { StaffStatementsRepository } from './repositories/staff-statements.repository';
import {
  MAX_EXPORT_ROWS,
  NormalizedReportPagination,
  ReportFilterOptionsResponse,
  ReportPayload,
} from './reports.types';
import { buildUtf8BomCsv } from './utils/csv-exporter.util';
import { REPORT_TITLES_AR } from './utils/report-labels.util';

@Injectable()
export class ReportsService {
  constructor(
    private readonly academicRepo: AcademicReportsRepository,
    private readonly operationsRepo: OperationsReportsRepository,
    private readonly financeStatementsRepo: FinanceStatementsRepository,
    private readonly staffStatementsRepo: StaffStatementsRepository,
    private readonly cashflowRepo: CashflowReportsRepository,
    private readonly financialSummaryRepo: FinancialSummaryRepository,
    private readonly cache: CacheService,
  ) {}

  async getFilterOptions(): Promise<ReportFilterOptionsResponse> {
    const cacheKey = 'reports:filter-options';
    const cached = await this.cache.get<ReportFilterOptionsResponse>(cacheKey);
    if (cached) return cached;

    const result = await this.academicRepo.getFilterOptions();
    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  async generateReport(
    rawReportType: string,
    query: ReportQueryDto,
    actor: AuthenticatedUser,
  ): Promise<ReportPayload> {
    const reportType = this.validateReportType(rawReportType);
    const isExport = query.exportAll === 'true';

    if (
      isExport &&
      actor.roleCode !== SystemRole.OWNER &&
      !actor.permissions.includes(PERMISSIONS.REPORTS_EXPORT)
    ) {
      throw new ForbiddenException('ليس لديك صلاحية تصدير أو طباعة التقارير الكاملة');
    }

    const pg = this.resolvePagination(query, isExport);
    const yearMonth = query.yearMonth || this.getCurrentYearMonth();
    const baseResult = await this.dispatchReportQuery(reportType, query, yearMonth, pg);

    return {
      reportType,
      titleAr: REPORT_TITLES_AR[reportType],
      yearMonth,
      generatedAt: new Date().toISOString(),
      ...baseResult,
    };
  }

  async exportReportCsv(
    rawReportType: string,
    query: ReportQueryDto,
    actor: AuthenticatedUser,
  ): Promise<{ filename: string; content: string }> {
    const payload = await this.generateReport(
      rawReportType,
      { ...query, exportAll: 'true' },
      actor,
    );
    const csvContent = buildUtf8BomCsv(
      payload.reportType,
      payload.data as Array<Record<string, unknown>>,
    );
    const filename = `${payload.reportType}-${payload.yearMonth}.csv`;
    return { filename, content: csvContent };
  }

  private validateReportType(raw: string): ReportType {
    if ((REPORT_TYPES as readonly string[]).includes(raw)) {
      return raw as ReportType;
    }
    throw new BadRequestException(`نوع التقرير غير معروف: ${raw}`);
  }

  private resolvePagination(query: ReportQueryDto, isExport: boolean): NormalizedReportPagination {
    if (isExport) {
      return { page: 1, limit: MAX_EXPORT_ROWS, offset: 0, isExport: true };
    }
    const norm = normalizePagination(query.page, query.limit);
    return { ...norm, isExport: false };
  }

  private getCurrentYearMonth(): string {
    const now = new Date();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${now.getFullYear()}-${m}`;
  }

  private async dispatchReportQuery(
    reportType: ReportType,
    query: ReportQueryDto,
    yearMonth: string,
    pg: NormalizedReportPagination,
  ) {
    switch (reportType) {
      case 'students':
        return this.academicRepo.getStudentsReport(query, pg);
      case 'attendance':
        return this.academicRepo.getAttendanceReport(query, yearMonth, pg);
      case 'student-statement':
        return this.financeStatementsRepo.getStudentStatementReport(query, yearMonth, pg);
      case 'groups-revenue':
        return this.financeStatementsRepo.getGroupsRevenueReport(query, yearMonth, pg);
      case 'teacher-statement':
        return this.staffStatementsRepo.getTeacherStatementReport(query, yearMonth, pg);
      case 'assistant-statement':
        return this.staffStatementsRepo.getAssistantStatementReport(query, yearMonth, pg);
      case 'collections':
        return this.cashflowRepo.getCollectionsReport(query, yearMonth, pg);
      case 'expenses':
        return this.cashflowRepo.getExpensesReport(query, yearMonth, pg);
      case 'bookings':
        return this.operationsRepo.getBookingsReport(query, yearMonth, pg);
      case 'classrooms':
        return this.operationsRepo.getClassroomsReport(query, yearMonth, pg);
      case 'financial-summary':
        return this.financialSummaryRepo.getFinancialSummaryReport(yearMonth);
    }
  }
}
