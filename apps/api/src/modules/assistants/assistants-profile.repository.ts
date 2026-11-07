import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
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

    const [linkedGroups, storedDues, storedMonthlyRows, payouts] = await Promise.all([
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
        .where(
          and(
            eq(assistantDues.assistantId, assistantId),
            eq(assistantDues.yearMonth, yearMonth),
          ),
        ),

      this.db
        .select()
        .from(assistantMonthlyRecords)
        .where(
          and(
            eq(assistantMonthlyRecords.assistantId, assistantId),
            eq(assistantMonthlyRecords.yearMonth, yearMonth),
          ),
        )
        .limit(1),

      this.db
        .select()
        .from(assistantPayouts)
        .where(eq(assistantPayouts.assistantId, assistantId))
        .orderBy(desc(assistantPayouts.payoutDate), desc(assistantPayouts.createdAt)),
    ]);

    const groupIds = linkedGroups.map((g) => g.groupId);
    const [sessionCounts, attendanceCounts] =
      groupIds.length > 0
        ? await Promise.all([
            this.db
              .select({
                groupId: sessions.groupId,
                executedCount: sql<number>`COUNT(*) FILTER (WHERE ${sessions.status} = 'COMPLETED')::int`,
              })
              .from(sessions)
              .where(and(inArray(sessions.groupId, groupIds), eq(sessions.yearMonth, yearMonth)))
              .groupBy(sessions.groupId),
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
      linkedGroups,
      storedDues,
      storedMonthlyRecord: storedMonthlyRows[0] ?? null,
      payouts,
      sessionCounts,
      attendanceCounts,
    };
  }
}
