import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  attendance,
  bookingRequests,
  classrooms,
  enrollments,
  financialPolicies,
  groups,
  makeupSessions,
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
      studentBookings,
      studentMakeups,
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
          makeupAttendedCount: studentMonthlyRecords.makeupAttendedCount,
          sessionPriceSnapshot: studentMonthlyRecords.sessionPriceSnapshot,
          extraMakeupFees: studentMonthlyRecords.extraMakeupFees,
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

      this.db
        .select({
          id: bookingRequests.id,
          requestType: bookingRequests.requestType,
          purpose: bookingRequests.purpose,
          requestedDate: bookingRequests.requestedDate,
          startTime: bookingRequests.startTime,
          endTime: bookingRequests.endTime,
          durationMinutes: bookingRequests.durationMinutes,
          status: bookingRequests.status,
          notes: bookingRequests.notes,
          teacherName: teachers.fullName,
          classroomName: classrooms.name,
          createdAt: bookingRequests.createdAt,
        })
        .from(bookingRequests)
        .innerJoin(teachers, eq(bookingRequests.teacherId, teachers.id))
        .leftJoin(classrooms, eq(bookingRequests.assignedClassroomId, classrooms.id))
        .where(eq(bookingRequests.studentId, studentId))
        .orderBy(desc(bookingRequests.requestedDate)),

      this.db
        .select({
          id: makeupSessions.id,
          originalSessionId: makeupSessions.originalSessionId,
          absenceDate: makeupSessions.absenceDate,
          scheduledAt: makeupSessions.scheduledAt,
          status: makeupSessions.status,
          isFree: makeupSessions.isFree,
          extraFee: makeupSessions.extraFee,
          notes: makeupSessions.notes,
          groupId: groups.id,
          groupName: groups.name,
          sessionYearMonth: sessions.yearMonth,
          classroomName: classrooms.name,
        })
        .from(makeupSessions)
        .innerJoin(sessions, eq(makeupSessions.originalSessionId, sessions.id))
        .innerJoin(groups, eq(sessions.groupId, groups.id))
        .leftJoin(classrooms, eq(makeupSessions.classroomId, classrooms.id))
        .where(eq(makeupSessions.studentId, studentId))
        .orderBy(desc(makeupSessions.absenceDate)),
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
      studentBookings,
      studentMakeups,
      groupSessionsInMonth,
    };
  }
}
