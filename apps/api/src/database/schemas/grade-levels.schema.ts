import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const gradeLevels = pgTable(
  'grade_levels',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    code: varchar('code', { length: 64 }),
    orderIndex: integer('order_index').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('uq_grade_levels_name').on(t.name),
    index('idx_grade_levels_order').on(t.orderIndex),
    index('idx_grade_levels_active').on(t.isActive),
  ],
);
