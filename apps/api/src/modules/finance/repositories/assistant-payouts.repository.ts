import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  ilike,
  or,
  SQL,
} from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../../database/database.module';
import {
  assistantMonthlyRecords,
  assistantPayouts,
  assistants,
  users,
} from '../../../database/schemas';
import { normalizePagination } from '../../../common/utils/pagination.util';
import { AssistantPayoutsQueryDto } from '../dto/payments-payouts.dto';
import { parseMoney, roundMoney, toMoneyString } from '../utils/money.util';

export interface CreateAssistantPayoutTxInput {
  referenceNumber: string;
  assistantId: string;
  yearMonth: string;
  amount: number;
  payoutDate: string;
  paymentMethod: string;
  paidByUserId: string;
  notes?: string;
}

@Injectable()
export class AssistantPayoutsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async findPaginated(query: AssistantPayoutsQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const conditions: SQL[] = [];

    if (query.yearMonth) conditions.push(eq(assistantPayouts.yearMonth, query.yearMonth));
    if (query.assistantId) {
      conditions.push(eq(assistantPayouts.assistantId, query.assistantId));
    }
    if (query.paymentMethod) {
      conditions.push(eq(assistantPayouts.paymentMethod, query.paymentMethod));
    }
    if (query.search) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(assistantPayouts.referenceNumber, pattern),
          ilike(assistants.fullName, pattern),
          ilike(assistants.assistantCode, pattern),
          ilike(assistants.phone, pattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: assistantPayouts.id,
          referenceNumber: assistantPayouts.referenceNumber,
          assistantId: assistantPayouts.assistantId,
          assistantCode: assistants.assistantCode,
          assistantName: assistants.fullName,
          yearMonth: assistantPayouts.yearMonth,
          amount: assistantPayouts.amount,
          payoutDate: assistantPayouts.payoutDate,
          paymentMethod: assistantPayouts.paymentMethod,
          paidByUserId: assistantPayouts.paidByUserId,
          paidByName: users.fullName,
          notes: assistantPayouts.notes,
          createdAt: assistantPayouts.createdAt,
        })
        .from(assistantPayouts)
        .innerJoin(assistants, eq(assistants.id, assistantPayouts.assistantId))
        .leftJoin(users, eq(users.id, assistantPayouts.paidByUserId))
        .where(whereClause)
        .orderBy(desc(assistantPayouts.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(assistantPayouts)
        .innerJoin(assistants, eq(assistants.id, assistantPayouts.assistantId))
        .where(whereClause),
    ]);

    return {
      rows: rows.map((r) => ({ ...r, amount: parseMoney(r.amount) })),
      total: Number(total),
      page,
      limit,
    };
  }

  async createTx(input: CreateAssistantPayoutTxInput) {
    const now = new Date();

    return this.db.transaction(async (tx) => {
      const [assistant] = await tx
        .select()
        .from(assistants)
        .where(eq(assistants.id, input.assistantId))
        .limit(1);
      if (!assistant) throw new NotFoundException('المساعد غير موجود');

      const [dup] = await tx
        .select({ id: assistantPayouts.id })
        .from(assistantPayouts)
        .where(eq(assistantPayouts.referenceNumber, input.referenceNumber))
        .limit(1);
      if (dup) throw new ConflictException('رقم مرجع الصرف مستخدم مسبقاً');

      const [monthly] = await tx
        .select()
        .from(assistantMonthlyRecords)
        .where(
          and(
            eq(assistantMonthlyRecords.assistantId, input.assistantId),
            eq(assistantMonthlyRecords.yearMonth, input.yearMonth),
          ),
        )
        .for('update');

      const [created] = await tx
        .insert(assistantPayouts)
        .values({
          referenceNumber: input.referenceNumber,
          assistantId: input.assistantId,
          yearMonth: input.yearMonth,
          amount: toMoneyString(input.amount),
          payoutDate: input.payoutDate,
          paymentMethod: input.paymentMethod,
          paidByUserId: input.paidByUserId,
          notes: input.notes ?? null,
        })
        .returning();

      if (monthly) {
        const newPaidOut = roundMoney(parseMoney(monthly.totalPaidOut) + input.amount);
        const newRemaining = roundMoney(
          Math.max(0, parseMoney(monthly.totalDues) - newPaidOut),
        );
        await tx
          .update(assistantMonthlyRecords)
          .set({
            totalPaidOut: toMoneyString(newPaidOut),
            remainingBalance: toMoneyString(newRemaining),
            updatedAt: now,
          })
          .where(eq(assistantMonthlyRecords.id, monthly.id));
      } else {
        await tx.insert(assistantMonthlyRecords).values({
          assistantId: input.assistantId,
          yearMonth: input.yearMonth,
          calculationMethodSnapshot: assistant.calculationMethod,
          totalDues: '0.00',
          totalPaidOut: toMoneyString(input.amount),
          remainingBalance: '0.00',
          isClosed: false,
        });
      }

      return {
        ...created!,
        amount: parseMoney(created!.amount),
        assistantName: assistant.fullName,
        assistantCode: assistant.assistantCode,
      };
    });
  }
}
