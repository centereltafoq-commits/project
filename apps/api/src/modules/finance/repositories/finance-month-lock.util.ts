import { ExtractTablesWithRelations } from 'drizzle-orm';
import { NodePgTransaction } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import * as schema from '../../../database/schemas';
import {
  assistantMonthlyRecords,
  studentMonthlyRecords,
  teacherMonthlyRecords,
} from '../../../database/schemas';

export type FinanceTransaction = NodePgTransaction<
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export async function runQueriesSequentially<
  T extends readonly (() => Promise<unknown>)[],
>(
  queries: T,
): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const results: unknown[] = [];
  for (const query of queries) results.push(await query());
  return results as { [K in keyof T]: Awaited<ReturnType<T[K]>> };
}

export async function runQueriesInParallel<T extends readonly (() => Promise<unknown>)[]>(
  queries: T,
): Promise<{ [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  return Promise.all(queries.map((query) => query())) as Promise<{
    [K in keyof T]: Awaited<ReturnType<T[K]>>;
  }>;
}

/** Serialize financial mutations for one month, including when no monthly rows exist yet. */
export async function lockFinanceMonths(
  tx: FinanceTransaction,
  yearMonths: readonly string[],
): Promise<void> {
  for (const yearMonth of [...new Set(yearMonths)].sort()) {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`edu-center:finance:${yearMonth}`}, 0))`,
    );
  }
}

export async function isFinanceMonthClosed(
  tx: FinanceTransaction,
  yearMonth: string,
): Promise<boolean> {
  const [students, teachers, assistants] = await runQueriesSequentially([
    () => tx
      .select({ isClosed: studentMonthlyRecords.isClosed })
      .from(studentMonthlyRecords)
      .where(eq(studentMonthlyRecords.yearMonth, yearMonth)),
    () => tx
      .select({ isClosed: teacherMonthlyRecords.isClosed })
      .from(teacherMonthlyRecords)
      .where(eq(teacherMonthlyRecords.yearMonth, yearMonth)),
    () => tx
      .select({ isClosed: assistantMonthlyRecords.isClosed })
      .from(assistantMonthlyRecords)
      .where(eq(assistantMonthlyRecords.yearMonth, yearMonth)),
  ]);
  const records = [...students, ...teachers, ...assistants];
  return records.length > 0 && records.every((record) => record.isClosed);
}
