import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, inArray, isNull, lte, ne, or, SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { BookingStatus, SessionStatus } from '@edu-center/shared';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  bookingRequests,
  classroomBookings,
  classroomMaintenances,
  classrooms,
  groups,
  sessions,
  students,
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
    if (params.classroomId) {
      sessionConditions.push(eq(sessions.classroomId, params.classroomId));
    }

    const bookingConditions: SQL[] = [
      gte(bookingRequests.requestedDate, params.fromDate),
      lte(bookingRequests.requestedDate, params.toDate),
      inArray(bookingRequests.status, [
        BookingStatus.PENDING,
        BookingStatus.CONFIRMED,
        BookingStatus.COMPLETED,
      ]),
    ];
    if (params.teacherId) {
      bookingConditions.push(eq(bookingRequests.teacherId, params.teacherId));
    }
    if (params.classroomId) {
      bookingConditions.push(
        or(
          eq(bookingRequests.assignedClassroomId, params.classroomId),
          and(
            isNull(bookingRequests.assignedClassroomId),
            eq(bookingRequests.requestedClassroomId, params.classroomId),
          ),
        )!,
      );
    }

    const roomBookingConditions: SQL[] = [
      gte(classroomBookings.bookingDate, params.fromDate),
      lte(classroomBookings.bookingDate, params.toDate),
      inArray(classroomBookings.status, [BookingStatus.CONFIRMED, BookingStatus.COMPLETED]),
      isNull(classroomBookings.bookingRequestId),
    ];
    if (params.classroomId) {
      roomBookingConditions.push(eq(classroomBookings.classroomId, params.classroomId));
    }

    const maintConditions: SQL[] = [
      lte(classroomMaintenances.startAt, params.rangeEndUtc),
      gte(classroomMaintenances.endAt, params.rangeStartUtc),
    ];
    if (params.classroomId) {
      maintConditions.push(eq(classroomMaintenances.classroomId, params.classroomId));
    }

    const assignedRoom = alias(classrooms, 'cal_assigned_room');
    const requestedRoom = alias(classrooms, 'cal_requested_room');

    const [
      groupSessions,
      bookings,
      standaloneRoomBookings,
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
          id: bookingRequests.id,
          requestType: bookingRequests.requestType,
          purpose: bookingRequests.purpose,
          requestedDate: bookingRequests.requestedDate,
          startTime: bookingRequests.startTime,
          endTime: bookingRequests.endTime,
          status: bookingRequests.status,
          expectedAttendees: bookingRequests.expectedAttendees,
          teacherId: teachers.id,
          teacherName: teachers.fullName,
          studentName: students.fullName,
          assignedClassroomId: assignedRoom.id,
          assignedClassroomName: assignedRoom.name,
          assignedRoomNumber: assignedRoom.roomNumber,
          requestedClassroomId: requestedRoom.id,
          requestedClassroomName: requestedRoom.name,
          requestedRoomNumber: requestedRoom.roomNumber,
        })
        .from(bookingRequests)
        .innerJoin(teachers, eq(bookingRequests.teacherId, teachers.id))
        .leftJoin(students, eq(bookingRequests.studentId, students.id))
        .leftJoin(assignedRoom, eq(bookingRequests.assignedClassroomId, assignedRoom.id))
        .leftJoin(requestedRoom, eq(bookingRequests.requestedClassroomId, requestedRoom.id))
        .where(and(...bookingConditions))
        .orderBy(asc(bookingRequests.requestedDate), asc(bookingRequests.startTime)),
      params.teacherId
        ? Promise.resolve([])
        : this.db
            .select({
              id: classroomBookings.id,
              bookingDate: classroomBookings.bookingDate,
              startTime: classroomBookings.startTime,
              endTime: classroomBookings.endTime,
              title: classroomBookings.title,
              status: classroomBookings.status,
              classroomId: classrooms.id,
              classroomName: classrooms.name,
              roomNumber: classrooms.roomNumber,
            })
            .from(classroomBookings)
            .innerJoin(classrooms, eq(classroomBookings.classroomId, classrooms.id))
            .where(and(...roomBookingConditions)),
      params.teacherId
        ? Promise.resolve([])
        : this.db
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
      bookings,
      standaloneRoomBookings,
      maintenances,
      allClassrooms,
      allTeachers,
    };
  }
}
