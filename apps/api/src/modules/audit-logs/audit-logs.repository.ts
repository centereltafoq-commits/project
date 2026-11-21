import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, ilike, inArray, or, sql, SQL } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import { auditLogs, users } from '../../database/schemas';
import { normalizePagination } from '../../common/utils/pagination.util';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { getSearchTermEquivalents } from './audit-translations.util';

export interface CreateAuditLogInput {
  actorUserId?: string | null;
  actorName?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: unknown;
  ipAddress?: string | null;
}

const ENTITY_TYPE_ALIASES: Record<string, string[]> = {
  ATTENDANCE: ['SESSION', 'ATTENDANCE', 'attendance', 'session', 'group_session'],
  SESSION: ['SESSION', 'ATTENDANCE', 'attendance', 'session', 'group_session'],
  PAYMENT: ['payment', 'PAYMENT', 'payments', 'PAYMENTS', 'student_payment', 'student_payments'],
  PAYOUT: ['payout', 'PAYOUT', 'payouts', 'PAYOUTS', 'teacher_payout', 'assistant_payout', 'staff_payout', 'staff_payouts'],
  STAFF_PAYOUT: ['payout', 'PAYOUT', 'payouts', 'PAYOUTS', 'teacher_payout', 'assistant_payout', 'staff_payout', 'staff_payouts'],
  EXPENSE: ['expense', 'EXPENSE', 'expenses'],
  CLASSROOM: ['classroom', 'CLASSROOM', 'classrooms', 'CLASSROOMS'],
  CLASSROOM_MAINTENANCE: ['classroom_maintenance', 'CLASSROOM_MAINTENANCE'],
  GRADE_LEVEL: ['grade_level', 'GRADE_LEVEL', 'grade_levels', 'GRADE_LEVELS'],
  BACKUP: ['backup', 'BACKUP', 'backups', 'BACKUPS'],
  CLOUD_SYNC: ['cloud_sync', 'CLOUD_SYNC'],
  SETTINGS: ['settings', 'SETTINGS', 'system', 'SYSTEM'],
  SYSTEM: ['settings', 'SETTINGS', 'system', 'SYSTEM'],
  STUDENT: ['student', 'STUDENT', 'students', 'STUDENTS'],
  TEACHER: ['teacher', 'TEACHER', 'teachers', 'TEACHERS'],
  ASSISTANT: ['assistant', 'ASSISTANT', 'assistants', 'ASSISTANTS'],
  GROUP: ['group', 'GROUP', 'groups', 'GROUPS'],
  ENROLLMENT: ['enrollment', 'ENROLLMENT', 'enrollments', 'ENROLLMENTS'],
  USER: ['user', 'USER', 'users', 'USERS'],
  ROLE: ['role', 'ROLE', 'roles', 'ROLES'],
  AUTH: ['auth', 'AUTH'],
  MONTHLY_SETTLEMENT: ['monthly_settlement', 'monthly_settlements', 'MONTHLY_SETTLEMENT'],
};

@Injectable()
export class AuditLogsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async insert(input: CreateAuditLogInput): Promise<void> {
    try {
      await this.db.insert(auditLogs).values({
        actorUserId: input.actorUserId ?? null,
        actorName: input.actorName ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        beforeData: input.beforeData ?? null,
        afterData: input.afterData ?? null,
        metadata: input.metadata ?? null,
        ipAddress: input.ipAddress ?? null,
      });
    } catch (err: any) {
      // If actorUserId references a user UUID that changed during a cross-device DB restore, preserve actorName safely
      const pgCode = err?.code || err?.cause?.code;
      if (pgCode === '23503' && input.actorUserId) {
        await this.db.insert(auditLogs).values({
          actorUserId: null,
          actorName: input.actorName ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          beforeData: input.beforeData ?? null,
          afterData: input.afterData ?? null,
          metadata: input.metadata ?? null,
          ipAddress: input.ipAddress ?? null,
        });
        return;
      }
      throw err;
    }
  }

  async findPaginated(query: AuditLogQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const conditions: SQL[] = [];

    if (query.entityType) {
      const normalizedKey = query.entityType.toUpperCase();
      const aliases = ENTITY_TYPE_ALIASES[normalizedKey];
      if (aliases && aliases.length > 0) {
        conditions.push(inArray(auditLogs.entityType, aliases));
      } else {
        const entityOrs: SQL[] = [
          eq(auditLogs.entityType, query.entityType),
          ilike(auditLogs.entityType, `%${query.entityType}%`),
          sql`${auditLogs.metadata}->>'entityTypeAr' ILIKE ${`%${query.entityType}%`}`,
        ];
        const entitySynonyms = getSearchTermEquivalents(query.entityType);
        for (const syn of entitySynonyms) {
          const synAliases = ENTITY_TYPE_ALIASES[syn.toUpperCase()];
          if (synAliases && synAliases.length > 0) {
            entityOrs.push(inArray(auditLogs.entityType, synAliases));
          } else {
            entityOrs.push(ilike(auditLogs.entityType, `%${syn}%`));
          }
        }
        conditions.push(or(...entityOrs)!);
      }
    }
    if (query.action) {
      const actionOrs: SQL[] = [
        eq(auditLogs.action, query.action),
        ilike(auditLogs.action, `%${query.action}%`),
        sql`${auditLogs.metadata}->>'actionAr' ILIKE ${`%${query.action}%`}`,
      ];
      const actionSynonyms = getSearchTermEquivalents(query.action);
      for (const syn of actionSynonyms) {
        actionOrs.push(ilike(auditLogs.action, `%${syn}%`));
      }
      conditions.push(or(...actionOrs)!);
    }
    if (query.search && query.search.trim()) {
      const pattern = `%${query.search.trim()}%`;
      const searchOrs: SQL[] = [
        sql`COALESCE(NULLIF(TRIM(${auditLogs.actorName}), ''), ${users.fullName}, 'النظام') ILIKE ${pattern}`,
        ilike(auditLogs.actorName, pattern),
        ilike(users.fullName, pattern),
        ilike(auditLogs.action, pattern),
        ilike(auditLogs.entityType, pattern),
        ilike(auditLogs.entityId, pattern),
        sql`${auditLogs.metadata}->>'actionAr' ILIKE ${pattern}`,
        sql`${auditLogs.metadata}->>'entityTypeAr' ILIKE ${pattern}`,
        sql`CAST(${auditLogs.beforeData} AS text) ILIKE ${pattern}`,
        sql`CAST(${auditLogs.afterData} AS text) ILIKE ${pattern}`,
        sql`CAST(${auditLogs.metadata} AS text) ILIKE ${pattern}`,
      ];

      const synonyms = getSearchTermEquivalents(query.search.trim());
      for (const syn of synonyms) {
        searchOrs.push(ilike(auditLogs.action, `%${syn}%`));
        searchOrs.push(ilike(auditLogs.entityType, `%${syn}%`));
      }

      conditions.push(or(...searchOrs)!);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: auditLogs.id,
          actorUserId: auditLogs.actorUserId,
          actorName: sql<string>`COALESCE(NULLIF(TRIM(${auditLogs.actorName}), ''), ${users.fullName}, 'النظام')`.as('actorName'),
          action: auditLogs.action,
          entityType: auditLogs.entityType,
          entityId: auditLogs.entityId,
          beforeData: auditLogs.beforeData,
          afterData: auditLogs.afterData,
          metadata: auditLogs.metadata,
          ipAddress: auditLogs.ipAddress,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.actorUserId, users.id))
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.actorUserId, users.id))
        .where(whereClause),
    ]);

    return { rows, total: Number(total), page, limit };
  }

  async findRollbackMapForAuditIds(
    ids: string[],
  ): Promise<
    Map<string, { rollbackAuditLogId: string; revertedAt: Date; revertedByName: string }>
  > {
    const result = new Map<
      string,
      { rollbackAuditLogId: string; revertedAt: Date; revertedByName: string }
    >();
    if (!ids || ids.length === 0) {
      return result;
    }

    const rollbackRows = await this.db
      .select({
        rollbackAuditLogId: auditLogs.id,
        revertedAt: auditLogs.createdAt,
        revertedByName: sql<string>`COALESCE(NULLIF(TRIM(${auditLogs.actorName}), ''), ${users.fullName}, 'النظام')`,
        revertedAuditLogId: sql<string>`${auditLogs.metadata}->>'revertedAuditLogId'`,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(
        and(
          eq(auditLogs.action, 'AUDIT_ROLLBACK'),
          sql`${auditLogs.metadata}->>'revertedAuditLogId' IN (${sql.join(
            ids.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        ),
      )
      .orderBy(desc(auditLogs.createdAt));

    for (const row of rollbackRows) {
      if (row.revertedAuditLogId && !result.has(row.revertedAuditLogId)) {
        result.set(row.revertedAuditLogId, {
          rollbackAuditLogId: row.rollbackAuditLogId,
          revertedAt: row.revertedAt,
          revertedByName: row.revertedByName,
        });
      }
    }

    return result;
  }
}


