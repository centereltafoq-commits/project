import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@edu-center/shared';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  AssistantRecordsQueryDto,
  StudentRecordsQueryDto,
  TeacherRecordsQueryDto,
  YearMonthBodyDto,
  YearMonthQueryDto,
} from './dto/settlement.dto';
import { MonthlySettlementService } from './monthly-settlement.service';

@Controller('finance')
export class FinanceSettlementController {
  constructor(
    private readonly monthlySettlementService: MonthlySettlementService,
  ) {}

  @Get('lookups')
  @RequirePermissions(PERMISSIONS.FINANCE_VIEW)
  async getLookups() {
    return this.monthlySettlementService.getLookups();
  }

  @Get('month-summary')
  @RequirePermissions(PERMISSIONS.FINANCE_VIEW)
  async getMonthSummary(@Query() query: YearMonthQueryDto) {
    return this.monthlySettlementService.getMonthSummary(query.yearMonth);
  }

  @Post('recalculate-month')
  @RequirePermissions(PERMISSIONS.FINANCE_VIEW)
  async recalculateMonth(
    @Body() dto: YearMonthBodyDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.monthlySettlementService.recalculateMonth(dto.yearMonth, actor);
  }

  @Post('close-month')
  @RequirePermissions(PERMISSIONS.FINANCE_CLOSE_MONTH)
  async closeMonth(
    @Body() dto: YearMonthBodyDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.monthlySettlementService.closeMonth(dto.yearMonth, actor);
  }

  @Get('student-records')
  @RequirePermissions(PERMISSIONS.FINANCE_VIEW)
  async listStudentRecords(@Query() query: StudentRecordsQueryDto) {
    return this.monthlySettlementService.listStudentRecords(query);
  }

  @Get('teacher-records')
  @RequirePermissions(PERMISSIONS.FINANCE_VIEW)
  async listTeacherRecords(@Query() query: TeacherRecordsQueryDto) {
    return this.monthlySettlementService.listTeacherRecords(query);
  }

  @Get('assistant-records')
  @RequirePermissions(PERMISSIONS.FINANCE_VIEW)
  async listAssistantRecords(@Query() query: AssistantRecordsQueryDto) {
    return this.monthlySettlementService.listAssistantRecords(query);
  }
}
