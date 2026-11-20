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
  teacherMonthlyRecords,
  teacherPayouts,
  teachers,
  users,
} from '../../../database/schemas';
import { normalizePagination } from '../../../common/utils/pagination.util';
import { TeacherPayoutsQueryDto } from '../dto/payments-payouts.dto';
import {
  assertPayoutWithinRemainingBalance,
  parseMoney,
  roundMoney,
  toMoneyString,
} from '../utils/money.util';
import { lockFinanceMonths } from './finance-month-lock.util';

export interface CreateTeacherPayoutTxInput {
  referenceNumber: string;
  teacherId: string;
  yearMonth: string;
  amount: number;
  payoutDate: string;
  paymentMethod: string;
  paidByUserId: string;
  notes?: string;
}

@Injectable()
export class TeacherPayoutsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async findPaginated(query: TeacherPayoutsQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const conditions: SQL[] = [];

    if (query.yearMonth) conditions.push(eq(teacherPayouts.yearMonth, query.yearMonth));
    if (query.date) conditions.push(eq(teacherPayouts.payoutDate, query.date));
    if (query.teacherId) conditions.push(eq(teacherPayouts.teacherId, query.teacherId));
    if (query.paymentMethod) {
      conditions.push(eq(teacherPayouts.paymentMethod, query.paymentMethod));
    }
    if (query.search) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(teacherPayouts.referenceNumber, pattern),
          ilike(teachers.fullName, pattern),
          ilike(teachers.teacherCode, pattern),
          ilike(teachers.phone, pattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: teacherPayouts.id,
          referenceNumber: teacherPayouts.referenceNumber,
          teacherId: teacherPayouts.teacherId,
          teacherCode: teachers.teacherCode,
          teacherName: teachers.fullName,
          yearMonth: teacherPayouts.yearMonth,
          amount: teacherPayouts.amount,
          payoutDate: teacherPayouts.payoutDate,
          paymentMethod: teacherPayouts.paymentMethod,
          paidByUserId: teacherPayouts.paidByUserId,
          paidByName: users.fullName,
          notes: teacherPayouts.notes,
          createdAt: teacherPayouts.createdAt,
        })
        .from(teacherPayouts)
        .innerJoin(teachers, eq(teachers.id, teacherPayouts.teacherId))
        .leftJoin(users, eq(users.id, teacherPayouts.paidByUserId))
        .where(whereClause)
        .orderBy(desc(teacherPayouts.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(teacherPayouts)
        .innerJoin(teachers, eq(teachers.id, teacherPayouts.teacherId))
        .where(whereClause),
    ]);

    return {
      rows: rows.map((r) => ({ ...r, amount: parseMoney(r.amount) })),
      total: Number(total),
      page,
      limit,
    };
  }

  async createTx(input: CreateTeacherPayoutTxInput) {
    const now = new Date();

    return this.db.transaction(async (tx) => {
      await lockFinanceMonths(tx, [input.yearMonth]);

      const [teacher] = await tx
        .select()
        .from(teachers)
        .where(eq(teachers.id, input.teacherId))
        .limit(1);
      if (!teacher) throw new NotFoundException('المدرس غير موجود');

      const [dup] = await tx
        .select({ id: teacherPayouts.id })
        .from(teacherPayouts)
        .where(eq(teacherPayouts.referenceNumber, input.referenceNumber))
        .limit(1);
      if (dup) throw new ConflictException('رقم مرجع الصرف مستخدم مسبقاً');

      const [monthly] = await tx
        .select()
        .from(teacherMonthlyRecords)
        .where(
          and(
            eq(teacherMonthlyRecords.teacherId, input.teacherId),
            eq(teacherMonthlyRecords.yearMonth, input.yearMonth),
          ),
        )
        .for('update');

      assertPayoutWithinRemainingBalance(monthly, input.amount);

      const [created] = await tx
        .insert(teacherPayouts)
        .values({
          referenceNumber: input.referenceNumber,
          teacherId: input.teacherId,
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
          .update(teacherMonthlyRecords)
          .set({
            totalPaidOut: toMoneyString(newPaidOut),
            remainingBalance: toMoneyString(newRemaining),
            updatedAt: now,
          })
          .where(eq(teacherMonthlyRecords.id, monthly.id));
      } else {
        await tx.insert(teacherMonthlyRecords).values({
          teacherId: input.teacherId,
          yearMonth: input.yearMonth,
          groupsCount: 0,
          executedSessionsCount: 0,
          totalDues: '0.00',
          totalPaidOut: toMoneyString(input.amount),
          remainingBalance: '0.00',
          isClosed: false,
        });
      }

      return {
        ...created!,
        amount: parseMoney(created!.amount),
        teacherName: teacher.fullName,
        teacherCode: teacher.teacherCode,
      };
    });
  }
}
