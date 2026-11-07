import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  assistantDues,
  assistantMonthlyRecords,
  assistants,
  attendance,
  bookingRequests,
  classrooms,
  expenses,
  groups,
  payments,
  sessions,
  studentMonthlyRecords,
  students,
  teacherDues,
  teacherMonthlyRecords,
  teachers,
} from '../../database/schemas';
import { queryClassroomsLiveSnapshot } from './dashboard-classrooms.helper';
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
      [studentFinRow],
      [paymentsRow],
      [teacherFinRow],
      [assistantFinRow],
      [expensesRow],
      [pendingBookingsRow],
      upcomingRows,
      roomsSnapshot,
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
          makeup: sql<number>`COUNT(*) FILTER (WHERE ${attendance.status} = 'MAKEUP_ATTENDED')::int`,
        })
        .from(attendance)
        .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
        .where(eq(sessions.sessionDate, todayDate)),
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
          totalExpenses: sql<string>`COALESCE(SUM(${expenses.amount}), 0)::text`,
        })
        .from(expenses)
        .where(eq(expenses.yearMonth, yearMonth)),
      this.db
        .select({ pendingCount: sql<number>`COUNT(*)::int` })
        .from(bookingRequests)
        .where(eq(bookingRequests.status, 'PENDING')),
      this.db
        .select({
          id: bookingRequests.id,
          requestType: bookingRequests.requestType,
          purpose: bookingRequests.purpose,
          requestedDate: bookingRequests.requestedDate,
          startTime: bookingRequests.startTime,
          endTime: bookingRequests.endTime,
          teacherName: teachers.fullName,
          studentName: students.fullName,
          classroomName: classrooms.name,
          roomNumber: classrooms.roomNumber,
        })
        .from(bookingRequests)
        .innerJoin(teachers, eq(bookingRequests.teacherId, teachers.id))
        .leftJoin(students, eq(bookingRequests.studentId, students.id))
        .leftJoin(
          classrooms,
          sql`${classrooms.id} = COALESCE(${bookingRequests.assignedClassroomId}, ${bookingRequests.requestedClassroomId})`,
        )
        .where(
          and(
            eq(bookingRequests.status, 'CONFIRMED'),
            gte(bookingRequests.requestedDate, todayDate),
          ),
        )
        .orderBy(asc(bookingRequests.requestedDate), asc(bookingRequests.startTime))
        .limit(5),
      queryClassroomsLiveSnapshot(this.db, todayDate, currentTime),
    ]);

    const totalRevenue = Number(studentFinRow?.totalRevenue ?? 0);
    const totalCollectedPayments = Number(paymentsRow?.totalCollected ?? 0);
    const totalReceivables = Number(studentFinRow?.totalReceivables ?? 0);
    const totalTeacherDues = Number(teacherFinRow?.total_dues ?? 0);
    const totalAssistantDues = Number(assistantFinRow?.total_dues ?? 0);
    const totalExpenses = Number(expensesRow?.totalExpenses ?? 0);
    const netCenterResult = Number(
      (totalRevenue - totalTeacherDues - totalAssistantDues - totalExpenses).toFixed(2),
    );

    return {
      yearMonth,
      todayDate,
      totalStudents: Number(studentStats?.totalStudents ?? 0),
      activeStudents: Number(studentStats?.activeStudents ?? 0),
      teachersCount: Number(teacherStats?.teachersCount ?? 0),
      assistantsCount: Number(assistantStats?.assistantsCount ?? 0),
      groupsCount: Number(groupStats?.groupsCount ?? 0),
      todaySessionsCount: todaySessionsRows.filter((s) => s.status !== 'CANCELLED').length,
      todaySessions: todaySessionsRows,
      todayAttendance: {
        present: Number(todayAttRow?.present ?? 0),
        absent: Number(todayAttRow?.absent ?? 0),
        excused: Number(todayAttRow?.excused ?? 0),
        makeup: Number(todayAttRow?.makeup ?? 0),
      },
      totalRevenue,
      totalCollectedPayments,
      totalReceivables,
      totalTeacherDues,
      totalAssistantDues,
      totalExpenses,
      netCenterResult,
      pendingBookingsCount: Number(pendingBookingsRow?.pendingCount ?? 0),
      upcomingAppointments: upcomingRows,
      classroomsSummary: roomsSnapshot.classroomsSummary,
      classroomsLive: roomsSnapshot.classroomsLive,
    };
  }
}
