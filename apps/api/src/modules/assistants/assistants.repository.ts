import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, ilike, or, sql, SQL } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import { assistants, groupAssistants } from '../../database/schemas';
import { normalizePagination } from '../../common/utils/pagination.util';
import { AssistantQueryDto } from './dto/assistant.dto';

@Injectable()
export class AssistantsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async findPaginated(query: AssistantQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const conditions: SQL[] = [];

    if (query.status) {
      conditions.push(eq(assistants.status, query.status));
    }
    if (query.calculationMethod) {
      conditions.push(eq(assistants.calculationMethod, query.calculationMethod));
    }
    if (query.search) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(assistants.fullName, pattern),
          ilike(assistants.assistantCode, pattern),
          ilike(assistants.phone, pattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const linkedGroupsSq = sql<number>`(
      SELECT COUNT(*)::int
      FROM ${groupAssistants} ga
      WHERE ga.assistant_id = "assistants"."id"
    )`.as('linked_groups_count');

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: assistants.id,
          assistantCode: assistants.assistantCode,
          fullName: assistants.fullName,
          phone: assistants.phone,
          calculationMethod: assistants.calculationMethod,
          rateValue: assistants.rateValue,
          customFormulaNote: assistants.customFormulaNote,
          status: assistants.status,
          linkedGroupsCount: linkedGroupsSq,
          createdAt: assistants.createdAt,
          updatedAt: assistants.updatedAt,
        })
        .from(assistants)
        .where(whereClause)
        .orderBy(desc(assistants.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(assistants).where(whereClause),
    ]);

    return { rows, total: Number(total), page, limit };
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(assistants).where(eq(assistants.id, id)).limit(1);
    return row ?? null;
  }

  async findByCode(assistantCode: string) {
    const [row] = await this.db
      .select({ id: assistants.id })
      .from(assistants)
      .where(eq(assistants.assistantCode, assistantCode))
      .limit(1);
    return row ?? null;
  }

  async create(data: {
    assistantCode: string;
    fullName: string;
    phone: string;
    calculationMethod: string;
    rateValue: string;
    customFormulaNote?: string | null;
    status: string;
  }) {
    const [created] = await this.db
      .insert(assistants)
      .values({
        assistantCode: data.assistantCode,
        fullName: data.fullName,
        phone: data.phone,
        calculationMethod: data.calculationMethod,
        rateValue: data.rateValue,
        customFormulaNote: data.customFormulaNote ?? null,
        status: data.status,
      })
      .returning();
    return created;
  }

  async update(
    id: string,
    updates: Partial<{
      fullName: string;
      phone: string;
      calculationMethod: string;
      rateValue: string;
      customFormulaNote: string | null;
      status: string;
    }>,
  ) {
    const [updated] = await this.db
      .update(assistants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(assistants.id, id))
      .returning();
    return updated ?? null;
  }
}
