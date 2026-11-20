import { ConflictException, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CacheService } from '../../common/cache/cache.module';
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
import { FinanceTransaction } from './repositories/finance-month-lock.util';
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
    private readonly cache: CacheService,
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

  async isMonthClosed(yearMonth: string): Promise<boolean> {
    const summary = await this.overviewRepo.fetchMonthExecutiveSummary(yearMonth);
    return Boolean(summary.isMonthClosed);
  }

  async assertMonthOpen(yearMonth: string): Promise<void> {
    if (await this.isMonthClosed(yearMonth)) {
      throw new ConflictException(
        `الشهر المالي (${yearMonth}) مغلق نهائياً ولا يمكن إضافة أو تعديل معاملات مالية عليه`,
      );
    }
  }

  async recalculateMonth(yearMonth: string, actor?: AuthenticatedUser) {
    const result = await this.writeRepo.withMonthLock(yearMonth, (tx) =>
      this.recalculateMonthInTransaction(yearMonth, tx, Boolean(actor)),
    );

    if (actor && result.recalculated) {
      await this.auditLogsService.record({
        actorUserId: actor.id,
        actorName: actor.fullName,
        action: 'FINANCE_RECALCULATE_MONTH',
        entityType: 'monthly_settlement',
        entityId: yearMonth,
        afterData: result.summary,
      });
    }

    if (result.recalculated) await this.invalidateFinanceCaches();
    return result.summary;
  }

  async closeMonth(yearMonth: string, actor: AuthenticatedUser) {
    const lockSummary = await this.writeRepo.withMonthLock(yearMonth, async (tx) => {
      const currentSummary = await this.overviewRepo.fetchMonthExecutiveSummary(yearMonth, tx);
      if (currentSummary.isMonthClosed) {
        throw new ConflictException(
          `الشهر المالي (${yearMonth}) مغلق نهائياً ولا يمكن إعادة إغلاقه`,
        );
      }
      await this.recalculateMonthInTransaction(yearMonth, tx, false);
      return this.writeRepo.lockMonthRecords(yearMonth, tx);
    });

    await this.auditLogsService.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'FINANCE_CLOSE_MONTH',
      entityType: 'monthly_settlement',
      entityId: yearMonth,
      afterData: { yearMonth, ...lockSummary },
    });

    await this.invalidateFinanceCaches();

    return {
      yearMonth,
      ...lockSummary,
    };
  }

  private async recalculateMonthInTransaction(
    yearMonth: string,
    tx: FinanceTransaction,
    failIfClosed: boolean,
  ): Promise<{ summary: Record<string, number | string>; recalculated: boolean }> {
    const currentSummary = await this.overviewRepo.fetchMonthExecutiveSummary(yearMonth, tx);
    if (currentSummary.isMonthClosed) {
      if (failIfClosed) {
        throw new ConflictException(
          `الشهر المالي (${yearMonth}) مغلق نهائياً ولا يمكن إعادة احتسابه`,
        );
      }
      return {
        summary: {
          yearMonth,
          updatedStudentRecords: 0,
          updatedTeacherRecords: 0,
          updatedAssistantRecords: 0,
        },
        recalculated: false,
      };
    }

    const snap = await this.readRepo.fetchMonthSettlementSnapshot(yearMonth, tx);
    const studentBatch = buildStudentSettlementBatch(yearMonth, snap);
    const staffBatch = buildStaffSettlementBatch(yearMonth, snap, studentBatch);

    await this.writeRepo.persistRecalculationBatch(
      {
        yearMonth,
        studentRows: studentBatch.studentRows,
        teacherDueRows: staffBatch.teacherDueRows,
        teacherMonthlyRows: staffBatch.teacherMonthlyRows,
        openAssistantIdsToRefreshDues: staffBatch.openAssistantIdsToRefreshDues,
        assistantDueRows: staffBatch.assistantDueRows,
        assistantMonthlyRows: staffBatch.assistantMonthlyRows,
      },
      tx,
    );

    return {
      summary: {
        yearMonth,
        updatedStudentRecords: studentBatch.studentRows.length,
        updatedTeacherRecords: staffBatch.teacherMonthlyRows.length,
        updatedAssistantRecords: staffBatch.assistantMonthlyRows.length,
      },
      recalculated: true,
    };
  }

  private async invalidateFinanceCaches(): Promise<void> {
    try {
      await Promise.all([
        this.cache.invalidatePrefix('dashboard:summary:'),
        this.cache.invalidatePrefix('reports:'),
      ]);
    } catch {}
  }
}
