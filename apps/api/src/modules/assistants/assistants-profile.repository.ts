import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  assistantDues,
  assistantMonthlyRecords,
  assistantPayouts,
  attendance,
  enrollments,
  groupAssistants,
  groups,
  sessions,
  teachers,
} from '../../database/schemas';

@Injectable()
export class AssistantsProfileRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async fetchProfileBundle(assistantId: string, yearMonth: string) {
    const activeStudentsSq = sql<number>`(
      SELECT COUNT(*)::int
      FROM ${enrollments} e
      WHERE e.group_id = ${groups.id} AND e.status = 'ACTIVE'
    )`.as('active_students_count');

    const [linkedGroups, allStoredDues, allStoredMonthlyRecords, payouts] = await Promise.all([
      this.db
        .select({
          linkId: groupAssistants.id,
          groupId: groups.id,
          groupCode: groups.groupCode,
          groupName: groups.name,
          subject: groups.subject,
          gradeLevel: groups.gradeLevel,
          teacherName: teachers.fullName,
          monthlySessionsCount: groups.monthlySessionsCount,
          monthlyPrice: groups.monthlyPrice,
          calculatedSessionPrice: groups.calculatedSessionPrice,
          isActive: groups.isActive,
          overrideCalculationMethod: groupAssistants.overrideCalculationMethod,
          overrideRateValue: groupAssistants.overrideRateValue,
          activeStudentsCount: activeStudentsSq,
        })
        .from(groupAssistants)
        .innerJoin(groups, eq(groupAssistants.groupId, groups.id))
        .innerJoin(teachers, eq(groups.primaryTeacherId, teachers.id))
        .where(eq(groupAssistants.assistantId, assistantId)),

      this.db
        .select({
          id: assistantDues.id,
          yearMonth: assistantDues.yearMonth,
          groupId: assistantDues.groupId,
          groupName: groups.name,
          calculationMethod: assistantDues.calculationMethod,
          sessionsCount: assistantDues.sessionsCount,
          studentsCount: assistantDues.studentsCount,
          amount: assistantDues.amount,
          calculationBreakdown: assistantDues.calculationBreakdown,
          isLocked: assistantDues.isLocked,
        })
        .from(assistantDues)
        .leftJoin(groups, eq(assistantDues.groupId, groups.id))
        .where(eq(assistantDues.assistantId, assistantId)),

      this.db
        .select()
        .from(assistantMonthlyRecords)
        .where(eq(assistantMonthlyRecords.assistantId, assistantId)),

      this.db
        .select()
        .from(assistantPayouts)
        .where(eq(assistantPayouts.assistantId, assistantId))
        .orderBy(desc(assistantPayouts.payoutDate), desc(assistantPayouts.createdAt)),
    ]);

    const groupIds = linkedGroups.map((g) => g.groupId);
    const [allSessionCounts, allAttendanceCounts] =
      groupIds.length > 0
        ? await Promise.all([
            this.db
              .select({
                groupId: sessions.groupId,
                yearMonth: sessions.yearMonth,
                executedCount: sql<number>`COUNT(*) FILTER (WHERE ${sessions.status} = 'COMPLETED')::int`,
                executedMinutes: sql<number>`COALESCE(SUM(
                  EXTRACT(EPOCH FROM (${sessions.endTime}::time - ${sessions.startTime}::time)) / 60
                ) FILTER (WHERE ${sessions.status} = 'COMPLETED'), 0)::float`,
              })
              .from(sessions)
              .where(inArray(sessions.groupId, groupIds))
              .groupBy(sessions.groupId, sessions.yearMonth),
            this.db
              .select({
                groupId: sessions.groupId,
                yearMonth: sessions.yearMonth,
                presentEntries: sql<number>`COUNT(*) FILTER (WHERE ${attendance.status} = 'PRESENT')::int`,
              })
              .from(attendance)
              .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
              .where(inArray(sessions.groupId, groupIds))
              .groupBy(sessions.groupId, sessions.yearMonth),
          ])
        : [[], []];

    const storedDues = allStoredDues.filter((d) => d.yearMonth === yearMonth);
    const storedMonthlyRecord =
      allStoredMonthlyRecords.find((r) => r.yearMonth === yearMonth) ?? null;
    const sessionCounts = allSessionCounts.filter((s) => s.yearMonth === yearMonth);
    const attendanceCounts = allAttendanceCounts.filter((a) => a.yearMonth === yearMonth);

    return {
      linkedGroups,
      storedDues,
      storedMonthlyRecord,
      payouts,
      sessionCounts,
      attendanceCounts,
      allStoredDues,
      allStoredMonthlyRecords,
      allSessionCounts,
      allAttendanceCounts,
    };
  }
}
