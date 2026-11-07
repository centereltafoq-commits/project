import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  bigint,
  jsonb,
  text,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

export const backupSettings = pgTable('backup_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  autoBackupEnabled: boolean('auto_backup_enabled').default(true).notNull(),
  scheduleTime: varchar('schedule_time', { length: 8 }).default('02:00').notNull(),
  retentionCount: integer('retention_count').default(30).notNull(),
  localPath: varchar('local_path', { length: 500 }),
  googleDriveEnabled: boolean('google_drive_enabled').default(false).notNull(),
  googleDriveTokens: jsonb('google_drive_tokens').$type<{
    accessToken?: string;
    refreshToken?: string;
    userEmail?: string;
    folderId?: string;
    connectedAt?: string;
  }>(),
  dropboxEnabled: boolean('dropbox_enabled').default(false).notNull(),
  dropboxTokens: jsonb('dropbox_tokens').$type<{
    accessToken?: string;
    userEmail?: string;
    connectedAt?: string;
  }>(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const backupRecords = pgTable(
  'backup_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    filePath: varchar('file_path', { length: 500 }).notNull(),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }).notNull(),
    triggerType: varchar('trigger_type', { length: 32 }).notNull(),
    destinations: jsonb('destinations').$type<string[]>().default([]).notNull(),
    checksum: varchar('checksum', { length: 64 }),
    status: varchar('status', { length: 24 }).notNull(),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_backup_records_created').on(t.createdAt),
    index('idx_backup_records_status').on(t.status),
  ],
);

