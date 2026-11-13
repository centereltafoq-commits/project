import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gt, gte, lt, lte, ne, notExists, or, sql } from 'drizzle-orm';
import { ClassroomStatus } from '@edu-center/shared';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  classroomMaintenances,
  classrooms,
  groups,
  sessions,
  teachers,
} from '../../database/schemas';
import { AvailableClassroomsQueryDto } from './dto/classroom.dto';

@Injectable()
export class ClassroomsAvailabilityRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async findAvailable(query: AvailableClassroomsQueryDto) {
    const windowStart = new Date(`${query.date}T${query.startTime}:00`);
    const windowEnd = new Date(`${query.date}T${query.endTime}:00`);
    const [qy, qm, qd] = query.date.split('-').map(Number);
    const queryDayOfWeek = new Date(Date.UTC(qy!, qm! - 1, qd!)).getUTCDay();

    return this.db
      .select()
      .from(classrooms)
      .where(
        and(
          eq(classrooms.status, ClassroomStatus.AVAILABLE),
          gte(classrooms.maxCapacity, query.minCapacity || 1),
          notExists(
            this.db
              .select({ id: classroomMaintenances.id })
              .from(classroomMaintenances)
              .where(
                and(
                  eq(classroomMaintenances.classroomId, classrooms.id),
                  lt(classroomMaintenances.startAt, windowEnd),
                  gt(classroomMaintenances.endAt, windowStart),
                ),
              ),
          ),
          notExists(
            this.db
              .select({ id: sessions.id })
              .from(sessions)
              .where(
                and(
                  eq(sessions.classroomId, classrooms.id),
                  eq(sessions.sessionDate, query.date),
                  ne(sessions.status, 'CANCELLED'),
                  lt(sessions.startTime, query.endTime),
                  gt(sessions.endTime, query.startTime),
                ),
              ),
          ),
          notExists(
            this.db
              .select({ id: groups.id })
              .from(groups)
              .where(
                and(
                  eq(groups.isActive, true),
                  sql`EXISTS (
                    SELECT 1 FROM jsonb_array_elements(COALESCE(${groups.scheduleSlots}, '[]'::jsonb)) AS slot
                    WHERE (
                      (slot->>'classroomId') = ${classrooms.id}::text
                      OR ((slot->>'classroomId') IS NULL AND ${groups.defaultClassroomId} = ${classrooms.id})
                    )
                    AND (slot->>'dayOfWeek')::int = ${queryDayOfWeek}
                    AND (slot->>'startTime') < ${query.endTime}
                    AND (slot->>'endTime') > ${query.startTime}
                  )`,
                ),
              ),
          ),
        ),
      )
      .orderBy(asc(classrooms.roomNumber));
  }

  async fetchSchedule(classroomId: string, from: string, to: string) {
    const rangeStart = new Date(`${from}T00:00:00`);
    const rangeEnd = new Date(`${to}T23:59:59`);

    const [roomSessions, maintenances, rawGroups] = await Promise.all([
      this.db
        .select({
          id: sessions.id,
          sessionDate: sessions.sessionDate,
          startTime: sessions.startTime,
          endTime: sessions.endTime,
          status: sessions.status,
          topic: sessions.topic,
          groupName: groups.name,
          teacherName: teachers.fullName,
        })
        .from(sessions)
        .innerJoin(groups, eq(sessions.groupId, groups.id))
        .innerJoin(teachers, eq(sessions.teacherId, teachers.id))
        .where(
          and(
            eq(sessions.classroomId, classroomId),
            gte(sessions.sessionDate, from),
            lte(sessions.sessionDate, to),
          ),
        )
        .orderBy(asc(sessions.sessionDate), asc(sessions.startTime)),

      this.db
        .select()
        .from(classroomMaintenances)
        .where(
          and(
            eq(classroomMaintenances.classroomId, classroomId),
            lte(classroomMaintenances.startAt, rangeEnd),
            gte(classroomMaintenances.endAt, rangeStart),
          ),
        )
        .orderBy(desc(classroomMaintenances.startAt)),

      this.db
        .select({
          id: groups.id,
          groupCode: groups.groupCode,
          name: groups.name,
          subject: groups.subject,
          gradeLevel: groups.gradeLevel,
          teacherName: teachers.fullName,
          defaultClassroomId: groups.defaultClassroomId,
          scheduleSlots: groups.scheduleSlots,
          maxStudents: groups.maxStudents,
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
        .orderBy(asc(groups.name)),
    ]);

    const allocatedGroups = rawGroups.map((g) => ({
      ...g,
      slotsForThisRoom: (g.scheduleSlots ?? []).filter(
        (s) =>
          s.classroomId === classroomId ||
          (!s.classroomId && g.defaultClassroomId === classroomId),
      ),
    }));

    return { sessions: roomSessions, maintenances, allocatedGroups };
  }
}
