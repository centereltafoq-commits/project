import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PERMISSIONS } from '@edu-center/shared';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
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
  @RequireAnyPermissions(
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_COLLECT_PAYMENT,
    PERMISSIONS.FINANCE_PAYOUTS,
    PERMISSIONS.FINANCE_EXPENSES,
  )
  async getLookups(@CurrentUser() actor: AuthenticatedUser) {
    return this.monthlySettlementService.getLookups(actor);
  }

  @Get('month-summary')
  @RequireAnyPermissions(
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_COLLECT_PAYMENT,
    PERMISSIONS.FINANCE_PAYOUTS,
    PERMISSIONS.FINANCE_EXPENSES,
  )
  async getMonthSummary(
    @Query() query: YearMonthQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.monthlySettlementService.getMonthSummary(query.yearMonth, actor);
  }

  @Post('recalculate-month')
  @RequireAnyPermissions(
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_COLLECT_PAYMENT,
    PERMISSIONS.FINANCE_PAYOUTS,
    PERMISSIONS.FINANCE_CLOSE_MONTH,
  )
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
  @RequireAnyPermissions(PERMISSIONS.FINANCE_VIEW, PERMISSIONS.FINANCE_COLLECT_PAYMENT)
  async listStudentRecords(@Query() query: StudentRecordsQueryDto) {
    return this.monthlySettlementService.listStudentRecords(query);
  }

  @Get('teacher-records')
  @RequireAnyPermissions(PERMISSIONS.FINANCE_VIEW, PERMISSIONS.FINANCE_PAYOUTS)
  async listTeacherRecords(@Query() query: TeacherRecordsQueryDto) {
    return this.monthlySettlementService.listTeacherRecords(query);
  }

  @Get('assistant-records')
  @RequireAnyPermissions(PERMISSIONS.FINANCE_VIEW, PERMISSIONS.FINANCE_PAYOUTS)
  async listAssistantRecords(@Query() query: AssistantRecordsQueryDto) {
    return this.monthlySettlementService.listAssistantRecords(query);
  }
}
