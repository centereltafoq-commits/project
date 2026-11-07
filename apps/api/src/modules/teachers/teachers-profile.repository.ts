import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  attendance,
  bookingRequests,
  classrooms,
  enrollments,
  financialPolicies,
  groups,
  groupTeachers,
  sessions,
  students,
  teacherAvailability,
  teacherDues,
  teacherMonthlyRecords,
  teacherPayouts,
} from '../../database/schemas';

@Injectable()
export class TeachersProfileRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async fetchProfileBundle(teacherId: string, yearMonth: string) {
    const activeStudentsSq = sql<number>`(
      SELECT COUNT(*)::int
      FROM ${enrollments} e
      WHERE e.group_id = ${groups.id} AND e.status = 'ACTIVE'
    )`.as('active_students_count');

    const [
      assignedGroupsRaw,
      availability,
      storedDues,
      storedMonthlyRecordRows,
      payouts,
      bookings,
    ] = await Promise.all([
      this.db
        .select({
          id: groups.id,
          groupCode: groups.groupCode,
          name: groups.name,
          subject: groups.subject,
          gradeLevel: groups.gradeLevel,
          monthlySessionsCount: groups.monthlySessionsCount,
          monthlyPrice: groups.monthlyPrice,
          calculatedSessionPrice: groups.calculatedSessionPrice,
          scheduleSlots: groups.scheduleSlots,
          maxStudents: groups.maxStudents,
          isActive: groups.isActive,
          classroomName: classrooms.name,
          activeStudentsCount: activeStudentsSq,
          revenueSplitMethod: financialPolicies.revenueSplitMethod,
          teacherSharePerStudent: financialPolicies.teacherSharePerStudent,
          centerSharePerStudent: financialPolicies.centerSharePerStudent,
          teacherPercentage: financialPolicies.teacherPercentage,
        })
        .from(groups)
        .leftJoin(groupTeachers, eq(groupTeachers.groupId, groups.id))
        .leftJoin(classrooms, eq(groups.defaultClassroomId, classrooms.id))
        .leftJoin(financialPolicies, eq(financialPolicies.groupId, groups.id))
        .where(or(eq(groups.primaryTeacherId, teacherId), eq(groupTeachers.teacherId, teacherId)))
        .orderBy(desc(groups.isActive), asc(groups.name)),

      this.db
        .select()
        .from(teacherAvailability)
        .where(eq(teacherAvailability.teacherId, teacherId))
        .orderBy(asc(teacherAvailability.dayOfWeek), asc(teacherAvailability.startTime)),

      this.db
        .select({
          groupId: teacherDues.groupId,
          groupName: groups.name,
          executedSessionsCount: teacherDues.executedSessionsCount,
          studentsCount: teacherDues.studentsCount,
          grossGroupRevenue: teacherDues.grossGroupRevenue,
          teacherAmount: teacherDues.teacherAmount,
          centerAmount: teacherDues.centerAmount,
          calculationBreakdown: teacherDues.calculationBreakdown,
          isLocked: teacherDues.isLocked,
        })
        .from(teacherDues)
        .innerJoin(groups, eq(teacherDues.groupId, groups.id))
        .where(and(eq(teacherDues.teacherId, teacherId), eq(teacherDues.yearMonth, yearMonth))),

      this.db
        .select()
        .from(teacherMonthlyRecords)
        .where(
          and(
            eq(teacherMonthlyRecords.teacherId, teacherId),
            eq(teacherMonthlyRecords.yearMonth, yearMonth),
          ),
        )
        .limit(1),

      this.db
        .select()
        .from(teacherPayouts)
        .where(eq(teacherPayouts.teacherId, teacherId))
        .orderBy(desc(teacherPayouts.payoutDate), desc(teacherPayouts.createdAt)),

      this.db
        .select({
          id: bookingRequests.id,
          requestType: bookingRequests.requestType,
          purpose: bookingRequests.purpose,
          requestedDate: bookingRequests.requestedDate,
          startTime: bookingRequests.startTime,
          endTime: bookingRequests.endTime,
          durationMinutes: bookingRequests.durationMinutes,
          expectedAttendees: bookingRequests.expectedAttendees,
          status: bookingRequests.status,
          studentName: students.fullName,
          classroomName: classrooms.name,
          notes: bookingRequests.notes,
        })
        .from(bookingRequests)
        .leftJoin(students, eq(bookingRequests.studentId, students.id))
        .leftJoin(classrooms, eq(bookingRequests.assignedClassroomId, classrooms.id))
        .where(eq(bookingRequests.teacherId, teacherId))
        .orderBy(desc(bookingRequests.requestedDate)),
    ]);

    const dedupGroupsMap = new Map<string, (typeof assignedGroupsRaw)[number]>();
    for (const g of assignedGroupsRaw) {
      if (!dedupGroupsMap.has(g.id)) dedupGroupsMap.set(g.id, g);
    }
    const assignedGroups = Array.from(dedupGroupsMap.values());
    const groupIds = assignedGroups.map((g) => g.id);

    const [monthSessions, monthAttendanceCounts] =
      groupIds.length > 0
        ? await Promise.all([
            this.db
              .select({
                id: sessions.id,
                groupId: sessions.groupId,
                status: sessions.status,
                teacherId: sessions.teacherId,
              })
              .from(sessions)
              .where(and(inArray(sessions.groupId, groupIds), eq(sessions.yearMonth, yearMonth))),
            this.db
              .select({
                groupId: sessions.groupId,
                presentEntries: sql<number>`COUNT(*) FILTER (WHERE ${attendance.status} IN ('PRESENT', 'MAKEUP_ATTENDED'))::int`,
              })
              .from(attendance)
              .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
              .where(and(inArray(sessions.groupId, groupIds), eq(sessions.yearMonth, yearMonth)))
              .groupBy(sessions.groupId),
          ])
        : [[], []];

    return {
      assignedGroups,
      availability,
      storedDues,
      storedMonthlyRecord: storedMonthlyRecordRows[0] ?? null,
      payouts,
      bookings,
      monthSessions,
      monthAttendanceCounts,
    };
  }
}
