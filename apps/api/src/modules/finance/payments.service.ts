import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentMethod } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreatePaymentDto, PaymentsQueryDto } from './dto/payments-payouts.dto';
import { MonthlySettlementService } from './monthly-settlement.service';
import { PaymentsQueryRepository } from './repositories/payments-query.repository';
import { PaymentsRepository } from './repositories/payments.repository';
import { generateReferenceCode, roundMoney } from './utils/money.util';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly queryRepo: PaymentsQueryRepository,
    private readonly writeRepo: PaymentsRepository,
    private readonly monthlySettlementService: MonthlySettlementService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async list(query: PaymentsQueryDto) {
    const { rows, total, page, limit } = await this.queryRepo.findPaginated(query);
    return createPaginatedResult(rows, total, page, limit);
  }

  async collectPayment(dto: CreatePaymentDto, actor: AuthenticatedUser) {
    const cleanAmount = roundMoney(dto.amount);
    if (cleanAmount <= 0) {
      throw new BadRequestException('المبلغ المحصل يجب أن يكون أكبر من صفر');
    }

    if (dto.allocations && dto.allocations.length > 0) {
      const sumAllocations = roundMoney(
        dto.allocations.reduce((sum, item) => sum + roundMoney(item.amount), 0),
      );
      if (Math.abs(sumAllocations - cleanAmount) > 0.01) {
        throw new BadRequestException(
          `مجموع توزيع المجموعات (${sumAllocations} ج.م) يجب أن يساوي إجمالي المبلغ المدفوع (${cleanAmount} ج.م)`,
        );
      }
    }

    const existingCount = await this.queryRepo.countStudentMonthlyRecords(
      dto.studentId,
      dto.yearMonth,
    );
    if (existingCount === 0) {
      await this.monthlySettlementService.recalculateMonth(dto.yearMonth);
    }

    const receiptNumber =
      dto.receiptNumber?.trim() || generateReferenceCode('RCP', dto.yearMonth, 6);
    const paymentDate = dto.paymentDate || new Date().toISOString().slice(0, 10);

    const created = await this.writeRepo.createPaymentWithAllocations({
      receiptNumber,
      studentId: dto.studentId,
      yearMonth: dto.yearMonth,
      amount: cleanAmount,
      paymentDate,
      paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
      receivedByUserId: actor.id,
      notes: dto.notes?.trim() || undefined,
      explicitAllocations: dto.allocations?.map((a) => ({
        groupId: a.groupId,
        amount: roundMoney(a.amount),
      })),
    });

    await this.auditLogsService.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'FINANCE_COLLECT_PAYMENT',
      entityType: 'payment',
      entityId: created.id,
      afterData: {
        receiptNumber: created.receiptNumber,
        studentId: created.studentId,
        yearMonth: created.yearMonth,
        amount: created.amount,
        paymentMethod: created.paymentMethod,
        allocations: created.allocations,
      },
    });

    return {
      ...created,
      receivedByName: actor.fullName,
    };
  }
}
