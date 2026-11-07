import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentMethod } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  CreateExpenseDto,
  ExpensesQueryDto,
  UpdateExpenseDto,
} from './dto/expenses.dto';
import { ExpensesRepository, NewExpenseRow } from './repositories/expenses.repository';
import { parseMoney, roundMoney, toMoneyString } from './utils/money.util';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly repository: ExpensesRepository,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async list(query: ExpensesQueryDto) {
    const { rows, total, page, limit, summary } =
      await this.repository.findPaginatedWithSummary(query);
    return {
      ...createPaginatedResult(rows, total, page, limit),
      summary,
    };
  }

  async create(dto: CreateExpenseDto, actor: AuthenticatedUser) {
    const cleanAmount = roundMoney(dto.amount);
    const derivedYearMonth = dto.yearMonth || dto.expenseDate.slice(0, 7);

    const created = await this.repository.create({
      category: dto.category,
      title: dto.title.trim(),
      amount: toMoneyString(cleanAmount),
      expenseDate: dto.expenseDate,
      yearMonth: derivedYearMonth,
      paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
      recordedByUserId: actor.id,
      notes: dto.notes?.trim() || null,
    });

    await this.auditLogsService.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'FINANCE_EXPENSE_CREATE',
      entityType: 'expense',
      entityId: created.id,
      afterData: created,
    });

    return created;
  }

  async update(id: string, dto: UpdateExpenseDto, actor: AuthenticatedUser) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('سجل المصروف غير موجود');
    }

    const patch: Partial<NewExpenseRow> = {};
    if (dto.category !== undefined) patch.category = dto.category;
    if (dto.title !== undefined) patch.title = dto.title.trim();
    if (dto.amount !== undefined) patch.amount = toMoneyString(roundMoney(dto.amount));
    if (dto.expenseDate !== undefined) {
      patch.expenseDate = dto.expenseDate;
      if (dto.yearMonth === undefined) {
        patch.yearMonth = dto.expenseDate.slice(0, 7);
      }
    }
    if (dto.yearMonth !== undefined) patch.yearMonth = dto.yearMonth;
    if (dto.paymentMethod !== undefined) patch.paymentMethod = dto.paymentMethod;
    if (dto.notes !== undefined) patch.notes = dto.notes.trim() || null;

    const updated = await this.repository.update(id, patch);

    await this.auditLogsService.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'FINANCE_EXPENSE_UPDATE',
      entityType: 'expense',
      entityId: id,
      beforeData: { ...existing, amount: parseMoney(existing.amount) },
      afterData: updated,
    });

    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('سجل المصروف غير موجود');
    }

    await this.repository.delete(id);

    await this.auditLogsService.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'FINANCE_EXPENSE_DELETE',
      entityType: 'expense',
      entityId: id,
      beforeData: { ...existing, amount: parseMoney(existing.amount) },
    });

    return { deleted: true, id };
  }
}
