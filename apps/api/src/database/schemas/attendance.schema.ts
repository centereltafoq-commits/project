import {
  pgTable,
  uuid,
  varchar,
  date,
  boolean,
  numeric,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { groups } from './groups.schema';
import { students, teachers } from './profiles.schema';
import { classrooms } from './classrooms.schema';
import { users } from './identity.schema';

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'restrict' }),
    classroomId: uuid('classroom_id').references(() => classrooms.id, { onDelete: 'set null' }),
    sessionDate: date('session_date').notNull(),
    yearMonth: varchar('year_month', { length: 7 }).notNull(), // YYYY-MM
    startTime: varchar('start_time', { length: 8 }).notNull(), // HH:mm
    endTime: varchar('end_time', { length: 8 }).notNull(), // HH:mm
    status: varchar('status', { length: 24 }).default('SCHEDULED').notNull(),
    topic: varchar('topic', { length: 200 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_sessions_group_month').on(t.groupId, t.yearMonth),
    index('idx_sessions_date').on(t.sessionDate),
    index('idx_sessions_teacher_date').on(t.teacherId, t.sessionDate),
    index('idx_sessions_classroom_date').on(t.classroomId, t.sessionDate),
  ],
);

export const attendance = pgTable(
  'attendance',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 24 }).notNull(), // PRESENT | ABSENT | EXCUSED | MAKEUP_ATTENDED
    recordedByUserId: uuid('recorded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_attendance_session_student').on(t.sessionId, t.studentId),
    index('idx_attendance_student').on(t.studentId),
    index('idx_attendance_status').on(t.status),
  ],
);

export const makeupSessions = pgTable(
  'makeup_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'restrict' }),
    originalSessionId: uuid('original_session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    absenceDate: date('absence_date').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    classroomId: uuid('classroom_id').references(() => classrooms.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 24 }).default('PENDING').notNull(),
    isFree: boolean('is_free').default(true).notNull(),
    extraFee: numeric('extra_fee', { precision: 12, scale: 2 }).default('0.00').notNull(),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_makeups_student').on(t.studentId),
    index('idx_makeups_original_session').on(t.originalSessionId),
    index('idx_makeups_status').on(t.status),
  ],
);

