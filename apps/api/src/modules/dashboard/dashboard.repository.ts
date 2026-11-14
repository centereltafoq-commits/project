import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  assistantDues,
  assistantMonthlyRecords,
  assistantPayouts,
  assistants,
  attendance,
  classrooms,
  expenses,
  groups,
  payments,
  sessions,
  studentMonthlyRecords,
  students,
  teacherDues,
  teacherMonthlyRecords,
  teacherPayouts,
  teachers,
} from '../../database/schemas';
import { queryClassroomsLiveSnapshot } from './dashboard-classrooms.helper';
import { queryStudentSessionProgress } from './dashboard-session-progress.helper';
import { DashboardSummaryResponse } from './dashboard.types';

@Injectable()
export class DashboardRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async fetchExecutiveSummary(
    yearMonth: string,
    todayDate: string,
    currentTime: string,
  ): Promise<DashboardSummaryResponse> {
    const [
      [studentStats],
      [teacherStats],
      [assistantStats],
      [groupStats],
      todaySessionsRows,
      [todayAttRow],
      [monthlySessionsRow],
      [studentSessionsRow],
      [studentFinRow],
      [paymentsRow],
      [todayPaymentsRow],
      [teacherFinRow],
      [assistantFinRow],
      [teacherPaidRow],
      [assistantPaidRow],
      [expensesRow],
      roomsSnapshot,
      studentPaymentRows,
      groupPaymentRows,
      sessionProgressSummary,
    ] = await Promise.all([
      this.db
        .select({
          totalStudents: sql<number>`COUNT(*)::int`,
          activeStudents: sql<number>`COUNT(*) FILTER (WHERE ${students.status} = 'ACTIVE')::int`,
        })
        .from(students),
      this.db
        .select({
          teachersCount: sql<number>`COUNT(*) FILTER (WHERE ${teachers.employmentStatus} = 'ACTIVE')::int`,
        })
        .from(teachers),
      this.db
        .select({
          assistantsCount: sql<number>`COUNT(*) FILTER (WHERE ${assistants.status} = 'ACTIVE')::int`,
        })
        .from(assistants),
      this.db
        .select({
          groupsCount: sql<number>`COUNT(*) FILTER (WHERE ${groups.isActive} = true)::int`,
          scheduledGroupsCount: sql<number>`COUNT(*) FILTER (WHERE ${groups.isActive} = true AND jsonb_array_length(COALESCE(${groups.scheduleSlots}, '[]'::jsonb)) > 0)::int`,
        })
        .from(groups),
      this.db
        .select({
          id: sessions.id,
          groupId: sessions.groupId,
          groupName: groups.name,
          subject: groups.subject,
          gradeLevel: groups.gradeLevel,
          teacherName: teachers.fullName,
          classroomName: classrooms.name,
          roomNumber: classrooms.roomNumber,
          startTime: sessions.startTime,
          endTime: sessions.endTime,
          status: sessions.status,
        })
        .from(sessions)
        .innerJoin(groups, eq(sessions.groupId, groups.id))
        .innerJoin(teachers, eq(sessions.teacherId, teachers.id))
        .leftJoin(classrooms, eq(sessions.classroomId, classrooms.id))
        .where(eq(sessions.sessionDate, todayDate))
        .orderBy(asc(sessions.startTime)),
      this.db
        .select({
          present: sql<number>`COUNT(*) FILTER (WHERE ${attendance.status} = 'PRESENT')::int`,
          absent: sql<number>`COUNT(*) FILTER (WHERE ${attendance.status} = 'ABSENT')::int`,
          excused: sql<number>`COUNT(*) FILTER (WHERE ${attendance.status} = 'EXCUSED')::int`,
        })
        .from(attendance)
        .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
        .where(eq(sessions.sessionDate, todayDate)),
      this.db
        .select({
          totalSessions: sql<number>`COUNT(*) FILTER (WHERE ${sessions.status} != 'CANCELLED')::int`,
          executedSessions: sql<number>`COUNT(*) FILTER (WHERE ${sessions.status} = 'COMPLETED' OR (${sessions.sessionDate} <= ${todayDate} AND ${sessions.status} != 'CANCELLED'))::int`,
          scheduledSessions: sql<number>`COUNT(*) FILTER (WHERE ${sessions.status} = 'SCHEDULED' AND ${sessions.sessionDate} > ${todayDate})::int`,
        })
        .from(sessions)
        .where(eq(sessions.yearMonth, yearMonth)),
      this.db
        .select({
          totalBillableSessions: sql<number>`COALESCE(SUM(${studentMonthlyRecords.eligibleSessions}), 0)::int`,
          totalPaidSessions: sql<number>`COALESCE(SUM(
            CASE 
              WHEN ${studentMonthlyRecords.sessionPriceSnapshot} > 0 
              THEN LEAST(
                ${studentMonthlyRecords.eligibleSessions}, 
                FLOOR(${studentMonthlyRecords.totalPaid} / ${studentMonthlyRecords.sessionPriceSnapshot})::int
              )
              ELSE ${studentMonthlyRecords.eligibleSessions}
            END
          ), 0)::int`,
          totalUnpaidSessions: sql<number>`COALESCE(SUM(
            CASE 
              WHEN ${studentMonthlyRecords.sessionPriceSnapshot} > 0 
              THEN GREATEST(
                0, 
                ${studentMonthlyRecords.eligibleSessions} - FLOOR(${studentMonthlyRecords.totalPaid} / ${studentMonthlyRecords.sessionPriceSnapshot})::int
              )
              ELSE 0
            END
          ), 0)::int`,
        })
        .from(studentMonthlyRecords)
        .where(eq(studentMonthlyRecords.yearMonth, yearMonth)),
      this.db
        .select({
          totalRevenue: sql<string>`COALESCE(SUM(${studentMonthlyRecords.totalDue}), 0)::text`,
          totalReceivables: sql<string>`COALESCE(SUM(CASE WHEN ${studentMonthlyRecords.remainingBalance} > 0 THEN ${studentMonthlyRecords.remainingBalance} ELSE 0 END), 0)::text`,
        })
        .from(studentMonthlyRecords)
        .where(eq(studentMonthlyRecords.yearMonth, yearMonth)),
      this.db
        .select({
          totalCollected: sql<string>`COALESCE(SUM(${payments.amount}), 0)::text`,
        })
        .from(payments)
        .where(eq(payments.yearMonth, yearMonth)),
      this.db
        .select({
          todayCollected: sql<string>`COALESCE(SUM(${payments.amount}), 0)::text`,
          todayCount: sql<number>`COUNT(*)::int`,
        })
        .from(payments)
        .where(eq(payments.paymentDate, todayDate)),
      this.db.execute<{ total_dues: string }>(sql`
        SELECT COALESCE(
          NULLIF((SELECT SUM(${teacherMonthlyRecords.totalDues}) FROM ${teacherMonthlyRecords} WHERE ${teacherMonthlyRecords.yearMonth} = ${yearMonth}), 0),
          (SELECT SUM(${teacherDues.teacherAmount}) FROM ${teacherDues} WHERE ${teacherDues.yearMonth} = ${yearMonth}),
          0
        )::text AS total_dues
      `).then((r) => r.rows),
      this.db.execute<{ total_dues: string }>(sql`
        SELECT COALESCE(
          NULLIF((SELECT SUM(${assistantMonthlyRecords.totalDues}) FROM ${assistantMonthlyRecords} WHERE ${assistantMonthlyRecords.yearMonth} = ${yearMonth}), 0),
          (SELECT SUM(${assistantDues.amount}) FROM ${assistantDues} WHERE ${assistantDues.yearMonth} = ${yearMonth}),
          0
        )::text AS total_dues
      `).then((r) => r.rows),
      this.db
        .select({
          totalPaidOut: sql<string>`COALESCE(SUM(${teacherPayouts.amount}), 0)::text`,
        })
        .from(teacherPayouts)
        .where(eq(teacherPayouts.yearMonth, yearMonth)),
      this.db
        .select({
          totalPaidOut: sql<string>`COALESCE(SUM(${assistantPayouts.amount}), 0)::text`,
        })
        .from(assistantPayouts)
        .where(eq(assistantPayouts.yearMonth, yearMonth)),
      this.db
        .select({
          totalExpenses: sql<string>`COALESCE(SUM(${expenses.amount}), 0)::text`,
        })
        .from(expenses)
        .where(eq(expenses.yearMonth, yearMonth)),
      queryClassroomsLiveSnapshot(this.db, todayDate, currentTime),
      this.db
        .select({
          studentId: studentMonthlyRecords.studentId,
          totalDue: sql<string>`COALESCE(SUM(${studentMonthlyRecords.totalDue}), 0)::text`,
          totalPaid: sql<string>`COALESCE(SUM(${studentMonthlyRecords.totalPaid}), 0)::text`,
          remainingBalance: sql<string>`COALESCE(SUM(${studentMonthlyRecords.remainingBalance}), 0)::text`,
        })
        .from(studentMonthlyRecords)
        .where(eq(studentMonthlyRecords.yearMonth, yearMonth))
        .groupBy(studentMonthlyRecords.studentId),
      this.db
        .select({
          groupId: studentMonthlyRecords.groupId,
          totalDue: sql<string>`COALESCE(SUM(${studentMonthlyRecords.totalDue}), 0)::text`,
          totalPaid: sql<string>`COALESCE(SUM(${studentMonthlyRecords.totalPaid}), 0)::text`,
          remainingBalance: sql<string>`COALESCE(SUM(${studentMonthlyRecords.remainingBalance}), 0)::text`,
        })
        .from(studentMonthlyRecords)
        .where(eq(studentMonthlyRecords.yearMonth, yearMonth))
        .groupBy(studentMonthlyRecords.groupId),
      queryStudentSessionProgress(this.db, yearMonth),
    ]);

    const totalRevenue = Number(studentFinRow?.totalRevenue ?? 0);
    const totalCollectedPayments = Number(paymentsRow?.totalCollected ?? 0);
    const todayCollectedPayments = Number(todayPaymentsRow?.todayCollected ?? 0);
    const todayPaymentsCount = Number(todayPaymentsRow?.todayCount ?? 0);
    const totalReceivables = Number(studentFinRow?.totalReceivables ?? 0);
    const totalTeacherDues = Number(teacherFinRow?.total_dues ?? 0);
    const totalAssistantDues = Number(assistantFinRow?.total_dues ?? 0);
    const totalTeacherPaidOut = Number(teacherPaidRow?.totalPaidOut ?? 0);
    const totalAssistantPaidOut = Number(assistantPaidRow?.totalPaidOut ?? 0);
    const totalExpenses = Number(expensesRow?.totalExpenses ?? 0);
    const netCenterResult = Number(
      (totalRevenue - totalTeacherDues - totalAssistantDues - totalExpenses).toFixed(2),
    );
    const netCashFlow = Number(
      (totalCollectedPayments - totalTeacherPaidOut - totalAssistantPaidOut - totalExpenses).toFixed(2),
    );

    const totalBillableSessions = Number(studentSessionsRow?.totalBillableSessions ?? 0);
    const totalPaidSessions = Number(studentSessionsRow?.totalPaidSessions ?? 0);
    const totalUnpaidSessions = Number(studentSessionsRow?.totalUnpaidSessions ?? 0);
    const collectionRateSessions =
      totalBillableSessions > 0
        ? Math.min(100, Math.round((totalPaidSessions / totalBillableSessions) * 100))
        : 0;

    let paidStudentsCount = 0;
    let unpaidStudentsCount = 0;
    for (const row of studentPaymentRows) {
      const remaining = Number(row.remainingBalance ?? 0);
      const totalDue = Number(row.totalDue ?? 0);
      const totalPaid = Number(row.totalPaid ?? 0);
      if (remaining > 0) {
        unpaidStudentsCount += 1;
      } else if (totalDue > 0 || totalPaid > 0) {
        paidStudentsCount += 1;
      }
    }
    const totalBilledStudentsCount = paidStudentsCount + unpaidStudentsCount;

    let paidGroupsCount = 0;
    let unpaidGroupsCount = 0;
    for (const row of groupPaymentRows) {
      const remaining = Number(row.remainingBalance ?? 0);
      const totalDue = Number(row.totalDue ?? 0);
      const totalPaid = Number(row.totalPaid ?? 0);
      if (remaining > 0) {
        unpaidGroupsCount += 1;
      } else if (totalDue > 0 || totalPaid > 0) {
        paidGroupsCount += 1;
      }
    }
    const totalBilledGroupsCount = paidGroupsCount + unpaidGroupsCount;

    return {
      yearMonth,
      todayDate,
      totalStudents: Number(studentStats?.totalStudents ?? 0),
      activeStudents: Number(studentStats?.activeStudents ?? 0),
      teachersCount: Number(teacherStats?.teachersCount ?? 0),
      assistantsCount: Number(assistantStats?.assistantsCount ?? 0),
      groupsCount: Number(groupStats?.groupsCount ?? 0),
      scheduledGroupsCount: Number(groupStats?.scheduledGroupsCount ?? 0),
      todaySessionsCount: todaySessionsRows.filter((s) => s.status !== 'CANCELLED').length,
      todaySessions: todaySessionsRows,
      todayAttendance: {
        present: Number(todayAttRow?.present ?? 0),
        absent: Number(todayAttRow?.absent ?? 0),
        excused: Number(todayAttRow?.excused ?? 0),
      },
      monthlySessionsStats: {
        totalSessions: Number(monthlySessionsRow?.totalSessions ?? 0),
        executedSessions: Number(monthlySessionsRow?.executedSessions ?? 0),
        scheduledSessions: Number(monthlySessionsRow?.scheduledSessions ?? 0),
        totalBillableSessions,
        totalPaidSessions,
        totalUnpaidSessions,
        collectionRateSessions,
      },
      monthlyPaymentStats: {
        paidStudentsCount,
        unpaidStudentsCount,
        totalBilledStudentsCount,
        paidGroupsCount,
        unpaidGroupsCount,
        totalBilledGroupsCount,
      },
      monthlySessionProgress: sessionProgressSummary,
      totalRevenue,
      totalCollectedPayments,
      todayCollectedPayments,
      todayPaymentsCount,
      totalReceivables,
      totalTeacherDues,
      totalAssistantDues,
      totalTeacherPaidOut,
      totalAssistantPaidOut,
      totalExpenses,
      netCenterResult,
      netCashFlow,
      classroomsSummary: roomsSnapshot.classroomsSummary,
      classroomsLive: roomsSnapshot.classroomsLive,
    };
  }
}
