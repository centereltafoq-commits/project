import { Controller, Get, Query } from '@nestjs/common';
import { PERMISSIONS } from '@edu-center/shared';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryResponse } from './dashboard.types';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @RequirePermissions(PERMISSIONS.DASHBOARD_VIEW)
  async getSummary(@Query() query: DashboardQueryDto): Promise<DashboardSummaryResponse> {
    return this.dashboardService.getSummary(query.yearMonth);
  }
}
