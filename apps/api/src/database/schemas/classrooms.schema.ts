import {
  pgTable,
  uuid,
  varchar,
  integer,
  jsonb,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const classrooms = pgTable(
  'classrooms',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roomNumber: varchar('room_number', { length: 32 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    maxCapacity: integer('max_capacity').notNull(),
    seatsCount: integer('seats_count').notNull(),
    equipment: jsonb('equipment').$type<string[]>().default([]).notNull(),
    status: varchar('status', { length: 24 }).default('AVAILABLE').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_classrooms_room_number').on(t.roomNumber),
    index('idx_classrooms_status').on(t.status),
  ],
);

export const classroomMaintenances = pgTable(
  'classroom_maintenances',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    classroomId: uuid('classroom_id')
      .notNull()
      .references(() => classrooms.id, { onDelete: 'cascade' }),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    reason: varchar('reason', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_classroom_maint_range').on(t.classroomId, t.startAt, t.endAt)],
);

