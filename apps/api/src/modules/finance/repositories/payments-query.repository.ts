import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  SQL,
} from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../../database/database.module';
import {
  groups,
  paymentAllocations,
  payments,
  studentMonthlyRecords,
  students,
  users,
} from '../../../database/schemas';
import { normalizePagination } from '../../../common/utils/pagination.util';
import { PaymentsQueryDto } from '../dto/payments-payouts.dto';
import { parseMoney } from '../utils/money.util';

@Injectable()
export class PaymentsQueryRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async countStudentMonthlyRecords(studentId: string, yearMonth: string): Promise<number> {
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(studentMonthlyRecords)
      .where(
        and(
          eq(studentMonthlyRecords.studentId, studentId),
          eq(studentMonthlyRecords.yearMonth, yearMonth),
        ),
      );
    return Number(total);
  }

  async findPaginated(query: PaymentsQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const conditions: SQL[] = [];

    if (query.yearMonth) conditions.push(eq(payments.yearMonth, query.yearMonth));
    if (query.date) conditions.push(eq(payments.paymentDate, query.date));
    if (query.paymentMethod) {
      conditions.push(eq(payments.paymentMethod, query.paymentMethod));
    }
    if (query.studentId) conditions.push(eq(payments.studentId, query.studentId));
    if (query.search) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(payments.receiptNumber, pattern),
          ilike(students.fullName, pattern),
          ilike(students.studentCode, pattern),
          ilike(students.phone, pattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: payments.id,
          receiptNumber: payments.receiptNumber,
          studentId: payments.studentId,
          studentCode: students.studentCode,
          studentName: students.fullName,
          studentPhone: students.phone,
          guardianPhone: students.guardianPhone,
          yearMonth: payments.yearMonth,
          amount: payments.amount,
          paymentDate: payments.paymentDate,
          paymentMethod: payments.paymentMethod,
          receivedByUserId: payments.receivedByUserId,
          receivedByName: users.fullName,
          notes: payments.notes,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .innerJoin(students, eq(students.id, payments.studentId))
        .leftJoin(users, eq(users.id, payments.receivedByUserId))
        .where(whereClause)
        .orderBy(desc(payments.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(payments)
        .innerJoin(students, eq(students.id, payments.studentId))
        .where(whereClause),
    ]);

    const paymentIds = rows.map((r) => r.id);
    const allocRows =
      paymentIds.length > 0
        ? await this.db
            .select({
              id: paymentAllocations.id,
              paymentId: paymentAllocations.paymentId,
              groupId: paymentAllocations.groupId,
              groupName: groups.name,
              groupCode: groups.groupCode,
              allocatedAmount: paymentAllocations.allocatedAmount,
            })
            .from(paymentAllocations)
            .innerJoin(groups, eq(groups.id, paymentAllocations.groupId))
            .where(inArray(paymentAllocations.paymentId, paymentIds))
        : [];

    const mapped = rows.map((r) => ({
      ...r,
      amount: parseMoney(r.amount),
      allocations: allocRows
        .filter((a) => a.paymentId === r.id)
        .map((a) => ({
          id: a.id,
          groupId: a.groupId,
          groupName: a.groupName,
          groupCode: a.groupCode,
          allocatedAmount: parseMoney(a.allocatedAmount),
        })),
    }));

    return { rows: mapped, total: Number(total), page, limit };
  }
}
