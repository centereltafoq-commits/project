import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
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

  async getCatalog() {
    return this.db.select().from(backupRecords);
  }

  async mergeCatalog(records: (typeof backupRecords.$inferSelect)[]) {
    if (records.length === 0) return;

    await this.db.insert(backupRecords).values(records).onConflictDoUpdate({
      target: backupRecords.id,
      set: {
        fileName: sql`excluded.file_name`,
        filePath: sql`excluded.file_path`,
        fileSizeBytes: sql`excluded.file_size_bytes`,
        triggerType: sql`excluded.trigger_type`,
        destinations: sql`excluded.destinations`,
        checksum: sql`excluded.checksum`,
        status: sql`excluded.status`,
        errorMessage: sql`excluded.error_message`,
        createdAt: sql`excluded.created_at`,
      },
    });
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

  async hasSuccessfulScheduledBackupSince(since: Date): Promise<boolean> {
    const [record] = await this.db
      .select({ id: backupRecords.id })
      .from(backupRecords)
      .where(
        and(
          eq(backupRecords.triggerType, 'SCHEDULED'),
          eq(backupRecords.status, 'SUCCESS'),
          gte(backupRecords.createdAt, since),
        ),
      )
      .limit(1);
    return Boolean(record);
  }

  async getOperationalDatabaseStats(): Promise<{
    studentsCount: number;
    teachersCount: number;
    groupsCount: number;
    sessionsCount: number;
    attendanceCount: number;
    paymentsCount: number;
    expensesCount: number;
    auditCount: number;
    lastMutationAt: string | null;
    centerName: string;
    digestSource: string;
  }> {
    const result = await this.db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM students) AS students_count,
        (SELECT COUNT(*)::int FROM teachers) AS teachers_count,
        (SELECT COUNT(*)::int FROM assistants) AS assistants_count,
        (SELECT COUNT(*)::int FROM groups) AS groups_count,
        (SELECT COUNT(*)::int FROM enrollments) AS enrollments_count,
        (SELECT COUNT(*)::int FROM classrooms) AS classrooms_count,
        (SELECT COUNT(*)::int FROM grade_levels) AS grade_levels_count,
        (SELECT COUNT(*)::int FROM sessions) AS sessions_count,
        (SELECT COUNT(*)::int FROM attendance) AS attendance_count,
        (SELECT COUNT(*)::int FROM payments) AS payments_count,
        (SELECT COUNT(*)::int FROM expenses) AS expenses_count,
        (SELECT COUNT(*)::int FROM student_monthly_records) AS student_monthly_count,
        (SELECT COUNT(*)::int FROM teacher_payouts) AS teacher_payouts_count,
        (SELECT COUNT(*)::int FROM assistant_payouts) AS assistant_payouts_count,
        (SELECT COUNT(*)::int FROM users) AS users_count,
        (SELECT COUNT(*)::int FROM audit_logs WHERE UPPER(entity_type) NOT IN ('BACKUP', 'CLOUD_SYNC', 'AUTH')) AS audit_count,
        COALESCE((SELECT center_name FROM system_settings WHERE id = 'default' LIMIT 1), 'سنتر النخبة التعليمي') AS center_name,
        EXTRACT(EPOCH FROM (SELECT MAX(updated_at) FROM students)) AS ts_students,
        EXTRACT(EPOCH FROM (SELECT MAX(updated_at) FROM teachers)) AS ts_teachers,
        EXTRACT(EPOCH FROM (SELECT MAX(updated_at) FROM assistants)) AS ts_assistants,
        EXTRACT(EPOCH FROM (SELECT MAX(updated_at) FROM groups)) AS ts_groups,
        EXTRACT(EPOCH FROM (SELECT MAX(updated_at) FROM enrollments)) AS ts_enrollments,
        EXTRACT(EPOCH FROM (SELECT MAX(updated_at) FROM classrooms)) AS ts_classrooms,
        EXTRACT(EPOCH FROM (SELECT MAX(updated_at) FROM grade_levels)) AS ts_grade_levels,
        EXTRACT(EPOCH FROM (SELECT MAX(updated_at) FROM sessions)) AS ts_sessions,
        EXTRACT(EPOCH FROM (SELECT MAX(updated_at) FROM attendance)) AS ts_attendance,
        EXTRACT(EPOCH FROM (SELECT MAX(created_at) FROM payments)) AS ts_payments,
        EXTRACT(EPOCH FROM (SELECT MAX(created_at) FROM expenses)) AS ts_expenses,
        EXTRACT(EPOCH FROM (SELECT MAX(updated_at) FROM student_monthly_records)) AS ts_student_monthly,
        EXTRACT(EPOCH FROM (SELECT MAX(created_at) FROM teacher_payouts)) AS ts_teacher_payouts,
        EXTRACT(EPOCH FROM (SELECT MAX(created_at) FROM assistant_payouts)) AS ts_assistant_payouts,
        EXTRACT(EPOCH FROM (SELECT MAX(updated_at) FROM system_settings)) AS ts_settings,
        EXTRACT(EPOCH FROM (SELECT MAX(created_at) FROM audit_logs WHERE UPPER(entity_type) NOT IN ('BACKUP', 'CLOUD_SYNC', 'AUTH'))) AS ts_audit
    `);

    const row = (Array.isArray(result) ? result[0] : (result as any)?.rows?.[0]) || {};
    const num = (v: unknown) => Number(v ?? 0) || 0;
    const epochList = [
      row.ts_students,
      row.ts_teachers,
      row.ts_assistants,
      row.ts_groups,
      row.ts_enrollments,
      row.ts_classrooms,
      row.ts_grade_levels,
      row.ts_sessions,
      row.ts_attendance,
      row.ts_payments,
      row.ts_expenses,
      row.ts_student_monthly,
      row.ts_teacher_payouts,
      row.ts_assistant_payouts,
      row.ts_settings,
      row.ts_audit,
    ]
      .map((v) => (v == null ? null : Number(v)))
      .filter((v): v is number => v !== null && Number.isFinite(v) && v > 0);

    const maxEpoch = epochList.length > 0 ? Math.max(...epochList) : null;
    const lastMutationAt = maxEpoch ? new Date(Math.round(maxEpoch * 1000)).toISOString() : null;

    const digestParts = [
      num(row.students_count),
      num(row.teachers_count),
      num(row.assistants_count),
      num(row.groups_count),
      num(row.enrollments_count),
      num(row.classrooms_count),
      num(row.grade_levels_count),
      num(row.sessions_count),
      num(row.attendance_count),
      num(row.payments_count),
      num(row.expenses_count),
      num(row.student_monthly_count),
      num(row.teacher_payouts_count),
      num(row.assistant_payouts_count),
      num(row.users_count),
      num(row.audit_count),
      String(row.center_name ?? ''),
      ...[
        'ts_students',
        'ts_teachers',
        'ts_assistants',
        'ts_groups',
        'ts_enrollments',
        'ts_classrooms',
        'ts_grade_levels',
        'ts_sessions',
        'ts_attendance',
        'ts_payments',
        'ts_expenses',
        'ts_student_monthly',
        'ts_teacher_payouts',
        'ts_assistant_payouts',
        'ts_settings',
        'ts_audit',
      ].map((k) => (row[k] == null ? '0' : Number(row[k]).toFixed(3))),
    ];

    return {
      studentsCount: num(row.students_count),
      teachersCount: num(row.teachers_count),
      groupsCount: num(row.groups_count),
      sessionsCount: num(row.sessions_count),
      attendanceCount: num(row.attendance_count),
      paymentsCount: num(row.payments_count),
      expensesCount: num(row.expenses_count),
      auditCount: num(row.audit_count),
      lastMutationAt,
      centerName: String(row.center_name || 'سنتر النخبة التعليمي'),
      digestSource: digestParts.join('|'),
    };
  }
}
