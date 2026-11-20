import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  boolean,
  date,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { students, teachers, assistants } from './profiles.schema';
import { groups } from './groups.schema';
import { users } from './identity.schema';

export const studentMonthlyRecords = pgTable(
  'student_monthly_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'restrict' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'restrict' }),
    yearMonth: varchar('year_month', { length: 7 }).notNull(), // YYYY-MM
    totalGroupSessions: integer('total_group_sessions').default(0).notNull(),
    eligibleSessions: integer('eligible_sessions').default(0).notNull(),
    presentCount: integer('present_count').default(0).notNull(),
    absentCount: integer('absent_count').default(0).notNull(),
    excusedCount: integer('excused_count').default(0).notNull(),
    makeupAttendedCount: integer('makeup_attended_count').default(0).notNull(),
    sessionPriceSnapshot: numeric('session_price_snapshot', {
      precision: 12,
      scale: 2,
    }).notNull(),
    extraMakeupFees: numeric('extra_makeup_fees', { precision: 12, scale: 2 })
      .default('0.00')
      .notNull(),
    totalDue: numeric('total_due', { precision: 12, scale: 2 }).default('0.00').notNull(),
    totalPaid: numeric('total_paid', { precision: 12, scale: 2 }).default('0.00').notNull(),
    remainingBalance: numeric('remaining_balance', { precision: 12, scale: 2 })
      .default('0.00')
      .notNull(),
    isClosed: boolean('is_closed').default(false).notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_student_monthly_group').on(t.studentId, t.groupId, t.yearMonth),
    index('idx_student_monthly_month').on(t.yearMonth),
    index('idx_student_monthly_group').on(t.groupId, t.yearMonth),
  ],
);

export const teacherMonthlyRecords = pgTable(
  'teacher_monthly_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'restrict' }),
    yearMonth: varchar('year_month', { length: 7 }).notNull(),
    groupsCount: integer('groups_count').default(0).notNull(),
    executedSessionsCount: integer('executed_sessions_count').default(0).notNull(),
    totalDues: numeric('total_dues', { precision: 12, scale: 2 }).default('0.00').notNull(),
    totalPaidOut: numeric('total_paid_out', { precision: 12, scale: 2 })
      .default('0.00')
      .notNull(),
    remainingBalance: numeric('remaining_balance', { precision: 12, scale: 2 })
      .default('0.00')
      .notNull(),
    isClosed: boolean('is_closed').default(false).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_teacher_monthly').on(t.teacherId, t.yearMonth),
    index('idx_teacher_monthly_month').on(t.yearMonth),
  ],
);

export const assistantMonthlyRecords = pgTable(
  'assistant_monthly_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assistantId: uuid('assistant_id')
      .notNull()
      .references(() => assistants.id, { onDelete: 'restrict' }),
    yearMonth: varchar('year_month', { length: 7 }).notNull(),
    calculationMethodSnapshot: varchar('calculation_method_snapshot', { length: 48 }).notNull(),
    totalDues: numeric('total_dues', { precision: 12, scale: 2 }).default('0.00').notNull(),
    totalPaidOut: numeric('total_paid_out', { precision: 12, scale: 2 })
      .default('0.00')
      .notNull(),
    remainingBalance: numeric('remaining_balance', { precision: 12, scale: 2 })
      .default('0.00')
      .notNull(),
    detailsNote: text('details_note'),
    isClosed: boolean('is_closed').default(false).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_assistant_monthly').on(t.assistantId, t.yearMonth),
    index('idx_assistant_monthly_month').on(t.yearMonth),
  ],
);

export const teacherDues = pgTable(
  'teacher_dues',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'restrict' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'restrict' }),
    yearMonth: varchar('year_month', { length: 7 }).notNull(),
    executedSessionsCount: integer('executed_sessions_count').default(0).notNull(),
    studentsCount: integer('students_count').default(0).notNull(),
    grossGroupRevenue: numeric('gross_group_revenue', { precision: 12, scale: 2 })
      .default('0.00')
      .notNull(),
    teacherAmount: numeric('teacher_amount', { precision: 12, scale: 2 })
      .default('0.00')
      .notNull(),
    centerAmount: numeric('center_amount', { precision: 12, scale: 2 })
      .default('0.00')
      .notNull(),
    calculationBreakdown: text('calculation_breakdown'),
    isLocked: boolean('is_locked').default(false).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_teacher_dues_group_month').on(t.teacherId, t.groupId, t.yearMonth),
    index('idx_teacher_dues_month').on(t.yearMonth),
  ],
);

export const assistantDues = pgTable(
  'assistant_dues',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    assistantId: uuid('assistant_id')
      .notNull()
      .references(() => assistants.id, { onDelete: 'restrict' }),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
    yearMonth: varchar('year_month', { length: 7 }).notNull(),
    calculationMethod: varchar('calculation_method', { length: 48 }).notNull(),
    sessionsCount: integer('sessions_count').default(0).notNull(),
    studentsCount: integer('students_count').default(0).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).default('0.00').notNull(),
    calculationBreakdown: text('calculation_breakdown'),
    isLocked: boolean('is_locked').default(false).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_assistant_dues_assistant_month').on(t.assistantId, t.yearMonth),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    receiptNumber: varchar('receipt_number', { length: 50 }).notNull(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'restrict' }),
    yearMonth: varchar('year_month', { length: 7 }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    paymentDate: date('payment_date').notNull(),
    paymentMethod: varchar('payment_method', { length: 32 }).default('CASH').notNull(),
    receivedByUserId: uuid('received_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_payments_receipt').on(t.receiptNumber),
    index('idx_payments_student_month').on(t.studentId, t.yearMonth),
    index('idx_payments_year_month').on(t.yearMonth),
    index('idx_payments_date').on(t.paymentDate),
  ],
);

export const paymentAllocations = pgTable(
  'payment_allocations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'cascade' }),
    studentMonthlyRecordId: uuid('student_monthly_record_id').references(
      () => studentMonthlyRecords.id,
      { onDelete: 'set null' },
    ),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'restrict' }),
    yearMonth: varchar('year_month', { length: 7 }).notNull(),
    allocatedAmount: numeric('allocated_amount', { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_payment_alloc_payment').on(t.paymentId),
    index('idx_payment_alloc_group_month').on(t.groupId, t.yearMonth),
    index('idx_payment_allocations_year_month').on(t.yearMonth),
  ],
);

export const teacherPayouts = pgTable(
  'teacher_payouts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    referenceNumber: varchar('reference_number', { length: 50 }).notNull(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'restrict' }),
    yearMonth: varchar('year_month', { length: 7 }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    payoutDate: date('payout_date').notNull(),
    paymentMethod: varchar('payment_method', { length: 32 }).default('CASH').notNull(),
    paidByUserId: uuid('paid_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_teacher_payouts_ref').on(t.referenceNumber),
    index('idx_teacher_payouts_teacher_month').on(t.teacherId, t.yearMonth),
  ],
);

export const assistantPayouts = pgTable(
  'assistant_payouts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    referenceNumber: varchar('reference_number', { length: 50 }).notNull(),
    assistantId: uuid('assistant_id')
      .notNull()
      .references(() => assistants.id, { onDelete: 'restrict' }),
    yearMonth: varchar('year_month', { length: 7 }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    payoutDate: date('payout_date').notNull(),
    paymentMethod: varchar('payment_method', { length: 32 }).default('CASH').notNull(),
    paidByUserId: uuid('paid_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_assistant_payouts_ref').on(t.referenceNumber),
    index('idx_assistant_payouts_assistant_month').on(t.assistantId, t.yearMonth),
  ],
);

export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    category: varchar('category', { length: 48 }).notNull(),
    title: varchar('title', { length: 180 }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    expenseDate: date('expense_date').notNull(),
    yearMonth: varchar('year_month', { length: 7 }).notNull(),
    paymentMethod: varchar('payment_method', { length: 32 }).default('CASH').notNull(),
    recordedByUserId: uuid('recorded_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_expenses_month_category').on(t.yearMonth, t.category),
    index('idx_expenses_date').on(t.expenseDate),
  ],
);

