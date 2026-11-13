import {
  pgTable,
  uuid,
  varchar,
  date,
  integer,
  boolean,
  numeric,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './identity.schema';

export const students = pgTable(
  'students',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentCode: varchar('student_code', { length: 40 }).notNull(),
    fullName: varchar('full_name', { length: 160 }).notNull(),
    phone: varchar('phone', { length: 30 }),
    guardianPhone: varchar('guardian_phone', { length: 30 }),
    gradeLevel: varchar('grade_level', { length: 80 }).notNull(),
    registrationDate: date('registration_date').notNull(),
    status: varchar('status', { length: 24 }).default('ACTIVE').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_students_code').on(t.studentCode),
    index('idx_students_name').on(t.fullName),
    index('idx_students_phone').on(t.phone),
    index('idx_students_guardian_phone').on(t.guardianPhone),
    index('idx_students_status_grade').on(t.status, t.gradeLevel),
  ],
);

export const teachers = pgTable(
  'teachers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teacherCode: varchar('teacher_code', { length: 40 }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    fullName: varchar('full_name', { length: 160 }).notNull(),
    phone: varchar('phone', { length: 30 }).notNull(),
    specialization: varchar('specialization', { length: 100 }).notNull(),
    contractDate: date('contract_date').notNull(),
    employmentStatus: varchar('employment_status', { length: 24 }).default('ACTIVE').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_teachers_code').on(t.teacherCode),
    index('idx_teachers_name').on(t.fullName),
    index('idx_teachers_specialization').on(t.specialization),
    index('idx_teachers_status').on(t.employmentStatus),
    index('idx_teachers_user').on(t.userId),
  ],
);

export const assistants = pgTable(
  'assistants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assistantCode: varchar('assistant_code', { length: 40 }).notNull(),
    fullName: varchar('full_name', { length: 160 }).notNull(),
    phone: varchar('phone', { length: 30 }).notNull(),
    calculationMethod: varchar('calculation_method', { length: 48 })
      .default('SESSION_COMMISSION_PERCENT')
      .notNull(),
    rateValue: numeric('rate_value', { precision: 12, scale: 2 }).default('0.00').notNull(),
    customFormulaNote: text('custom_formula_note'),
    status: varchar('status', { length: 24 }).default('ACTIVE').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_assistants_code').on(t.assistantCode),
    index('idx_assistants_name').on(t.fullName),
    index('idx_assistants_status').on(t.status),
  ],
);

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

