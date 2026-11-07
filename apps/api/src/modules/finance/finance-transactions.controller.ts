import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PERMISSIONS } from '@edu-center/shared';
import {
  AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  CreateExpenseDto,
  ExpensesQueryDto,
  UpdateExpenseDto,
} from './dto/expenses.dto';
import {
  AssistantPayoutsQueryDto,
  CreateAssistantPayoutDto,
  CreatePaymentDto,
  CreateTeacherPayoutDto,
  PaymentsQueryDto,
  TeacherPayoutsQueryDto,
} from './dto/payments-payouts.dto';
import { ExpensesService } from './expenses.service';
import { PaymentsService } from './payments.service';
import { PayoutsService } from './payouts.service';

@Controller('finance')
export class FinanceTransactionsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly payoutsService: PayoutsService,
    private readonly expensesService: ExpensesService,
  ) {}

  @Get('payments')
  @RequirePermissions(PERMISSIONS.FINANCE_VIEW)
  async listPayments(@Query() query: PaymentsQueryDto) {
    return this.paymentsService.list(query);
  }

  @Post('payments')
  @RequirePermissions(PERMISSIONS.FINANCE_COLLECT_PAYMENT)
  async collectPayment(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.paymentsService.collectPayment(dto, actor);
  }

  @Get('teacher-payouts')
  @RequirePermissions(PERMISSIONS.FINANCE_VIEW)
  async listTeacherPayouts(@Query() query: TeacherPayoutsQueryDto) {
    return this.payoutsService.listTeacherPayouts(query);
  }

  @Post('teacher-payouts')
  @RequirePermissions(PERMISSIONS.FINANCE_PAYOUTS)
  async recordTeacherPayout(
    @Body() dto: CreateTeacherPayoutDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.payoutsService.recordTeacherPayout(dto, actor);
  }

  @Get('assistant-payouts')
  @RequirePermissions(PERMISSIONS.FINANCE_VIEW)
  async listAssistantPayouts(@Query() query: AssistantPayoutsQueryDto) {
    return this.payoutsService.listAssistantPayouts(query);
  }

  @Post('assistant-payouts')
  @RequirePermissions(PERMISSIONS.FINANCE_PAYOUTS)
  async recordAssistantPayout(
    @Body() dto: CreateAssistantPayoutDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.payoutsService.recordAssistantPayout(dto, actor);
  }

  @Get('expenses')
  @RequirePermissions(PERMISSIONS.FINANCE_VIEW)
  async listExpenses(@Query() query: ExpensesQueryDto) {
    return this.expensesService.list(query);
  }

  @Post('expenses')
  @RequirePermissions(PERMISSIONS.FINANCE_EXPENSES)
  async createExpense(
    @Body() dto: CreateExpenseDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.expensesService.create(dto, actor);
  }

  @Patch('expenses/:id')
  @RequirePermissions(PERMISSIONS.FINANCE_EXPENSES)
  async updateExpense(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.expensesService.update(id, dto, actor);
  }

  @Delete('expenses/:id')
  @RequirePermissions(PERMISSIONS.FINANCE_EXPENSES)
  async removeExpense(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.expensesService.remove(id, actor);
  }
}
