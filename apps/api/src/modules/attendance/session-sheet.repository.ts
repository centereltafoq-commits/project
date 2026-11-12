import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { EnrollmentStatus, SessionStatus } from '@edu-center/shared';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import { attendance, enrollments, sessions, students, users } from '../../database/schemas';

@Injectable()
export class SessionSheetRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async getSessionSheetStudents(sessionId: string, groupId: string, sessionDate: string) {
    const recorderUser = alias(users, 'recorder_user');
    const updaterUser = alias(users, 'updater_user');

    return this.db
      .select({
        enrollmentId: enrollments.id,
        enrollmentStartDate: enrollments.startDate,
        enrollmentEndDate: enrollments.endDate,
        studentId: students.id,
        studentCode: students.studentCode,
        studentName: students.fullName,
        studentPhone: students.phone,
        guardianPhone: students.guardianPhone,
        attendanceId: attendance.id,
        status: attendance.status,
        notes: attendance.notes,
        recordedAt: attendance.recordedAt,
        updatedAt: attendance.updatedAt,
        recordedByUserId: attendance.recordedByUserId,
        recordedByName: recorderUser.fullName,
        updatedByUserId: attendance.updatedByUserId,
        updatedByName: updaterUser.fullName,
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .leftJoin(
        attendance,
        and(eq(attendance.sessionId, sessionId), eq(attendance.studentId, students.id)),
      )
      .leftJoin(recorderUser, eq(attendance.recordedByUserId, recorderUser.id))
      .leftJoin(updaterUser, eq(attendance.updatedByUserId, updaterUser.id))
      .where(
        and(
          eq(enrollments.groupId, groupId),
          or(
            sql`${attendance.id} IS NOT NULL`,
            and(
              ne(enrollments.status, EnrollmentStatus.CANCELLED),
              lte(enrollments.startDate, sessionDate),
              or(isNull(enrollments.endDate), gte(enrollments.endDate, sessionDate))!,
            ),
          ),
        ),
      )
      .orderBy(asc(students.fullName));
  }

  async findExistingAttendanceMap(sessionId: string) {
    const rows = await this.db
      .select()
      .from(attendance)
      .where(eq(attendance.sessionId, sessionId));
    return new Map(rows.map((r) => [r.studentId, r]));
  }

  async upsertSessionAttendance(params: {
    sessionId: string;
    actorUserId: string;
    topic?: string;
    inserts: Array<{ studentId: string; status: string; notes?: string }>;
    updates: Array<{ studentId: string; status: string; notes?: string }>;
  }) {
    return this.db.transaction(async (tx) => {
      if (params.inserts.length > 0) {
        await tx
          .insert(attendance)
          .values(
            params.inserts.map((item) => ({
              sessionId: params.sessionId,
              studentId: item.studentId,
              status: item.status,
              notes: item.notes ?? null,
              recordedByUserId: params.actorUserId,
              updatedByUserId: null,
            })),
          )
          .onConflictDoUpdate({
            target: [attendance.sessionId, attendance.studentId],
            set: {
              status: sql`excluded.status`,
              notes: sql`excluded.notes`,
              updatedByUserId: params.actorUserId,
              updatedAt: new Date(),
            },
          });
      }

      if (params.updates.length > 0) {
        await tx
          .insert(attendance)
          .values(
            params.updates.map((item) => ({
              sessionId: params.sessionId,
              studentId: item.studentId,
              status: item.status,
              notes: item.notes ?? null,
              recordedByUserId: params.actorUserId,
              updatedByUserId: params.actorUserId,
            })),
          )
          .onConflictDoUpdate({
            target: [attendance.sessionId, attendance.studentId],
            set: {
              status: sql`excluded.status`,
              notes: sql`excluded.notes`,
              updatedByUserId: params.actorUserId,
              updatedAt: new Date(),
            },
          });
      }

      await tx
        .update(sessions)
        .set({
          status: SessionStatus.COMPLETED,
          ...(params.topic !== undefined ? { topic: params.topic } : {}),
          updatedAt: new Date(),
        })
        .where(eq(sessions.id, params.sessionId));
    });
  }
}
