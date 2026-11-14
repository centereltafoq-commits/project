import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, lte, ne, SQL } from 'drizzle-orm';
import { SessionStatus } from '@edu-center/shared';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  classroomMaintenances,
  classrooms,
  groups,
  GroupScheduleSlot,
  sessions,
  teachers,
} from '../../database/schemas';

@Injectable()
export class CalendarRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async fetchUnifiedRangeData(params: {
    fromDate: string;
    toDate: string;
    rangeStartUtc: Date;
    rangeEndUtc: Date;
    teacherId?: string;
    classroomId?: string;
  }) {
    const sessionConditions: SQL[] = [
      gte(sessions.sessionDate, params.fromDate),
      lte(sessions.sessionDate, params.toDate),
      ne(sessions.status, SessionStatus.CANCELLED),
    ];
    if (params.teacherId) sessionConditions.push(eq(sessions.teacherId, params.teacherId));

    const activeGroupConditions: SQL[] = [eq(groups.isActive, true)];
    if (params.teacherId) {
      activeGroupConditions.push(eq(groups.primaryTeacherId, params.teacherId));
    }

    const maintConditions: SQL[] = [
      lte(classroomMaintenances.startAt, params.rangeEndUtc),
      gte(classroomMaintenances.endAt, params.rangeStartUtc),
    ];
    if (params.classroomId) {
      maintConditions.push(eq(classroomMaintenances.classroomId, params.classroomId));
    }

    const [
      groupSessions,
      activeGroups,
      maintenances,
      allClassrooms,
      allTeachers,
    ] = await Promise.all([
      this.db
        .select({
          id: sessions.id,
          sessionDate: sessions.sessionDate,
          startTime: sessions.startTime,
          endTime: sessions.endTime,
          status: sessions.status,
          topic: sessions.topic,
          groupId: groups.id,
          groupName: groups.name,
          groupCode: groups.groupCode,
          subject: groups.subject,
          teacherId: teachers.id,
          teacherName: teachers.fullName,
          classroomId: classrooms.id,
          classroomName: classrooms.name,
          roomNumber: classrooms.roomNumber,
        })
        .from(sessions)
        .innerJoin(groups, eq(sessions.groupId, groups.id))
        .innerJoin(teachers, eq(sessions.teacherId, teachers.id))
        .leftJoin(classrooms, eq(sessions.classroomId, classrooms.id))
        .where(and(...sessionConditions))
        .orderBy(asc(sessions.sessionDate), asc(sessions.startTime)),
      this.db
        .select({
          id: groups.id,
          name: groups.name,
          groupCode: groups.groupCode,
          subject: groups.subject,
          primaryTeacherId: groups.primaryTeacherId,
          teacherName: teachers.fullName,
          defaultClassroomId: groups.defaultClassroomId,
          scheduleSlots: groups.scheduleSlots,
        })
        .from(groups)
        .innerJoin(teachers, eq(groups.primaryTeacherId, teachers.id))
        .where(and(...activeGroupConditions))
        .orderBy(asc(groups.name)),
      this.db
        .select({
          id: classroomMaintenances.id,
          startAt: classroomMaintenances.startAt,
          endAt: classroomMaintenances.endAt,
          reason: classroomMaintenances.reason,
          classroomId: classrooms.id,
          classroomName: classrooms.name,
          roomNumber: classrooms.roomNumber,
        })
        .from(classroomMaintenances)
        .innerJoin(classrooms, eq(classroomMaintenances.classroomId, classrooms.id))
        .where(and(...maintConditions)),
      this.db
        .select({
          id: classrooms.id,
          roomNumber: classrooms.roomNumber,
          name: classrooms.name,
          maxCapacity: classrooms.maxCapacity,
          status: classrooms.status,
        })
        .from(classrooms)
        .orderBy(asc(classrooms.roomNumber)),
      this.db
        .select({
          id: teachers.id,
          fullName: teachers.fullName,
          specialization: teachers.specialization,
        })
        .from(teachers)
        .orderBy(asc(teachers.fullName)),
    ]);

    return {
      groupSessions,
      activeGroups,
      maintenances,
      allClassrooms,
      allTeachers,
    };
  }

  async findGroupForQuickSession(groupId: string) {
    const [row] = await this.db
      .select({
        id: groups.id,
        name: groups.name,
        primaryTeacherId: groups.primaryTeacherId,
        defaultClassroomId: groups.defaultClassroomId,
        scheduleSlots: groups.scheduleSlots,
      })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);
    return row ?? null;
  }

  async findSessionById(sessionId: string) {
    const [row] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);
    return row ?? null;
  }

  async findGroupSessionOnDate(
    groupId: string,
    sessionDate: string,
    preferredStartTime?: string | null,
  ) {
    const rows = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.groupId, groupId),
          eq(sessions.sessionDate, sessionDate),
          ne(sessions.status, SessionStatus.CANCELLED),
        ),
      )
      .orderBy(asc(sessions.startTime));

    if (rows.length === 0) return null;
    if (preferredStartTime) {
      const exact = rows.find((r) => r.startTime.slice(0, 5) === preferredStartTime.slice(0, 5));
      if (exact) return exact;
    }
    return rows.length === 1 ? rows[0]! : null;
  }

  async createQuickSession(input: typeof sessions.$inferInsert) {
    const [created] = await this.db.insert(sessions).values(input).returning();
    return created!;
  }

  async updateSessionSchedule(
    sessionId: string,
    updates: {
      startTime: string;
      endTime: string;
      classroomId: string | null;
      topic?: string | null;
    },
  ) {
    const setPayload: Partial<typeof sessions.$inferInsert> = {
      startTime: updates.startTime,
      endTime: updates.endTime,
      classroomId: updates.classroomId,
      updatedAt: new Date(),
    };
    if (updates.topic !== undefined) {
      setPayload.topic = updates.topic;
    }

    const [updated] = await this.db
      .update(sessions)
      .set(setPayload)
      .where(eq(sessions.id, sessionId))
      .returning();
    return updated ?? null;
  }

  async updateGroupPinnedSchedule(
    groupId: string,
    defaultClassroomId: string | null,
    scheduleSlots: GroupScheduleSlot[],
  ) {
    const [updated] = await this.db
      .update(groups)
      .set({
        defaultClassroomId,
        scheduleSlots,
        updatedAt: new Date(),
      })
      .where(eq(groups.id, groupId))
      .returning();
    return updated ?? null;
  }
}
