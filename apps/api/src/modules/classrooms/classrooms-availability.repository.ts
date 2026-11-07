import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gt, gte, lt, lte, ne, notExists } from 'drizzle-orm';
import { ClassroomStatus } from '@edu-center/shared';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  classroomBookings,
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
              .select({ id: classroomBookings.id })
              .from(classroomBookings)
              .where(
                and(
                  eq(classroomBookings.classroomId, classrooms.id),
                  eq(classroomBookings.bookingDate, query.date),
                  eq(classroomBookings.status, 'CONFIRMED'),
                  lt(classroomBookings.startTime, query.endTime),
                  gt(classroomBookings.endTime, query.startTime),
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

    const [roomSessions, roomBookings, maintenances] = await Promise.all([
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
        .from(classroomBookings)
        .where(
          and(
            eq(classroomBookings.classroomId, classroomId),
            gte(classroomBookings.bookingDate, from),
            lte(classroomBookings.bookingDate, to),
          ),
        )
        .orderBy(asc(classroomBookings.bookingDate), asc(classroomBookings.startTime)),

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
    ]);

    return { sessions: roomSessions, bookings: roomBookings, maintenances };
  }
}
