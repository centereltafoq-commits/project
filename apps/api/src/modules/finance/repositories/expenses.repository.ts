import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  ilike,
  or,
  sql,
  SQL,
} from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../../database/database.module';
import { expenses, users } from '../../../database/schemas';
import { normalizePagination } from '../../../common/utils/pagination.util';
import { ExpensesQueryDto } from '../dto/expenses.dto';
import { parseMoney, roundMoney } from '../utils/money.util';

export type NewExpenseRow = typeof expenses.$inferInsert;

@Injectable()
export class ExpensesRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async findById(id: string) {
    const [row] = await this.db
      .select()
      .from(expenses)
      .where(eq(expenses.id, id))
      .limit(1);
    return row ?? null;
  }

  async findPaginatedWithSummary(query: ExpensesQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const conditions: SQL[] = [];

    if (query.yearMonth) {
      conditions.push(eq(expenses.yearMonth, query.yearMonth));
    }
    if (query.category) {
      conditions.push(eq(expenses.category, query.category));
    }
    if (query.search) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(
        or(ilike(expenses.title, pattern), ilike(expenses.notes, pattern))!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const monthClause = query.yearMonth
      ? eq(expenses.yearMonth, query.yearMonth)
      : undefined;

    const [rows, [{ total, filteredSum }], categorySums] = await Promise.all([
      this.db
        .select({
          id: expenses.id,
          category: expenses.category,
          title: expenses.title,
          amount: expenses.amount,
          expenseDate: expenses.expenseDate,
          yearMonth: expenses.yearMonth,
          paymentMethod: expenses.paymentMethod,
          recordedByUserId: expenses.recordedByUserId,
          recordedByName: users.fullName,
          notes: expenses.notes,
          createdAt: expenses.createdAt,
        })
        .from(expenses)
        .leftJoin(users, eq(users.id, expenses.recordedByUserId))
        .where(whereClause)
        .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({
          total: count(),
          filteredSum: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
        })
        .from(expenses)
        .where(whereClause),
      this.db
        .select({
          category: expenses.category,
          sum: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
        })
        .from(expenses)
        .where(monthClause)
        .groupBy(expenses.category),
    ]);

    const byCategory: Record<string, number> = {};
    let monthTotal = 0;
    for (const c of categorySums) {
      const val = parseMoney(c.sum);
      byCategory[c.category] = val;
      monthTotal = roundMoney(monthTotal + val);
    }

    return {
      rows: rows.map((r) => ({ ...r, amount: parseMoney(r.amount) })),
      total: Number(total),
      page,
      limit,
      summary: {
        monthTotal,
        filteredTotal: parseMoney(filteredSum),
        byCategory,
      },
    };
  }

  async create(values: NewExpenseRow) {
    const [created] = await this.db.insert(expenses).values(values).returning();
    return { ...created!, amount: parseMoney(created!.amount) };
  }

  async update(id: string, patch: Partial<NewExpenseRow>) {
    const [updated] = await this.db
      .update(expenses)
      .set(patch)
      .where(eq(expenses.id, id))
      .returning();
    return updated ? { ...updated, amount: parseMoney(updated.amount) } : null;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(expenses).where(eq(expenses.id, id));
  }
}
