import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  boolean,
  date,
  jsonb,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { students, teachers, assistants } from './profiles.schema';
import { classrooms } from './classrooms.schema';

export interface GroupScheduleSlot {
  dayOfWeek: number; // 0=Sunday ... 6=Saturday
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  classroomId?: string | null;
}

export const groups = pgTable(
  'groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupCode: varchar('group_code', { length: 40 }).notNull(),
    name: varchar('name', { length: 160 }).notNull(),
    subject: varchar('subject', { length: 100 }).notNull(),
    gradeLevel: varchar('grade_level', { length: 80 }).notNull(),
    primaryTeacherId: uuid('primary_teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'restrict' }),
    defaultClassroomId: uuid('default_classroom_id').references(() => classrooms.id, {
      onDelete: 'set null',
    }),
    monthlySessionsCount: integer('monthly_sessions_count').notNull(),
    monthlyPrice: numeric('monthly_price', { precision: 12, scale: 2 }).notNull(),
    calculatedSessionPrice: numeric('calculated_session_price', {
      precision: 12,
      scale: 2,
    }).notNull(),
    scheduleSlots: jsonb('schedule_slots').$type<GroupScheduleSlot[]>().default([]).notNull(),
    maxStudents: integer('max_students').default(50).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_groups_code').on(t.groupCode),
    index('idx_groups_teacher').on(t.primaryTeacherId),
    index('idx_groups_active_grade').on(t.isActive, t.gradeLevel),
  ],
);

export const financialPolicies = pgTable(
  'financial_policies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    revenueSplitMethod: varchar('revenue_split_method', { length: 48 })
      .default('ACTUAL_ATTENDANCE_RATIO')
      .notNull(),
    teacherSharePerStudent: numeric('teacher_share_per_student', {
      precision: 12,
      scale: 2,
    }).notNull(),
    centerSharePerStudent: numeric('center_share_per_student', {
      precision: 12,
      scale: 2,
    }).notNull(),
    teacherPercentage: numeric('teacher_percentage', { precision: 5, scale: 2 })
      .default('0.00')
      .notNull(),
    fullMonthAbsencePolicy: varchar('full_month_absence_policy', { length: 48 })
      .default('EXEMPT_FULL_ABSENCE')
      .notNull(),
    fullAbsenceFixedFee: numeric('full_absence_fixed_fee', { precision: 12, scale: 2 })
      .default('0.00')
      .notNull(),
    chargeExcusedAbsence: boolean('charge_excused_absence').default(false).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('uq_financial_policies_group').on(t.groupId)],
);

export const groupTeachers = pgTable(
  'group_teachers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'cascade' }),
    isPrimary: boolean('is_primary').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_group_teacher').on(t.groupId, t.teacherId),
    index('idx_group_teachers_teacher').on(t.teacherId),
  ],
);

export const groupAssistants = pgTable(
  'group_assistants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    assistantId: uuid('assistant_id')
      .notNull()
      .references(() => assistants.id, { onDelete: 'cascade' }),
    overrideCalculationMethod: varchar('override_calculation_method', { length: 48 }),
    overrideRateValue: numeric('override_rate_value', { precision: 12, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_group_assistant').on(t.groupId, t.assistantId),
    index('idx_group_assistants_assistant').on(t.assistantId),
  ],
);

export const enrollments = pgTable(
  'enrollments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'restrict' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'restrict' }),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    agreedMonthlyPrice: numeric('agreed_monthly_price', { precision: 12, scale: 2 }).notNull(),
    agreedSessionsCount: integer('agreed_sessions_count').notNull(),
    agreedSessionPrice: numeric('agreed_session_price', { precision: 12, scale: 2 }).notNull(),
    status: varchar('status', { length: 24 }).default('ACTIVE').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_enrollments_student_status').on(t.studentId, t.status),
    index('idx_enrollments_group_status').on(t.groupId, t.status),
    index('idx_enrollments_dates').on(t.startDate, t.endDate),
    uniqueIndex('uq_enrollments_group_student_active')
      .on(t.groupId, t.studentId)
      .where(sql`${t.status} = 'ACTIVE'`),
  ],
);

