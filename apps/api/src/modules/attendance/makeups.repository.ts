import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, ilike, or, sql, SQL } from 'drizzle-orm';
import { AttendanceStatus } from '@edu-center/shared';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  attendance,
  classrooms,
  groups,
  makeupSessions,
  sessions,
  students,
  users,
} from '../../database/schemas';
import { normalizePagination } from '../../common/utils/pagination.util';
import { MakeupQueryDto } from './dto/makeup.dto';

@Injectable()
export class MakeupsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async findPaginated(query: MakeupQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const conditions: SQL[] = [];

    if (query.studentId) {
      conditions.push(eq(makeupSessions.studentId, query.studentId));
    }
    if (query.status) {
      conditions.push(eq(makeupSessions.status, query.status));
    }
    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(
        or(
          ilike(students.fullName, pattern),
          ilike(students.studentCode, pattern),
          ilike(groups.name, pattern),
          ilike(makeupSessions.notes, pattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: makeupSessions.id,
          studentId: makeupSessions.studentId,
          studentName: students.fullName,
          studentCode: students.studentCode,
          originalSessionId: makeupSessions.originalSessionId,
          groupId: sessions.groupId,
          groupName: groups.name,
          groupCode: groups.groupCode,
          absenceDate: makeupSessions.absenceDate,
          scheduledAt: makeupSessions.scheduledAt,
          classroomId: makeupSessions.classroomId,
          classroomName: classrooms.name,
          roomNumber: classrooms.roomNumber,
          status: makeupSessions.status,
          isFree: makeupSessions.isFree,
          extraFee: makeupSessions.extraFee,
          approvedByUserId: makeupSessions.approvedByUserId,
          approvedByName: users.fullName,
          notes: makeupSessions.notes,
          createdAt: makeupSessions.createdAt,
        })
        .from(makeupSessions)
        .innerJoin(students, eq(makeupSessions.studentId, students.id))
        .innerJoin(sessions, eq(makeupSessions.originalSessionId, sessions.id))
        .innerJoin(groups, eq(sessions.groupId, groups.id))
        .leftJoin(classrooms, eq(makeupSessions.classroomId, classrooms.id))
        .leftJoin(users, eq(makeupSessions.approvedByUserId, users.id))
        .where(whereClause)
        .orderBy(desc(makeupSessions.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(makeupSessions)
        .innerJoin(students, eq(makeupSessions.studentId, students.id))
        .innerJoin(sessions, eq(makeupSessions.originalSessionId, sessions.id))
        .innerJoin(groups, eq(sessions.groupId, groups.id))
        .where(whereClause),
    ]);

    return { rows, total: Number(total), page, limit };
  }

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(makeupSessions)
      .where(eq(makeupSessions.id, id))
      .limit(1);
    return row ?? null;
  }

  async findStudentAttendance(sessionId: string, studentId: string) {
    const [row] = await this.db
      .select()
      .from(attendance)
      .where(and(eq(attendance.sessionId, sessionId), eq(attendance.studentId, studentId)))
      .limit(1);
    return row ?? null;
  }

  async create(input: typeof makeupSessions.$inferInsert) {
    const [created] = await this.db.insert(makeupSessions).values(input).returning();
    return created;
  }

  async updateAndSyncOriginalAttendance(
    id: string,
    updates: Partial<typeof makeupSessions.$inferInsert>,
    syncOriginalToMakeup?: {
      originalSessionId: string;
      studentId: string;
      actorUserId: string;
    },
  ) {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(makeupSessions)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(makeupSessions.id, id))
        .returning();

      if (syncOriginalToMakeup && updated) {
        const [existingAtt] = await tx
          .select()
          .from(attendance)
          .where(
            and(
              eq(attendance.sessionId, syncOriginalToMakeup.originalSessionId),
              eq(attendance.studentId, syncOriginalToMakeup.studentId),
            ),
          )
          .limit(1);

        if (!existingAtt || existingAtt.status !== AttendanceStatus.PRESENT) {
          await tx
            .insert(attendance)
            .values({
              sessionId: syncOriginalToMakeup.originalSessionId,
              studentId: syncOriginalToMakeup.studentId,
              status: AttendanceStatus.MAKEUP_ATTENDED,
              recordedByUserId: syncOriginalToMakeup.actorUserId,
              updatedByUserId: existingAtt ? syncOriginalToMakeup.actorUserId : null,
              notes: 'تم حضور الحصة التعويضية المعتمدة',
            })
            .onConflictDoUpdate({
              target: [attendance.sessionId, attendance.studentId],
              set: {
                status: sql`${AttendanceStatus.MAKEUP_ATTENDED}`,
                updatedByUserId: syncOriginalToMakeup.actorUserId,
                updatedAt: new Date(),
              },
            });
        }
      }

      return updated ?? null;
    });
  }
}
