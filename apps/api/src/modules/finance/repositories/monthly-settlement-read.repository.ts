import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../../database/database.module';
import {
  assistantDues,
  assistantMonthlyRecords,
  assistantPayouts,
  assistants,
  attendance,
  enrollments,
  financialPolicies,
  groupAssistants,
  groups,
  paymentAllocations,
  payments,
  sessions,
  studentMonthlyRecords,
  teacherDues,
  teacherMonthlyRecords,
  teacherPayouts,
} from '../../../database/schemas';
import { getMonthDateBounds } from '../utils/money.util';
import {
  FinanceTransaction,
  runQueriesInParallel,
  runQueriesSequentially,
} from './finance-month-lock.util';

export type MonthlySettlementSnapshot = Awaited<
  ReturnType<MonthlySettlementReadRepository['fetchMonthSettlementSnapshot']>
>;

@Injectable()
export class MonthlySettlementReadRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async fetchMonthSettlementSnapshot(yearMonth: string, tx?: FinanceTransaction) {
    const { monthStart, monthEnd } = getMonthDateBounds(yearMonth);
    const executor = tx ?? this.db;

    const snapshotQueries = [
      () => executor.select().from(groups),
      () => executor.select().from(financialPolicies),
      () => executor.select().from(groupAssistants),
      () => executor
        .select()
        .from(enrollments)
        .where(
          and(
            lte(enrollments.startDate, monthEnd),
            or(isNull(enrollments.endDate), gte(enrollments.endDate, monthStart)),
          ),
        ),
      () => executor.select().from(sessions).where(eq(sessions.yearMonth, yearMonth)),
      () => executor.select().from(assistants).where(eq(assistants.status, 'ACTIVE')),
      () => executor
        .select()
        .from(studentMonthlyRecords)
        .where(eq(studentMonthlyRecords.yearMonth, yearMonth)),
      () => executor.select().from(teacherDues).where(eq(teacherDues.yearMonth, yearMonth)),
      () => executor
        .select()
        .from(teacherMonthlyRecords)
        .where(eq(teacherMonthlyRecords.yearMonth, yearMonth)),
      () => executor.select().from(assistantDues).where(eq(assistantDues.yearMonth, yearMonth)),
      () => executor
        .select()
        .from(assistantMonthlyRecords)
        .where(eq(assistantMonthlyRecords.yearMonth, yearMonth)),
      () => executor
        .select({
          studentId: payments.studentId,
          groupId: paymentAllocations.groupId,
          paidSum: sql<string>`COALESCE(SUM(${paymentAllocations.allocatedAmount}), 0)`,
        })
        .from(paymentAllocations)
        .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
        .where(eq(paymentAllocations.yearMonth, yearMonth))
        .groupBy(payments.studentId, paymentAllocations.groupId),
      () => executor
        .select({
          teacherId: teacherPayouts.teacherId,
          paidSum: sql<string>`COALESCE(SUM(${teacherPayouts.amount}), 0)`,
        })
        .from(teacherPayouts)
        .where(eq(teacherPayouts.yearMonth, yearMonth))
        .groupBy(teacherPayouts.teacherId),
      () => executor
        .select({
          assistantId: assistantPayouts.assistantId,
          paidSum: sql<string>`COALESCE(SUM(${assistantPayouts.amount}), 0)`,
        })
        .from(assistantPayouts)
        .where(eq(assistantPayouts.yearMonth, yearMonth))
        .groupBy(assistantPayouts.assistantId),
    ] as const;
    const [
      allGroups,
      allPolicies,
      allGroupAssistants,
      monthEnrollments,
      monthSessions,
      activeAssistants,
      existingStudentRecords,
      existingTeacherDues,
      existingTeacherRecords,
      existingAssistantDues,
      existingAssistantRecords,
      allocationsAgg,
      teacherPayoutsAgg,
      assistantPayoutsAgg,
    ] = tx
      ? await runQueriesSequentially(snapshotQueries)
      : await runQueriesInParallel(snapshotQueries);

    const sessionIds = monthSessions.map((s) => s.id);
    const sessionAttendances =
      sessionIds.length > 0
        ? await executor
            .select()
            .from(attendance)
            .where(inArray(attendance.sessionId, sessionIds))
        : [];

    return {
      allGroups,
      allPolicies,
      allGroupAssistants,
      monthEnrollments,
      monthSessions,
      sessionAttendances,
      activeAssistants,
      existingStudentRecords,
      existingTeacherDues,
      existingTeacherRecords,
      existingAssistantDues,
      existingAssistantRecords,
      allocationsAgg,
      teacherPayoutsAgg,
      assistantPayoutsAgg,
    };
  }
}
