import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { FinanceSettlementController } from './finance-settlement.controller';
import { FinanceTransactionsController } from './finance-transactions.controller';
import { MonthlySettlementService } from './monthly-settlement.service';
import { PaymentsService } from './payments.service';
import { PayoutsService } from './payouts.service';
import { AssistantPayoutsRepository } from './repositories/assistant-payouts.repository';
import { ExpensesRepository } from './repositories/expenses.repository';
import { FinanceOverviewRepository } from './repositories/finance-overview.repository';
import { MonthlySettlementReadRepository } from './repositories/monthly-settlement-read.repository';
import { MonthlySettlementWriteRepository } from './repositories/monthly-settlement-write.repository';
import { PaymentsQueryRepository } from './repositories/payments-query.repository';
import { PaymentsRepository } from './repositories/payments.repository';
import { StaffRecordsRepository } from './repositories/staff-records.repository';
import { StudentRecordsRepository } from './repositories/student-records.repository';
import { TeacherPayoutsRepository } from './repositories/teacher-payouts.repository';

@Module({
  controllers: [FinanceSettlementController, FinanceTransactionsController],
  providers: [
    FinanceOverviewRepository,
    MonthlySettlementReadRepository,
    StudentRecordsRepository,
    StaffRecordsRepository,
    MonthlySettlementWriteRepository,
    PaymentsQueryRepository,
    PaymentsRepository,
    TeacherPayoutsRepository,
    AssistantPayoutsRepository,
    ExpensesRepository,
    MonthlySettlementService,
    PaymentsService,
    PayoutsService,
    ExpensesService,
  ],
  exports: [
    MonthlySettlementService,
    PaymentsService,
    PayoutsService,
    ExpensesService,
  ],
})
export class FinanceModule {}
