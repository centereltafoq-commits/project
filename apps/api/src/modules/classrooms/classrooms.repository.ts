import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, or, sql, SQL } from 'drizzle-orm';
import { SessionStatus } from '@edu-center/shared';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  classroomMaintenances,
  classrooms,
  enrollments,
  GroupScheduleSlot,
  groups,
  sessions,
  teachers,
} from '../../database/schemas';
import { normalizePagination } from '../../common/utils/pagination.util';
import { ClassroomQueryDto } from './dto/classroom.dto';

@Injectable()
export class ClassroomsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async findPaginated(query: ClassroomQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const conditions: SQL[] = [];

    if (query.status) {
      conditions.push(eq(classrooms.status, query.status));
    }
    if (query.minCapacity) {
      conditions.push(gte(classrooms.maxCapacity, query.minCapacity));
    }
    if (query.search) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(or(ilike(classrooms.roomNumber, pattern), ilike(classrooms.name, pattern))!);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const upcomingMaintSq = sql<number>`(
      SELECT COUNT(*)::int
      FROM ${classroomMaintenances} cm
      WHERE cm.classroom_id = "classrooms"."id" AND cm.end_at >= NOW()
    )`.as('upcoming_maintenances_count');

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: classrooms.id,
          roomNumber: classrooms.roomNumber,
          name: classrooms.name,
          maxCapacity: classrooms.maxCapacity,
          seatsCount: classrooms.seatsCount,
          equipment: classrooms.equipment,
          status: classrooms.status,
          notes: classrooms.notes,
          upcomingMaintenancesCount: upcomingMaintSq,
          createdAt: classrooms.createdAt,
          updatedAt: classrooms.updatedAt,
        })
        .from(classrooms)
        .where(whereClause)
        .orderBy(asc(classrooms.roomNumber))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(classrooms).where(whereClause),
    ]);

    return { rows, total: Number(total), page, limit };
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(classrooms).where(eq(classrooms.id, id)).limit(1);
    return row ?? null;
  }

  async findByRoomNumber(roomNumber: string) {
    const [row] = await this.db
      .select({ id: classrooms.id, roomNumber: classrooms.roomNumber })
      .from(classrooms)
      .where(eq(classrooms.roomNumber, roomNumber))
      .limit(1);
    return row ?? null;
  }

  async listMaintenances(classroomId: string) {
    return this.db
      .select()
      .from(classroomMaintenances)
      .where(eq(classroomMaintenances.classroomId, classroomId))
      .orderBy(desc(classroomMaintenances.startAt));
  }

  async create(data: {
    roomNumber: string;
    name: string;
    maxCapacity: number;
    seatsCount: number;
    equipment: string[];
    status: string;
    notes?: string | null;
  }) {
    const [created] = await this.db
      .insert(classrooms)
      .values({ ...data, notes: data.notes ?? null })
      .returning();
    return created;
  }

  async update(
    id: string,
    updates: Partial<{
      roomNumber: string;
      name: string;
      maxCapacity: number;
      seatsCount: number;
      equipment: string[];
      status: string;
      notes: string | null;
    }>,
  ) {
    const [updated] = await this.db
      .update(classrooms)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(classrooms.id, id))
      .returning();
    return updated ?? null;
  }

  async createMaintenance(classroomId: string, startAt: Date, endAt: Date, reason: string) {
    const [created] = await this.db
      .insert(classroomMaintenances)
      .values({ classroomId, startAt, endAt, reason })
      .returning();
    return created;
  }

  async deleteMaintenance(maintId: string) {
    const [deleted] = await this.db
      .delete(classroomMaintenances)
      .where(eq(classroomMaintenances.id, maintId))
      .returning();
    return deleted ?? null;
  }

  async findAllocatedGroups(classroomId: string) {
    const rawGroups = await this.db
      .select({
        id: groups.id,
        groupCode: groups.groupCode,
        name: groups.name,
        subject: groups.subject,
        gradeLevel: groups.gradeLevel,
        primaryTeacherId: groups.primaryTeacherId,
        teacherName: teachers.fullName,
        defaultClassroomId: groups.defaultClassroomId,
        scheduleSlots: groups.scheduleSlots,
        maxStudents: groups.maxStudents,
        isActive: groups.isActive,
      })
      .from(groups)
      .innerJoin(teachers, eq(groups.primaryTeacherId, teachers.id))
      .where(
        and(
          eq(groups.isActive, true),
          or(
            eq(groups.defaultClassroomId, classroomId),
            sql`EXISTS (
              SELECT 1 FROM jsonb_array_elements(${groups.scheduleSlots}) AS slot
              WHERE (slot->>'classroomId') = ${classroomId}
            )`,
          ),
        ),
      )
      .orderBy(asc(groups.name));

    if (rawGroups.length === 0) return [];

    const groupIds = rawGroups.map((g) => g.id);
    const enrollmentCounts = await this.db
      .select({
        groupId: enrollments.groupId,
        count: count(),
      })
      .from(enrollments)
      .where(and(inArray(enrollments.groupId, groupIds), eq(enrollments.status, 'ACTIVE')))
      .groupBy(enrollments.groupId);

    const countMap = new Map<string, number>();
    for (const ec of enrollmentCounts) {
      countMap.set(ec.groupId, Number(ec.count));
    }

    return rawGroups.map((g) => ({
      ...g,
      enrolledCount: countMap.get(g.id) ?? 0,
      slotsForThisRoom: (g.scheduleSlots ?? []).filter(
        (s) =>
          s.classroomId === classroomId ||
          (!s.classroomId && g.defaultClassroomId === classroomId),
      ),
    }));
  }

  async findUnallocatedGroups() {
    const rawGroups = await this.db
      .select({
        id: groups.id,
        groupCode: groups.groupCode,
        name: groups.name,
        subject: groups.subject,
        gradeLevel: groups.gradeLevel,
        primaryTeacherId: groups.primaryTeacherId,
        teacherName: teachers.fullName,
        defaultClassroomId: groups.defaultClassroomId,
        scheduleSlots: groups.scheduleSlots,
        maxStudents: groups.maxStudents,
        isActive: groups.isActive,
      })
      .from(groups)
      .innerJoin(teachers, eq(groups.primaryTeacherId, teachers.id))
      .where(
        and(
          eq(groups.isActive, true),
          isNull(groups.defaultClassroomId),
          or(
            isNull(groups.scheduleSlots),
            sql`jsonb_array_length(COALESCE(${groups.scheduleSlots}, '[]'::jsonb)) = 0`,
            sql`EXISTS (
              SELECT 1 FROM jsonb_array_elements(COALESCE(${groups.scheduleSlots}, '[]'::jsonb)) AS slot
              WHERE (slot->>'classroomId') IS NULL OR (slot->>'classroomId') = ''
            )`,
          ),
        ),
      )
      .orderBy(asc(groups.name));

    if (rawGroups.length === 0) return [];

    const groupIds = rawGroups.map((g) => g.id);
    const enrollmentCounts = await this.db
      .select({
        groupId: enrollments.groupId,
        count: count(),
      })
      .from(enrollments)
      .where(and(inArray(enrollments.groupId, groupIds), eq(enrollments.status, 'ACTIVE')))
      .groupBy(enrollments.groupId);

    const countMap = new Map<string, number>();
    for (const ec of enrollmentCounts) {
      countMap.set(ec.groupId, Number(ec.count));
    }

    return rawGroups.map((g) => ({
      ...g,
      enrolledCount: countMap.get(g.id) ?? 0,
    }));
  }

  async findAllActiveGroups() {
    const rawGroups = await this.db
      .select({
        id: groups.id,
        groupCode: groups.groupCode,
        name: groups.name,
        subject: groups.subject,
        gradeLevel: groups.gradeLevel,
        primaryTeacherId: groups.primaryTeacherId,
        teacherName: teachers.fullName,
        defaultClassroomId: groups.defaultClassroomId,
        defaultClassroomName: classrooms.name,
        scheduleSlots: groups.scheduleSlots,
        maxStudents: groups.maxStudents,
        isActive: groups.isActive,
      })
      .from(groups)
      .innerJoin(teachers, eq(groups.primaryTeacherId, teachers.id))
      .leftJoin(classrooms, eq(groups.defaultClassroomId, classrooms.id))
      .where(eq(groups.isActive, true))
      .orderBy(asc(groups.name));

    if (rawGroups.length === 0) return [];

    const groupIds = rawGroups.map((g) => g.id);
    const enrollmentCounts = await this.db
      .select({
        groupId: enrollments.groupId,
        count: count(),
      })
      .from(enrollments)
      .where(and(inArray(enrollments.groupId, groupIds), eq(enrollments.status, 'ACTIVE')))
      .groupBy(enrollments.groupId);

    const countMap = new Map<string, number>();
    for (const ec of enrollmentCounts) {
      countMap.set(ec.groupId, Number(ec.count));
    }

    return rawGroups.map((g) => ({
      ...g,
      enrolledCount: countMap.get(g.id) ?? 0,
    }));
  }

  async findGroupById(groupId: string) {
    const [row] = await this.db
      .select({
        id: groups.id,
        name: groups.name,
        groupCode: groups.groupCode,
        subject: groups.subject,
        gradeLevel: groups.gradeLevel,
        primaryTeacherId: groups.primaryTeacherId,
        defaultClassroomId: groups.defaultClassroomId,
        scheduleSlots: groups.scheduleSlots,
        maxStudents: groups.maxStudents,
      })
      .from(groups)
      .where(eq(groups.id, groupId))
      .limit(1);
    return row ?? null;
  }

  async getGroupActiveEnrollmentCount(groupId: string): Promise<number> {
    const [res] = await this.db
      .select({ count: count() })
      .from(enrollments)
      .where(and(eq(enrollments.groupId, groupId), eq(enrollments.status, 'ACTIVE')));
    return Number(res?.count ?? 0);
  }

  async allocateGroup(
    classroomId: string,
    groupId: string,
    slots?: GroupScheduleSlot[],
    updateUpcomingSessions: boolean = true,
  ) {
    const group = await this.findGroupById(groupId);
    if (!group) return null;

    const baseSlots = slots ?? group.scheduleSlots ?? [];
    const updatedSlots = baseSlots.map((s) => ({
      ...s,
      classroomId: slots
        ? (s.classroomId ?? classroomId)
        : s.classroomId && s.classroomId !== group.defaultClassroomId
          ? s.classroomId
          : classroomId,
    }));

    await this.db
      .update(groups)
      .set({
        defaultClassroomId: classroomId,
        scheduleSlots: updatedSlots,
        updatedAt: new Date(),
      })
      .where(eq(groups.id, groupId));

    if (updateUpcomingSessions) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const upcomingSessions = await this.db
        .select({
          id: sessions.id,
          sessionDate: sessions.sessionDate,
          startTime: sessions.startTime,
          endTime: sessions.endTime,
        })
        .from(sessions)
        .where(
          and(
            eq(sessions.groupId, groupId),
            gte(sessions.sessionDate, todayIso),
            eq(sessions.status, SessionStatus.SCHEDULED),
          ),
        );

      const targetSlotsForThisRoom = updatedSlots.filter(
        (s) => s.classroomId === classroomId,
      );

      const matchingSessionIds: string[] = [];
      for (const sess of upcomingSessions) {
        const [y, m, d] = sess.sessionDate.split('-').map(Number);
        const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
        const matchesSlot = targetSlotsForThisRoom.some(
          (s) => Number(s.dayOfWeek) === dayOfWeek && s.startTime === sess.startTime,
        );
        if (targetSlotsForThisRoom.length === 0 || matchesSlot) {
          matchingSessionIds.push(sess.id);
        }
      }

      if (matchingSessionIds.length > 0) {
        await this.db
          .update(sessions)
          .set({ classroomId })
          .where(inArray(sessions.id, matchingSessionIds));
      }
    }

    return this.findGroupById(groupId);
  }

  async releaseGroup(
    classroomId: string,
    groupId: string,
    updateUpcomingSessions: boolean = true,
  ) {
    const group = await this.findGroupById(groupId);
    if (!group) return null;

    const nextDefaultRoom =
      group.defaultClassroomId === classroomId ? null : group.defaultClassroomId;
    const updatedSlots = (group.scheduleSlots ?? []).map((s) =>
      s.classroomId === classroomId ? { ...s, classroomId: null } : s,
    );

    await this.db
      .update(groups)
      .set({
        defaultClassroomId: nextDefaultRoom,
        scheduleSlots: updatedSlots,
        updatedAt: new Date(),
      })
      .where(eq(groups.id, groupId));

    if (updateUpcomingSessions) {
      const todayIso = new Date().toISOString().slice(0, 10);
      await this.db
        .update(sessions)
        .set({ classroomId: null })
        .where(
          and(
            eq(sessions.groupId, groupId),
            eq(sessions.classroomId, classroomId),
            gte(sessions.sessionDate, todayIso),
            eq(sessions.status, SessionStatus.SCHEDULED),
          ),
        );
    }

    return this.findGroupById(groupId);
  }
}
