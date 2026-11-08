import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { PERMISSIONS } from '@edu-center/shared';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('filter-options')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  async getFilterOptions(@CurrentUser() actor: AuthenticatedUser) {
    return this.reportsService.getFilterOptions(actor);
  }

  @Get(':reportType/export-csv')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_EXPORT)
  async exportCsv(
    @Param('reportType') reportType: string,
    @Query() query: ReportQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Res() res: Response,
  ) {
    const { filename, content } = await this.reportsService.exportReportCsv(
      reportType,
      query,
      actor,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  }

  @Get(':reportType')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  async getReport(
    @Param('reportType') reportType: string,
    @Query() query: ReportQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.reportsService.generateReport(reportType, query, actor);
  }
}
