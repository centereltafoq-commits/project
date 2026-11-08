import { pgTable, varchar, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './identity.schema';

export const systemSettings = pgTable('system_settings', {
  id: varchar('id', { length: 32 }).primaryKey().default('default'),
  centerName: varchar('center_name', { length: 200 }).notNull().default('سنتر النخبة التعليمي'),
  centerSubtitle: varchar('center_subtitle', { length: 255 }).default('نظام الإدارة المتكامل'),
  logoUrl: text('logo_url'),
  phone: varchar('phone', { length: 50 }),
  address: varchar('address', { length: 255 }),
  academicYear: varchar('academic_year', { length: 50 }).default('2026 / 2027'),
  currencySymbol: varchar('currency_symbol', { length: 20 }).default('ج.م'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
});
