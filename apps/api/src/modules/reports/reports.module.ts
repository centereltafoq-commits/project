import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { AcademicReportsRepository } from './repositories/academic-reports.repository';
import { CashflowReportsRepository } from './repositories/cashflow-reports.repository';
import { FinanceStatementsRepository } from './repositories/finance-statements.repository';
import { FinancialSummaryRepository } from './repositories/financial-summary.repository';
import { OperationsReportsRepository } from './repositories/operations-reports.repository';
import { StaffStatementsRepository } from './repositories/staff-statements.repository';

@Module({
  controllers: [ReportsController],
  providers: [
    AcademicReportsRepository,
    OperationsReportsRepository,
    FinanceStatementsRepository,
    StaffStatementsRepository,
    CashflowReportsRepository,
    FinancialSummaryRepository,
    ReportsService,
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
