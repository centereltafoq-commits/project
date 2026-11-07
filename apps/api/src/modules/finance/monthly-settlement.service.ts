import { Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { buildStaffSettlementBatch } from './calculators/staff-batch.builder';
import { buildStudentSettlementBatch } from './calculators/student-batch.builder';
import {
  AssistantRecordsQueryDto,
  StudentRecordsQueryDto,
  TeacherRecordsQueryDto,
} from './dto/settlement.dto';
import { FinanceOverviewRepository } from './repositories/finance-overview.repository';
import { MonthlySettlementReadRepository } from './repositories/monthly-settlement-read.repository';
import { MonthlySettlementWriteRepository } from './repositories/monthly-settlement-write.repository';
import { StaffRecordsRepository } from './repositories/staff-records.repository';
import { StudentRecordsRepository } from './repositories/student-records.repository';

@Injectable()
export class MonthlySettlementService {
  constructor(
    private readonly overviewRepo: FinanceOverviewRepository,
    private readonly readRepo: MonthlySettlementReadRepository,
    private readonly studentRecordsRepo: StudentRecordsRepository,
    private readonly staffRecordsRepo: StaffRecordsRepository,
    private readonly writeRepo: MonthlySettlementWriteRepository,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async getLookups() {
    return this.overviewRepo.fetchFinanceLookups();
  }

  async getMonthSummary(yearMonth: string) {
    return this.overviewRepo.fetchMonthExecutiveSummary(yearMonth);
  }

  async listStudentRecords(query: StudentRecordsQueryDto) {
    const { rows, total, page, limit } =
      await this.studentRecordsRepo.findStudentRecordsPaginated(query);
    return createPaginatedResult(rows, total, page, limit);
  }

  async listTeacherRecords(query: TeacherRecordsQueryDto) {
    const { rows, total, page, limit } =
      await this.staffRecordsRepo.findTeacherRecordsPaginated(query);
    return createPaginatedResult(rows, total, page, limit);
  }

  async listAssistantRecords(query: AssistantRecordsQueryDto) {
    const { rows, total, page, limit } =
      await this.staffRecordsRepo.findAssistantRecordsPaginated(query);
    return createPaginatedResult(rows, total, page, limit);
  }

  async recalculateMonth(yearMonth: string, actor?: AuthenticatedUser) {
    const snap = await this.readRepo.fetchMonthSettlementSnapshot(yearMonth);
    const studentBatch = buildStudentSettlementBatch(yearMonth, snap);
    const staffBatch = buildStaffSettlementBatch(yearMonth, snap, studentBatch);

    await this.writeRepo.persistRecalculationBatch({
      yearMonth,
      studentRows: studentBatch.studentRows,
      teacherDueRows: staffBatch.teacherDueRows,
      teacherMonthlyRows: staffBatch.teacherMonthlyRows,
      openAssistantIdsToRefreshDues: staffBatch.openAssistantIdsToRefreshDues,
      assistantDueRows: staffBatch.assistantDueRows,
      assistantMonthlyRows: staffBatch.assistantMonthlyRows,
    });

    const summary = {
      yearMonth,
      updatedStudentRecords: studentBatch.studentRows.length,
      updatedTeacherRecords: staffBatch.teacherMonthlyRows.length,
      updatedAssistantRecords: staffBatch.assistantMonthlyRows.length,
    };

    if (actor) {
      await this.auditLogsService.record({
        actorUserId: actor.id,
        actorName: actor.fullName,
        action: 'FINANCE_RECALCULATE_MONTH',
        entityType: 'monthly_settlement',
        entityId: yearMonth,
        afterData: summary,
      });
    }

    return summary;
  }

  async closeMonth(yearMonth: string, actor: AuthenticatedUser) {
    await this.recalculateMonth(yearMonth);
    const lockSummary = await this.writeRepo.lockMonthRecords(yearMonth);

    await this.auditLogsService.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'FINANCE_CLOSE_MONTH',
      entityType: 'monthly_settlement',
      entityId: yearMonth,
      afterData: { yearMonth, ...lockSummary },
    });

    return {
      yearMonth,
      ...lockSummary,
    };
  }
}
