import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../../database/database.module';
import {
  assistantDues,
  assistantMonthlyRecords,
  studentMonthlyRecords,
  teacherDues,
  teacherMonthlyRecords,
} from '../../../database/schemas';

export type NewStudentMonthlyRow = typeof studentMonthlyRecords.$inferInsert;
export type NewTeacherDueRow = typeof teacherDues.$inferInsert;
export type NewTeacherMonthlyRow = typeof teacherMonthlyRecords.$inferInsert;
export type NewAssistantDueRow = typeof assistantDues.$inferInsert;
export type NewAssistantMonthlyRow = typeof assistantMonthlyRecords.$inferInsert;

export interface PersistSettlementBatchInput {
  yearMonth: string;
  studentRows: NewStudentMonthlyRow[];
  teacherDueRows: NewTeacherDueRow[];
  teacherMonthlyRows: NewTeacherMonthlyRow[];
  openAssistantIdsToRefreshDues: string[];
  assistantDueRows: NewAssistantDueRow[];
  assistantMonthlyRows: NewAssistantMonthlyRow[];
}

@Injectable()
export class MonthlySettlementWriteRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async persistRecalculationBatch(input: PersistSettlementBatchInput): Promise<void> {
    const now = new Date();

    await this.db.transaction(async (tx) => {
      if (input.studentRows.length > 0) {
        await tx
          .insert(studentMonthlyRecords)
          .values(input.studentRows)
          .onConflictDoUpdate({
            target: [
              studentMonthlyRecords.studentId,
              studentMonthlyRecords.groupId,
              studentMonthlyRecords.yearMonth,
            ],
            set: {
              totalGroupSessions: sql`excluded.total_group_sessions`,
              eligibleSessions: sql`excluded.eligible_sessions`,
              presentCount: sql`excluded.present_count`,
              absentCount: sql`excluded.absent_count`,
              excusedCount: sql`excluded.excused_count`,
              makeupAttendedCount: sql`excluded.makeup_attended_count`,
              sessionPriceSnapshot: sql`excluded.session_price_snapshot`,
              extraMakeupFees: sql`excluded.extra_makeup_fees`,
              totalDue: sql`excluded.total_due`,
              totalPaid: sql`excluded.total_paid`,
              remainingBalance: sql`excluded.remaining_balance`,
              updatedAt: now,
            },
            setWhere: eq(studentMonthlyRecords.isClosed, false),
          });
      }

      await tx
        .delete(teacherDues)
        .where(
          and(
            eq(teacherDues.yearMonth, input.yearMonth),
            eq(teacherDues.isLocked, false),
          ),
        );

      if (input.teacherDueRows.length > 0) {
        await tx
          .insert(teacherDues)
          .values(input.teacherDueRows)
          .onConflictDoUpdate({
            target: [teacherDues.teacherId, teacherDues.groupId, teacherDues.yearMonth],
            set: {
              executedSessionsCount: sql`excluded.executed_sessions_count`,
              studentsCount: sql`excluded.students_count`,
              grossGroupRevenue: sql`excluded.gross_group_revenue`,
              teacherAmount: sql`excluded.teacher_amount`,
              centerAmount: sql`excluded.center_amount`,
              calculationBreakdown: sql`excluded.calculation_breakdown`,
              updatedAt: now,
            },
            setWhere: eq(teacherDues.isLocked, false),
          });
      }

      if (input.teacherMonthlyRows.length > 0) {
        await tx
          .insert(teacherMonthlyRecords)
          .values(input.teacherMonthlyRows)
          .onConflictDoUpdate({
            target: [teacherMonthlyRecords.teacherId, teacherMonthlyRecords.yearMonth],
            set: {
              groupsCount: sql`excluded.groups_count`,
              executedSessionsCount: sql`excluded.executed_sessions_count`,
              totalDues: sql`excluded.total_dues`,
              totalPaidOut: sql`excluded.total_paid_out`,
              remainingBalance: sql`excluded.remaining_balance`,
              updatedAt: now,
            },
            setWhere: eq(teacherMonthlyRecords.isClosed, false),
          });
      }

      if (input.openAssistantIdsToRefreshDues.length > 0) {
        await tx
          .delete(assistantDues)
          .where(
            and(
              eq(assistantDues.yearMonth, input.yearMonth),
              eq(assistantDues.isLocked, false),
              inArray(assistantDues.assistantId, input.openAssistantIdsToRefreshDues),
            ),
          );
      }

      if (input.assistantDueRows.length > 0) {
        await tx.insert(assistantDues).values(input.assistantDueRows);
      }

      if (input.assistantMonthlyRows.length > 0) {
        await tx
          .insert(assistantMonthlyRecords)
          .values(input.assistantMonthlyRows)
          .onConflictDoUpdate({
            target: [assistantMonthlyRecords.assistantId, assistantMonthlyRecords.yearMonth],
            set: {
              calculationMethodSnapshot: sql`excluded.calculation_method_snapshot`,
              totalDues: sql`excluded.total_dues`,
              totalPaidOut: sql`excluded.total_paid_out`,
              remainingBalance: sql`excluded.remaining_balance`,
              detailsNote: sql`excluded.details_note`,
              updatedAt: now,
            },
            setWhere: eq(assistantMonthlyRecords.isClosed, false),
          });
      }
    });
  }

  async lockMonthRecords(yearMonth: string) {
    const now = new Date();

    return this.db.transaction(async (tx) => {
      const [lockedStudents, lockedTeacherDues, lockedTeachers, lockedAssistantDues, lockedAssistants] =
        await Promise.all([
          tx
            .update(studentMonthlyRecords)
            .set({ isClosed: true, closedAt: now, updatedAt: now })
            .where(
              and(
                eq(studentMonthlyRecords.yearMonth, yearMonth),
                eq(studentMonthlyRecords.isClosed, false),
              ),
            )
            .returning({ id: studentMonthlyRecords.id }),
          tx
            .update(teacherDues)
            .set({ isLocked: true, updatedAt: now })
            .where(and(eq(teacherDues.yearMonth, yearMonth), eq(teacherDues.isLocked, false)))
            .returning({ id: teacherDues.id }),
          tx
            .update(teacherMonthlyRecords)
            .set({ isClosed: true, updatedAt: now })
            .where(
              and(
                eq(teacherMonthlyRecords.yearMonth, yearMonth),
                eq(teacherMonthlyRecords.isClosed, false),
              ),
            )
            .returning({ id: teacherMonthlyRecords.id }),
          tx
            .update(assistantDues)
            .set({ isLocked: true, updatedAt: now })
            .where(
              and(eq(assistantDues.yearMonth, yearMonth), eq(assistantDues.isLocked, false)),
            )
            .returning({ id: assistantDues.id }),
          tx
            .update(assistantMonthlyRecords)
            .set({ isClosed: true, updatedAt: now })
            .where(
              and(
                eq(assistantMonthlyRecords.yearMonth, yearMonth),
                eq(assistantMonthlyRecords.isClosed, false),
              ),
            )
            .returning({ id: assistantMonthlyRecords.id }),
        ]);

      return {
        closedStudentRecords: lockedStudents.length,
        lockedTeacherDues: lockedTeacherDues.length,
        closedTeacherRecords: lockedTeachers.length,
        lockedAssistantDues: lockedAssistantDues.length,
        closedAssistantRecords: lockedAssistants.length,
      };
    });
  }
}
