import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, isNull, lte, ne, or } from 'drizzle-orm';
import { BookingStatus, EnrollmentStatus, SessionStatus } from '@edu-center/shared';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  bookingRequests,
  classroomBookings,
  classroomMaintenances,
  classrooms,
  enrollments,
  groups,
  sessions,
} from '../../database/schemas';

export interface TimeSlotItem {
  id: string;
  startTime: string;
  endTime: string;
  label: string;
  bookingRequestId?: string | null;
}

export interface ConflictContextData {
  teacherConfirmedBookings: TimeSlotItem[];
  teacherSessions: TimeSlotItem[];
  studentConfirmedBookings: TimeSlotItem[];
  studentGroupSessions: TimeSlotItem[];
  classroom: {
    id: string;
    roomNumber: string;
    name: string;
    maxCapacity: number;
    status: string;
  } | null;
  classroomMaintenances: Array<{ id: string; startAt: Date; endAt: Date; reason: string }>;
  classroomBookings: TimeSlotItem[];
  classroomSessions: TimeSlotItem[];
}

@Injectable()
export class BookingsConflictRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async fetchConflictContext(params: {
    date: string;
    teacherId: string;
    studentId?: string | null;
    classroomId?: string | null;
  }): Promise<ConflictContextData> {
    const dayStart = new Date(`${params.date}T00:00:00.000Z`);
    const dayEnd = new Date(`${params.date}T23:59:59.999Z`);
    const bookingSlotFields = {
      id: bookingRequests.id,
      startTime: bookingRequests.startTime,
      endTime: bookingRequests.endTime,
      label: bookingRequests.purpose,
    };
    const sessionSlotFields = {
      id: sessions.id,
      startTime: sessions.startTime,
      endTime: sessions.endTime,
      label: groups.name,
    };

    const [
      teacherBookings,
      teacherSessions,
      studentBookings,
      studentSessions,
      classroomRow,
      roomMaintenances,
      roomBookings,
      roomSessions,
    ] = await Promise.all([
      this.db
        .select(bookingSlotFields)
        .from(bookingRequests)
        .where(
          and(
            eq(bookingRequests.teacherId, params.teacherId),
            eq(bookingRequests.requestedDate, params.date),
            eq(bookingRequests.status, BookingStatus.CONFIRMED),
          ),
        ),
      this.db
        .select(sessionSlotFields)
        .from(sessions)
        .innerJoin(groups, eq(sessions.groupId, groups.id))
        .where(
          and(
            eq(sessions.teacherId, params.teacherId),
            eq(sessions.sessionDate, params.date),
            ne(sessions.status, SessionStatus.CANCELLED),
          ),
        ),
      params.studentId
        ? this.db
            .select(bookingSlotFields)
            .from(bookingRequests)
            .where(
              and(
                eq(bookingRequests.studentId, params.studentId),
                eq(bookingRequests.requestedDate, params.date),
                eq(bookingRequests.status, BookingStatus.CONFIRMED),
              ),
            )
        : Promise.resolve([]),
      params.studentId
        ? this.db
            .select(sessionSlotFields)
            .from(enrollments)
            .innerJoin(sessions, eq(sessions.groupId, enrollments.groupId))
            .innerJoin(groups, eq(sessions.groupId, groups.id))
            .where(
              and(
                eq(enrollments.studentId, params.studentId),
                eq(enrollments.status, EnrollmentStatus.ACTIVE),
                lte(enrollments.startDate, params.date),
                or(isNull(enrollments.endDate), gte(enrollments.endDate, params.date))!,
                eq(sessions.sessionDate, params.date),
                ne(sessions.status, SessionStatus.CANCELLED),
              ),
            )
        : Promise.resolve([]),
      params.classroomId
        ? this.db
            .select({
              id: classrooms.id,
              roomNumber: classrooms.roomNumber,
              name: classrooms.name,
              maxCapacity: classrooms.maxCapacity,
              status: classrooms.status,
            })
            .from(classrooms)
            .where(eq(classrooms.id, params.classroomId))
            .limit(1)
            .then((r) => r[0] ?? null)
        : Promise.resolve(null),
      params.classroomId
        ? this.db
            .select({
              id: classroomMaintenances.id,
              startAt: classroomMaintenances.startAt,
              endAt: classroomMaintenances.endAt,
              reason: classroomMaintenances.reason,
            })
            .from(classroomMaintenances)
            .where(
              and(
                eq(classroomMaintenances.classroomId, params.classroomId),
                lte(classroomMaintenances.startAt, dayEnd),
                gte(classroomMaintenances.endAt, dayStart),
              ),
            )
        : Promise.resolve([]),
      params.classroomId
        ? this.db
            .select({
              id: classroomBookings.id,
              startTime: classroomBookings.startTime,
              endTime: classroomBookings.endTime,
              label: classroomBookings.title,
              bookingRequestId: classroomBookings.bookingRequestId,
            })
            .from(classroomBookings)
            .where(
              and(
                eq(classroomBookings.classroomId, params.classroomId),
                eq(classroomBookings.bookingDate, params.date),
                eq(classroomBookings.status, BookingStatus.CONFIRMED),
              ),
            )
        : Promise.resolve([]),
      params.classroomId
        ? this.db
            .select(sessionSlotFields)
            .from(sessions)
            .innerJoin(groups, eq(sessions.groupId, groups.id))
            .where(
              and(
                eq(sessions.classroomId, params.classroomId),
                eq(sessions.sessionDate, params.date),
                ne(sessions.status, SessionStatus.CANCELLED),
              ),
            )
        : Promise.resolve([]),
    ]);

    return {
      teacherConfirmedBookings: teacherBookings,
      teacherSessions,
      studentConfirmedBookings: studentBookings,
      studentGroupSessions: studentSessions,
      classroom: classroomRow,
      classroomMaintenances: roomMaintenances,
      classroomBookings: roomBookings,
      classroomSessions: roomSessions,
    };
  }

  async fetchAllClassroomsDayContext(date: string) {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const [allClassrooms, maintenances, roomBookings, roomSessions] = await Promise.all([
      this.db.select().from(classrooms).orderBy(asc(classrooms.roomNumber)),
      this.db
        .select()
        .from(classroomMaintenances)
        .where(
          and(
            lte(classroomMaintenances.startAt, dayEnd),
            gte(classroomMaintenances.endAt, dayStart),
          ),
        ),
      this.db
        .select()
        .from(classroomBookings)
        .where(
          and(
            eq(classroomBookings.bookingDate, date),
            eq(classroomBookings.status, BookingStatus.CONFIRMED),
          ),
        ),
      this.db
        .select({
          id: sessions.id,
          classroomId: sessions.classroomId,
          startTime: sessions.startTime,
          endTime: sessions.endTime,
          groupName: groups.name,
        })
        .from(sessions)
        .innerJoin(groups, eq(sessions.groupId, groups.id))
        .where(
          and(eq(sessions.sessionDate, date), ne(sessions.status, SessionStatus.CANCELLED)),
        ),
    ]);

    return { allClassrooms, maintenances, roomBookings, roomSessions };
  }
}
