import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, gte, ilike, lte, or, SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { BookingStatus } from '@edu-center/shared';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  bookingApprovals,
  bookingRequests,
  bookingSeries,
  classroomBookings,
  classrooms,
  students,
  teachers,
} from '../../database/schemas';
import { normalizePagination } from '../../common/utils/pagination.util';
import { BookingQueryDto } from './dto/booking.dto';

@Injectable()
export class BookingsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async getLookups() {
    const [teacherList, studentList, classroomList] = await Promise.all([
      this.db
        .select({
          id: teachers.id,
          teacherCode: teachers.teacherCode,
          fullName: teachers.fullName,
          specialization: teachers.specialization,
          userId: teachers.userId,
        })
        .from(teachers)
        .orderBy(asc(teachers.fullName)),
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
    ]);

    return { teachers: teacherList, students: studentList, classrooms: classroomList };
  }

  async findPaginated(query: BookingQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const conditions: SQL[] = [];

    if (query.status) conditions.push(eq(bookingRequests.status, query.status));
    if (query.requestType) conditions.push(eq(bookingRequests.requestType, query.requestType));
    if (query.teacherId) conditions.push(eq(bookingRequests.teacherId, query.teacherId));
    if (query.studentId) conditions.push(eq(bookingRequests.studentId, query.studentId));
    if (query.fromDate) conditions.push(gte(bookingRequests.requestedDate, query.fromDate));
    if (query.toDate) conditions.push(lte(bookingRequests.requestedDate, query.toDate));

    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(
        or(
          ilike(bookingRequests.purpose, pattern),
          ilike(bookingRequests.notes, pattern),
          ilike(teachers.fullName, pattern),
          ilike(students.fullName, pattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const reqRoom = alias(classrooms, 'requested_classroom');
    const assignedRoom = alias(classrooms, 'assigned_classroom');

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: bookingRequests.id,
          seriesId: bookingRequests.seriesId,
          seriesDayOfWeek: bookingSeries.dayOfWeek,
          seriesEndDate: bookingSeries.endDate,
          requestType: bookingRequests.requestType,
          studentId: bookingRequests.studentId,
          studentName: students.fullName,
          studentCode: students.studentCode,
          teacherId: bookingRequests.teacherId,
          teacherName: teachers.fullName,
          purpose: bookingRequests.purpose,
          requestedDate: bookingRequests.requestedDate,
          startTime: bookingRequests.startTime,
          endTime: bookingRequests.endTime,
          durationMinutes: bookingRequests.durationMinutes,
          requestedClassroomId: bookingRequests.requestedClassroomId,
          requestedClassroomName: reqRoom.name,
          requestedRoomNumber: reqRoom.roomNumber,
          assignedClassroomId: bookingRequests.assignedClassroomId,
          assignedClassroomName: assignedRoom.name,
          assignedRoomNumber: assignedRoom.roomNumber,
          expectedAttendees: bookingRequests.expectedAttendees,
          status: bookingRequests.status,
          notes: bookingRequests.notes,
          createdAt: bookingRequests.createdAt,
        })
        .from(bookingRequests)
        .innerJoin(teachers, eq(bookingRequests.teacherId, teachers.id))
        .leftJoin(students, eq(bookingRequests.studentId, students.id))
        .leftJoin(reqRoom, eq(bookingRequests.requestedClassroomId, reqRoom.id))
        .leftJoin(assignedRoom, eq(bookingRequests.assignedClassroomId, assignedRoom.id))
        .leftJoin(bookingSeries, eq(bookingRequests.seriesId, bookingSeries.id))
        .where(whereClause)
        .orderBy(desc(bookingRequests.requestedDate), desc(bookingRequests.startTime))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(bookingRequests)
        .innerJoin(teachers, eq(bookingRequests.teacherId, teachers.id))
        .leftJoin(students, eq(bookingRequests.studentId, students.id))
        .where(whereClause),
    ]);

    return { rows, total: Number(total), page, limit };
  }

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(bookingRequests)
      .where(eq(bookingRequests.id, id))
      .limit(1);
    return row ?? null;
  }

  async findTeacherById(teacherId: string) {
    const [row] = await this.db
      .select()
      .from(teachers)
      .where(eq(teachers.id, teacherId))
      .limit(1);
    return row ?? null;
  }

  async createSingle(input: typeof bookingRequests.$inferInsert) {
    const [created] = await this.db.insert(bookingRequests).values(input).returning();
    return created;
  }

  async createSeriesWithOccurrences(
    seriesInput: typeof bookingSeries.$inferInsert,
    occurrences: Array<Omit<typeof bookingRequests.$inferInsert, 'seriesId'>>,
  ) {
    return this.db.transaction(async (tx) => {
      const [createdSeries] = await tx
        .insert(bookingSeries)
        .values(seriesInput)
        .returning();

      const createdOccurrences = await tx
        .insert(bookingRequests)
        .values(occurrences.map((occ) => ({ ...occ, seriesId: createdSeries.id })))
        .returning();

      return { series: createdSeries, occurrences: createdOccurrences };
    });
  }

  async applyReviewDecision(params: {
    bookingId: string;
    actorUserId: string;
    decision: 'APPROVED' | 'MODIFIED' | 'REJECTED';
    comment?: string;
    updates: Partial<typeof bookingRequests.$inferInsert>;
    classroomAllocation?: {
      classroomId: string;
      bookingDate: string;
      startTime: string;
      endTime: string;
      title: string;
    } | null;
  }) {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(bookingRequests)
        .set({ ...params.updates, updatedAt: new Date() })
        .where(eq(bookingRequests.id, params.bookingId))
        .returning();

      await tx.insert(bookingApprovals).values({
        bookingRequestId: params.bookingId,
        actorUserId: params.actorUserId,
        decision: params.decision,
        assignedClassroomId: params.updates.assignedClassroomId ?? null,
        comment: params.comment ?? null,
      });

      await tx
        .delete(classroomBookings)
        .where(eq(classroomBookings.bookingRequestId, params.bookingId));

      if (params.classroomAllocation) {
        await tx.insert(classroomBookings).values({
          classroomId: params.classroomAllocation.classroomId,
          bookingRequestId: params.bookingId,
          bookingDate: params.classroomAllocation.bookingDate,
          startTime: params.classroomAllocation.startTime,
          endTime: params.classroomAllocation.endTime,
          title: params.classroomAllocation.title,
          status: BookingStatus.CONFIRMED,
          allocatedByUserId: params.actorUserId,
        });
      }

      return updated;
    });
  }

  async cancelSingleOccurrence(bookingId: string, actorUserId: string, comment?: string) {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(bookingRequests)
        .set({ status: BookingStatus.CANCELLED, updatedAt: new Date() })
        .where(eq(bookingRequests.id, bookingId))
        .returning();

      await tx
        .update(classroomBookings)
        .set({ status: BookingStatus.CANCELLED })
        .where(eq(classroomBookings.bookingRequestId, bookingId));

      await tx.insert(bookingApprovals).values({
        bookingRequestId: bookingId,
        actorUserId,
        decision: 'CANCELLED',
        comment: comment ?? 'إلغاء موعد منفرد',
      });

      return updated;
    });
  }

  async markCompleted(bookingId: string) {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(bookingRequests)
        .set({ status: BookingStatus.COMPLETED, updatedAt: new Date() })
        .where(eq(bookingRequests.id, bookingId))
        .returning();

      await tx
        .update(classroomBookings)
        .set({ status: BookingStatus.COMPLETED })
        .where(eq(classroomBookings.bookingRequestId, bookingId));

      return updated;
    });
  }
}
