import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentMethod } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CacheService } from '../../common/cache/cache.module';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  AssistantPayoutsQueryDto,
  CreateAssistantPayoutDto,
  CreateTeacherPayoutDto,
  TeacherPayoutsQueryDto,
} from './dto/payments-payouts.dto';
import { MonthlySettlementService } from './monthly-settlement.service';
import { AssistantPayoutsRepository } from './repositories/assistant-payouts.repository';
import { TeacherPayoutsRepository } from './repositories/teacher-payouts.repository';
import { generateReferenceCode, roundMoney } from './utils/money.util';

@Injectable()
export class PayoutsService {
  constructor(
    private readonly teacherRepo: TeacherPayoutsRepository,
    private readonly assistantRepo: AssistantPayoutsRepository,
    private readonly monthlySettlementService: MonthlySettlementService,
    private readonly auditLogsService: AuditLogsService,
    private readonly cache: CacheService,
  ) {}

  async listTeacherPayouts(query: TeacherPayoutsQueryDto) {
    const { rows, total, page, limit } = await this.teacherRepo.findPaginated(query);
    return createPaginatedResult(rows, total, page, limit);
  }

  async recordTeacherPayout(dto: CreateTeacherPayoutDto, actor: AuthenticatedUser) {
    const cleanAmount = roundMoney(dto.amount);
    if (cleanAmount <= 0) {
      throw new BadRequestException('مبلغ الصرف يجب أن يكون أكبر من صفر');
    }

    await this.monthlySettlementService.assertMonthOpen(dto.yearMonth);
    await this.monthlySettlementService.recalculateMonth(dto.yearMonth);

    const referenceNumber =
      dto.referenceNumber?.trim() || generateReferenceCode('TPY', dto.yearMonth, 4);
    const payoutDate = dto.payoutDate || new Date().toISOString().slice(0, 10);

    const created = await this.teacherRepo.createTx({
      referenceNumber,
      teacherId: dto.teacherId,
      yearMonth: dto.yearMonth,
      amount: cleanAmount,
      payoutDate,
      paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
      paidByUserId: actor.id,
      notes: dto.notes?.trim() || undefined,
    });

    await this.auditLogsService.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'FINANCE_TEACHER_PAYOUT',
      entityType: 'teacher_payout',
      entityId: created.id,
      afterData: {
        referenceNumber: created.referenceNumber,
        teacherId: created.teacherId,
        yearMonth: created.yearMonth,
        amount: created.amount,
        paymentMethod: created.paymentMethod,
      },
    });

    try {
      await Promise.all([
        this.cache.invalidatePrefix('dashboard:summary:'),
        this.cache.invalidatePrefix('reports:'),
      ]);
    } catch {}

    return {
      ...created,
      paidByName: actor.fullName,
    };
  }

  async listAssistantPayouts(query: AssistantPayoutsQueryDto) {
    const { rows, total, page, limit } = await this.assistantRepo.findPaginated(query);
    return createPaginatedResult(rows, total, page, limit);
  }

  async recordAssistantPayout(dto: CreateAssistantPayoutDto, actor: AuthenticatedUser) {
    const cleanAmount = roundMoney(dto.amount);
    if (cleanAmount <= 0) {
      throw new BadRequestException('مبلغ الصرف يجب أن يكون أكبر من صفر');
    }

    await this.monthlySettlementService.assertMonthOpen(dto.yearMonth);
    await this.monthlySettlementService.recalculateMonth(dto.yearMonth);

    const referenceNumber =
      dto.referenceNumber?.trim() || generateReferenceCode('APY', dto.yearMonth, 4);
    const payoutDate = dto.payoutDate || new Date().toISOString().slice(0, 10);

    const created = await this.assistantRepo.createTx({
      referenceNumber,
      assistantId: dto.assistantId,
      yearMonth: dto.yearMonth,
      amount: cleanAmount,
      payoutDate,
      paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
      paidByUserId: actor.id,
      notes: dto.notes?.trim() || undefined,
    });

    await this.auditLogsService.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'FINANCE_ASSISTANT_PAYOUT',
      entityType: 'assistant_payout',
      entityId: created.id,
      afterData: {
        referenceNumber: created.referenceNumber,
        assistantId: created.assistantId,
        yearMonth: created.yearMonth,
        amount: created.amount,
        paymentMethod: created.paymentMethod,
      },
    });

    try {
      await Promise.all([
        this.cache.invalidatePrefix('dashboard:summary:'),
        this.cache.invalidatePrefix('reports:'),
      ]);
    } catch {}

    return {
      ...created,
      paidByName: actor.fullName,
    };
  }
}
