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

export type MonthlySettlementSnapshot = Awaited<
  ReturnType<MonthlySettlementReadRepository['fetchMonthSettlementSnapshot']>
>;

@Injectable()
export class MonthlySettlementReadRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async fetchMonthSettlementSnapshot(yearMonth: string) {
    const { monthStart, monthEnd } = getMonthDateBounds(yearMonth);

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
    ] = await Promise.all([
      this.db.select().from(groups),
      this.db.select().from(financialPolicies),
      this.db.select().from(groupAssistants),
      this.db
        .select()
        .from(enrollments)
        .where(
          and(
            lte(enrollments.startDate, monthEnd),
            or(isNull(enrollments.endDate), gte(enrollments.endDate, monthStart)),
          ),
        ),
      this.db.select().from(sessions).where(eq(sessions.yearMonth, yearMonth)),
      this.db.select().from(assistants).where(eq(assistants.status, 'ACTIVE')),
      this.db
        .select()
        .from(studentMonthlyRecords)
        .where(eq(studentMonthlyRecords.yearMonth, yearMonth)),
      this.db.select().from(teacherDues).where(eq(teacherDues.yearMonth, yearMonth)),
      this.db
        .select()
        .from(teacherMonthlyRecords)
        .where(eq(teacherMonthlyRecords.yearMonth, yearMonth)),
      this.db.select().from(assistantDues).where(eq(assistantDues.yearMonth, yearMonth)),
      this.db
        .select()
        .from(assistantMonthlyRecords)
        .where(eq(assistantMonthlyRecords.yearMonth, yearMonth)),
      this.db
        .select({
          studentId: payments.studentId,
          groupId: paymentAllocations.groupId,
          paidSum: sql<string>`COALESCE(SUM(${paymentAllocations.allocatedAmount}), 0)`,
        })
        .from(paymentAllocations)
        .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
        .where(eq(paymentAllocations.yearMonth, yearMonth))
        .groupBy(payments.studentId, paymentAllocations.groupId),
      this.db
        .select({
          teacherId: teacherPayouts.teacherId,
          paidSum: sql<string>`COALESCE(SUM(${teacherPayouts.amount}), 0)`,
        })
        .from(teacherPayouts)
        .where(eq(teacherPayouts.yearMonth, yearMonth))
        .groupBy(teacherPayouts.teacherId),
      this.db
        .select({
          assistantId: assistantPayouts.assistantId,
          paidSum: sql<string>`COALESCE(SUM(${assistantPayouts.amount}), 0)`,
        })
        .from(assistantPayouts)
        .where(eq(assistantPayouts.yearMonth, yearMonth))
        .groupBy(assistantPayouts.assistantId),
    ]);

    const sessionIds = monthSessions.map((s) => s.id);
    const sessionAttendances =
      sessionIds.length > 0
        ? await this.db
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
