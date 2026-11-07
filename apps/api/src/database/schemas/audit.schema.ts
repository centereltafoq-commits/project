import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './identity.schema';

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorName: varchar('actor_name', { length: 150 }),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 80 }).notNull(),
    entityId: varchar('entity_id', { length: 100 }),
    beforeData: jsonb('before_data'),
    afterData: jsonb('after_data'),
    metadata: jsonb('metadata'),
    ipAddress: varchar('ip_address', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_audit_logs_created_at').on(t.createdAt),
    index('idx_audit_logs_entity').on(t.entityType, t.entityId),
    index('idx_audit_logs_actor').on(t.actorUserId),
  ],
);

