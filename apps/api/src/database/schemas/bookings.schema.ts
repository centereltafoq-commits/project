import {
  pgTable,
  uuid,
  varchar,
  integer,
  date,
  boolean,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { students, teachers } from './profiles.schema';
import { classrooms } from './classrooms.schema';
import { users } from './identity.schema';

export const teacherAvailability = pgTable(
  'teacher_availability',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(), // 0-6
    startTime: varchar('start_time', { length: 8 }).notNull(),
    endTime: varchar('end_time', { length: 8 }).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (t) => [index('idx_teacher_avail_teacher_day').on(t.teacherId, t.dayOfWeek)],
);

export const bookingSeries = pgTable(
  'booking_series',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    requestType: varchar('request_type', { length: 40 }).notNull(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id').references(() => students.id, { onDelete: 'set null' }),
    dayOfWeek: integer('day_of_week').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    startTime: varchar('start_time', { length: 8 }).notNull(),
    endTime: varchar('end_time', { length: 8 }).notNull(),
    purpose: varchar('purpose', { length: 200 }).notNull(),
    requestedClassroomId: uuid('requested_classroom_id').references(() => classrooms.id, {
      onDelete: 'set null',
    }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_booking_series_teacher').on(t.teacherId)],
);

export const bookingRequests = pgTable(
  'booking_requests',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    seriesId: uuid('series_id').references(() => bookingSeries.id, { onDelete: 'set null' }),
    requestType: varchar('request_type', { length: 40 }).notNull(), // STUDENT_WITH_TEACHER | TEACHER_WITH_CENTER
    studentId: uuid('student_id').references(() => students.id, { onDelete: 'set null' }),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'cascade' }),
    purpose: varchar('purpose', { length: 200 }).notNull(),
    requestedDate: date('requested_date').notNull(),
    startTime: varchar('start_time', { length: 8 }).notNull(),
    endTime: varchar('end_time', { length: 8 }).notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    requestedClassroomId: uuid('requested_classroom_id').references(() => classrooms.id, {
      onDelete: 'set null',
    }),
    assignedClassroomId: uuid('assigned_classroom_id').references(() => classrooms.id, {
      onDelete: 'set null',
    }),
    expectedAttendees: integer('expected_attendees').default(1).notNull(),
    status: varchar('status', { length: 24 }).default('PENDING').notNull(), // PENDING | CONFIRMED | REJECTED | CANCELLED | COMPLETED
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_bookings_date_status').on(t.requestedDate, t.status),
    index('idx_bookings_teacher_date').on(t.teacherId, t.requestedDate),
    index('idx_bookings_student_date').on(t.studentId, t.requestedDate),
    index('idx_bookings_classroom_date').on(t.assignedClassroomId, t.requestedDate),
    index('idx_bookings_series').on(t.seriesId),
  ],
);

export const bookingApprovals = pgTable(
  'booking_approvals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    bookingRequestId: uuid('booking_request_id')
      .notNull()
      .references(() => bookingRequests.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    decision: varchar('decision', { length: 32 }).notNull(), // APPROVED | REJECTED | MODIFIED | CANCELLED
    assignedClassroomId: uuid('assigned_classroom_id').references(() => classrooms.id, {
      onDelete: 'set null',
    }),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_booking_approvals_req').on(t.bookingRequestId)],
);

export const classroomBookings = pgTable(
  'classroom_bookings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    classroomId: uuid('classroom_id')
      .notNull()
      .references(() => classrooms.id, { onDelete: 'cascade' }),
    bookingRequestId: uuid('booking_request_id').references(() => bookingRequests.id, {
      onDelete: 'cascade',
    }),
    bookingDate: date('booking_date').notNull(),
    startTime: varchar('start_time', { length: 8 }).notNull(),
    endTime: varchar('end_time', { length: 8 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    status: varchar('status', { length: 24 }).default('CONFIRMED').notNull(),
    allocatedByUserId: uuid('allocated_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_classroom_bookings_room_date').on(t.classroomId, t.bookingDate, t.status),
  ],
);

