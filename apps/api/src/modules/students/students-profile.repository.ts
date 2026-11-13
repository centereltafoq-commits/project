import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  attendance,
  enrollments,
  financialPolicies,
  groups,
  paymentAllocations,
  payments,
  sessions,
  studentMonthlyRecords,
  teachers,
} from '../../database/schemas';

@Injectable()
export class StudentsProfileRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async fetchProfileBundle(studentId: string, yearMonth: string) {
    const [
      studentEnrollments,
      monthlyRecords,
      monthAttendance,
      studentPayments,
      monthAllocations,
    ] = await Promise.all([
      this.db
        .select({
          id: enrollments.id,
          groupId: enrollments.groupId,
          groupCode: groups.groupCode,
          groupName: groups.name,
          subject: groups.subject,
          gradeLevel: groups.gradeLevel,
          scheduleSlots: groups.scheduleSlots,
          teacherId: teachers.id,
          teacherName: teachers.fullName,
          startDate: enrollments.startDate,
          endDate: enrollments.endDate,
          agreedMonthlyPrice: enrollments.agreedMonthlyPrice,
          agreedSessionsCount: enrollments.agreedSessionsCount,
          agreedSessionPrice: enrollments.agreedSessionPrice,
          status: enrollments.status,
          notes: enrollments.notes,
          createdAt: enrollments.createdAt,
          fullMonthAbsencePolicy: financialPolicies.fullMonthAbsencePolicy,
          fullAbsenceFixedFee: financialPolicies.fullAbsenceFixedFee,
          chargeExcusedAbsence: financialPolicies.chargeExcusedAbsence,
        })
        .from(enrollments)
        .innerJoin(groups, eq(enrollments.groupId, groups.id))
        .innerJoin(teachers, eq(groups.primaryTeacherId, teachers.id))
        .leftJoin(financialPolicies, eq(financialPolicies.groupId, groups.id))
        .where(eq(enrollments.studentId, studentId))
        .orderBy(desc(enrollments.createdAt)),

      this.db
        .select({
          id: studentMonthlyRecords.id,
          groupId: studentMonthlyRecords.groupId,
          groupName: groups.name,
          yearMonth: studentMonthlyRecords.yearMonth,
          totalGroupSessions: studentMonthlyRecords.totalGroupSessions,
          eligibleSessions: studentMonthlyRecords.eligibleSessions,
          presentCount: studentMonthlyRecords.presentCount,
          absentCount: studentMonthlyRecords.absentCount,
          excusedCount: studentMonthlyRecords.excusedCount,
          sessionPriceSnapshot: studentMonthlyRecords.sessionPriceSnapshot,
          totalDue: studentMonthlyRecords.totalDue,
          totalPaid: studentMonthlyRecords.totalPaid,
          remainingBalance: studentMonthlyRecords.remainingBalance,
          isClosed: studentMonthlyRecords.isClosed,
        })
        .from(studentMonthlyRecords)
        .innerJoin(groups, eq(studentMonthlyRecords.groupId, groups.id))
        .where(
          and(
            eq(studentMonthlyRecords.studentId, studentId),
            eq(studentMonthlyRecords.yearMonth, yearMonth),
          ),
        ),

      this.db
        .select({
          id: attendance.id,
          sessionId: attendance.sessionId,
          status: attendance.status,
          notes: attendance.notes,
          recordedAt: attendance.recordedAt,
          sessionDate: sessions.sessionDate,
          yearMonth: sessions.yearMonth,
          startTime: sessions.startTime,
          endTime: sessions.endTime,
          topic: sessions.topic,
          sessionStatus: sessions.status,
          groupId: groups.id,
          groupName: groups.name,
        })
        .from(attendance)
        .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
        .innerJoin(groups, eq(sessions.groupId, groups.id))
        .where(and(eq(attendance.studentId, studentId), eq(sessions.yearMonth, yearMonth)))
        .orderBy(desc(sessions.sessionDate)),

      this.db
        .select()
        .from(payments)
        .where(eq(payments.studentId, studentId))
        .orderBy(desc(payments.paymentDate), desc(payments.createdAt)),

      this.db
        .select({
          groupId: paymentAllocations.groupId,
          allocatedAmount: paymentAllocations.allocatedAmount,
          paymentId: paymentAllocations.paymentId,
        })
        .from(paymentAllocations)
        .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
        .where(
          and(eq(payments.studentId, studentId), eq(paymentAllocations.yearMonth, yearMonth)),
        ),
    ]);

    const enrolledGroupIds = Array.from(new Set(studentEnrollments.map((e) => e.groupId)));
    const groupSessionsInMonth =
      enrolledGroupIds.length > 0
        ? await this.db
            .select({
              id: sessions.id,
              groupId: sessions.groupId,
              sessionDate: sessions.sessionDate,
              status: sessions.status,
            })
            .from(sessions)
            .where(
              and(
                inArray(sessions.groupId, enrolledGroupIds),
                eq(sessions.yearMonth, yearMonth),
                ne(sessions.status, 'CANCELLED'),
              ),
            )
        : [];

    return {
      studentEnrollments,
      monthlyRecords,
      monthAttendance,
      studentPayments,
      monthAllocations,
      groupSessionsInMonth,
    };
  }
}
