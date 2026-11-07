import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, inArray, or, sql, SQL } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  attendance,
  classrooms,
  groups,
  sessions,
  students,
  teachers,
} from '../../database/schemas';
import { normalizePagination } from '../../common/utils/pagination.util';
import { SessionQueryDto } from './dto/session.dto';

@Injectable()
export class AttendanceRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async getLookups() {
    const [groupList, teacherList, classroomList, studentList] = await Promise.all([
      this.db
        .select({
          id: groups.id,
          groupCode: groups.groupCode,
          name: groups.name,
          subject: groups.subject,
          gradeLevel: groups.gradeLevel,
          primaryTeacherId: groups.primaryTeacherId,
          defaultClassroomId: groups.defaultClassroomId,
        })
        .from(groups)
        .where(eq(groups.isActive, true))
        .orderBy(asc(groups.name)),
      this.db
        .select({ id: teachers.id, fullName: teachers.fullName, teacherCode: teachers.teacherCode })
        .from(teachers)
        .orderBy(asc(teachers.fullName)),
      this.db
        .select({
          id: classrooms.id,
          roomNumber: classrooms.roomNumber,
          name: classrooms.name,
          maxCapacity: classrooms.maxCapacity,
        })
        .from(classrooms)
        .orderBy(asc(classrooms.roomNumber)),
      this.db
        .select({
          id: students.id,
          studentCode: students.studentCode,
          fullName: students.fullName,
          gradeLevel: students.gradeLevel,
        })
        .from(students)
        .orderBy(asc(students.fullName))
        .limit(500),
    ]);

    return {
      groups: groupList,
      teachers: teacherList,
      classrooms: classroomList,
      students: studentList,
    };
  }

  async findSessionsPaginated(query: SessionQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const conditions: SQL[] = [];

    if (query.groupId) conditions.push(eq(sessions.groupId, query.groupId));
    if (query.teacherId) conditions.push(eq(sessions.teacherId, query.teacherId));
    if (query.yearMonth) conditions.push(eq(sessions.yearMonth, query.yearMonth));
    if (query.sessionDate) conditions.push(eq(sessions.sessionDate, query.sessionDate));
    if (query.status) conditions.push(eq(sessions.status, query.status));
    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(
        or(
          ilike(groups.name, pattern),
          ilike(groups.groupCode, pattern),
          ilike(teachers.fullName, pattern),
          ilike(sessions.topic, pattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: sessions.id,
          groupId: sessions.groupId,
          groupName: groups.name,
          groupCode: groups.groupCode,
          subject: groups.subject,
          teacherId: sessions.teacherId,
          teacherName: teachers.fullName,
          classroomId: sessions.classroomId,
          classroomName: classrooms.name,
          roomNumber: classrooms.roomNumber,
          sessionDate: sessions.sessionDate,
          yearMonth: sessions.yearMonth,
          startTime: sessions.startTime,
          endTime: sessions.endTime,
          status: sessions.status,
          topic: sessions.topic,
          notes: sessions.notes,
        })
        .from(sessions)
        .innerJoin(groups, eq(sessions.groupId, groups.id))
        .innerJoin(teachers, eq(sessions.teacherId, teachers.id))
        .leftJoin(classrooms, eq(sessions.classroomId, classrooms.id))
        .where(whereClause)
        .orderBy(desc(sessions.sessionDate), desc(sessions.startTime))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(sessions)
        .innerJoin(groups, eq(sessions.groupId, groups.id))
        .innerJoin(teachers, eq(sessions.teacherId, teachers.id))
        .where(whereClause),
    ]);

    const sessionIds = rows.map((r) => r.id);
    const statsMap = new Map<string, { presentCount: number; recordedCount: number }>();

    if (sessionIds.length > 0) {
      const counts = await this.db
        .select({
          sessionId: attendance.sessionId,
          recordedCount: count(),
          presentCount: sql<number>`count(*) filter (where ${attendance.status} in ('PRESENT', 'MAKEUP_ATTENDED'))`,
        })
        .from(attendance)
        .where(inArray(attendance.sessionId, sessionIds))
        .groupBy(attendance.sessionId);

      for (const c of counts) {
        statsMap.set(c.sessionId, {
          presentCount: Number(c.presentCount),
          recordedCount: Number(c.recordedCount),
        });
      }
    }

    const enriched = rows.map((r) => ({
      ...r,
      presentCount: statsMap.get(r.id)?.presentCount ?? 0,
      recordedCount: statsMap.get(r.id)?.recordedCount ?? 0,
    }));

    return { rows: enriched, total: Number(total), page, limit };
  }

  async findGroupById(groupId: string) {
    const [row] = await this.db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
    return row ?? null;
  }

  async findSessionById(sessionId: string) {
    const [row] = await this.db
      .select({
        id: sessions.id,
        groupId: sessions.groupId,
        groupName: groups.name,
        groupCode: groups.groupCode,
        subject: groups.subject,
        gradeLevel: groups.gradeLevel,
        teacherId: sessions.teacherId,
        teacherName: teachers.fullName,
        classroomId: sessions.classroomId,
        classroomName: classrooms.name,
        roomNumber: classrooms.roomNumber,
        sessionDate: sessions.sessionDate,
        yearMonth: sessions.yearMonth,
        startTime: sessions.startTime,
        endTime: sessions.endTime,
        status: sessions.status,
        topic: sessions.topic,
        notes: sessions.notes,
      })
      .from(sessions)
      .innerJoin(groups, eq(sessions.groupId, groups.id))
      .innerJoin(teachers, eq(sessions.teacherId, teachers.id))
      .leftJoin(classrooms, eq(sessions.classroomId, classrooms.id))
      .where(eq(sessions.id, sessionId))
      .limit(1);
    return row ?? null;
  }

  async createSession(input: typeof sessions.$inferInsert) {
    const [created] = await this.db.insert(sessions).values(input).returning();
    return created;
  }

  async findExistingGroupSessionsInMonth(groupId: string, yearMonth: string) {
    return this.db
      .select({ sessionDate: sessions.sessionDate, startTime: sessions.startTime })
      .from(sessions)
      .where(and(eq(sessions.groupId, groupId), eq(sessions.yearMonth, yearMonth)));
  }

  async insertSessionsBatch(rows: Array<typeof sessions.$inferInsert>) {
    if (rows.length === 0) return [];
    return this.db.insert(sessions).values(rows).returning();
  }
}
