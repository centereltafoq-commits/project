import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  attendance,
  classrooms,
  enrollments,
  financialPolicies,
  groups,
  groupTeachers,
  sessions,
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
      allStoredDues,
      allStoredMonthlyRecords,
      payouts,
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
          yearMonth: teacherDues.yearMonth,
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
        .where(eq(teacherDues.teacherId, teacherId)),

      this.db
        .select()
        .from(teacherMonthlyRecords)
        .where(eq(teacherMonthlyRecords.teacherId, teacherId)),

      this.db
        .select()
        .from(teacherPayouts)
        .where(eq(teacherPayouts.teacherId, teacherId))
        .orderBy(desc(teacherPayouts.payoutDate), desc(teacherPayouts.createdAt)),
    ]);

    const dedupGroupsMap = new Map<string, (typeof assignedGroupsRaw)[number]>();
    for (const g of assignedGroupsRaw) {
      if (!dedupGroupsMap.has(g.id)) dedupGroupsMap.set(g.id, g);
    }
    const assignedGroups = Array.from(dedupGroupsMap.values());
    const groupIds = assignedGroups.map((g) => g.id);

    const [allGroupSessions, allAttendanceCountsBySession] =
      groupIds.length > 0
        ? await Promise.all([
            this.db
              .select({
                id: sessions.id,
                groupId: sessions.groupId,
                groupName: groups.name,
                yearMonth: sessions.yearMonth,
                sessionDate: sessions.sessionDate,
                startTime: sessions.startTime,
                endTime: sessions.endTime,
                topic: sessions.topic,
                status: sessions.status,
                teacherId: sessions.teacherId,
              })
              .from(sessions)
              .innerJoin(groups, eq(sessions.groupId, groups.id))
              .where(and(inArray(sessions.groupId, groupIds), ne(sessions.status, 'CANCELLED')))
              .orderBy(desc(sessions.sessionDate), desc(sessions.startTime)),
            this.db
              .select({
                sessionId: attendance.sessionId,
                groupId: sessions.groupId,
                yearMonth: sessions.yearMonth,
                presentEntries: sql<number>`COUNT(*) FILTER (WHERE ${attendance.status} = 'PRESENT')::int`,
              })
              .from(attendance)
              .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
              .where(and(inArray(sessions.groupId, groupIds), ne(sessions.status, 'CANCELLED')))
              .groupBy(attendance.sessionId, sessions.groupId, sessions.yearMonth),
          ])
        : [[], []];

    const storedDues = allStoredDues.filter((d) => d.yearMonth === yearMonth);
    const storedMonthlyRecord =
      allStoredMonthlyRecords.find((r) => r.yearMonth === yearMonth) ?? null;
    const monthSessions = allGroupSessions.filter((s) => s.yearMonth === yearMonth);

    const monthAttendanceByGroupMap = new Map<string, number>();
    for (const row of allAttendanceCountsBySession) {
      if (row.yearMonth !== yearMonth) continue;
      monthAttendanceByGroupMap.set(
        row.groupId,
        (monthAttendanceByGroupMap.get(row.groupId) ?? 0) + Number(row.presentEntries || 0),
      );
    }
    const monthAttendanceCounts = Array.from(monthAttendanceByGroupMap.entries()).map(
      ([groupId, presentEntries]) => ({ groupId, presentEntries }),
    );

    return {
      assignedGroups,
      availability,
      storedDues,
      storedMonthlyRecord,
      payouts,
      monthSessions,
      monthAttendanceCounts,
      allStoredDues,
      allStoredMonthlyRecords,
      allGroupSessions,
      allAttendanceCountsBySession,
    };
  }
}
