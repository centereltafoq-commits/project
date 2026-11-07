import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentMethod } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  AssistantPayoutsQueryDto,
  CreateAssistantPayoutDto,
  CreateTeacherPayoutDto,
  TeacherPayoutsQueryDto,
} from './dto/payments-payouts.dto';
import { AssistantPayoutsRepository } from './repositories/assistant-payouts.repository';
import { TeacherPayoutsRepository } from './repositories/teacher-payouts.repository';
import { generateReferenceCode, roundMoney } from './utils/money.util';

@Injectable()
export class PayoutsService {
  constructor(
    private readonly teacherRepo: TeacherPayoutsRepository,
    private readonly assistantRepo: AssistantPayoutsRepository,
    private readonly auditLogsService: AuditLogsService,
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

    return {
      ...created,
      paidByName: actor.fullName,
    };
  }
}
