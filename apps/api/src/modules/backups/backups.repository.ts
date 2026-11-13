import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { PaginatedResult } from '@edu-center/shared';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import { backupRecords, backupSettings } from '../../database/schemas';
import { BackupQueryDto } from './dto/backup.dto';

@Injectable()
export class BackupsRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: DrizzleDatabase,
  ) {}

  async getSettings() {
    const rows = await this.db.select().from(backupSettings).limit(1);
    if (rows.length > 0) {
      return rows[0];
    }

    const [created] = await this.db
      .insert(backupSettings)
      .values({
        autoBackupEnabled: true,
        scheduleTime: '02:00',
        retentionCount: 30,
        googleDriveEnabled: false,
        dropboxEnabled: false,
      })
      .returning();
    return created;
  }

  async updateSettings(data: Partial<typeof backupSettings.$inferInsert>) {
    const current = await this.getSettings();
    const [updated] = await this.db
      .update(backupSettings)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(backupSettings.id, current.id))
      .returning();
    return updated;
  }

  async listRecords(query: BackupQueryDto): Promise<PaginatedResult<typeof backupRecords.$inferSelect>> {
    const page = query.page || 1;
    const limit = query.limit || 25;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (query.status) {
      conditions.push(eq(backupRecords.status, query.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(backupRecords)
      .where(whereClause);

    const total = countResult?.count || 0;
    const data = await this.db
      .select()
      .from(backupRecords)
      .where(whereClause)
      .orderBy(desc(backupRecords.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      data,
      meta: {
        page,
        limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit) || 1,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async findRecordById(id: string) {
    const rows = await this.db
      .select()
      .from(backupRecords)
      .where(eq(backupRecords.id, id))
      .limit(1);
    return rows[0] || null;
  }

  async createRecord(data: typeof backupRecords.$inferInsert) {
    const [record] = await this.db.insert(backupRecords).values(data).returning();
    return record;
  }

  async updateRecord(id: string, data: Partial<typeof backupRecords.$inferInsert>) {
    const [record] = await this.db
      .update(backupRecords)
      .set(data)
      .where(eq(backupRecords.id, id))
      .returning();
    return record;
  }

  async findRecordsExceedingRetention(retentionLimit: number) {
    const all = await this.db
      .select()
      .from(backupRecords)
      .where(eq(backupRecords.status, 'SUCCESS'))
      .orderBy(desc(backupRecords.createdAt));

    if (all.length > retentionLimit) {
      return all.slice(retentionLimit);
    }
    return [];
  }

  async deleteRecord(id: string) {
    const [deleted] = await this.db
      .delete(backupRecords)
      .where(eq(backupRecords.id, id))
      .returning();
    return deleted;
  }

  async findInProgressRecords() {
    return this.db
      .select()
      .from(backupRecords)
      .where(eq(backupRecords.status, 'IN_PROGRESS'));
  }

  async fixRestoredInProgressRecords() {
    await this.db
      .update(backupRecords)
      .set({ status: 'FAILED', errorMessage: 'النسخة غير مكتملة أثناء الاستعادة' })
      .where(eq(backupRecords.status, 'IN_PROGRESS'));
  }
}
