import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { performance } from 'node:perf_hooks';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureDatabaseReady } from './db-auto-bootstrap';
import * as schema from './schemas';
import { FinanceOverviewRepository } from '../modules/finance/repositories/finance-overview.repository';
import { MonthlySettlementReadRepository } from '../modules/finance/repositories/monthly-settlement-read.repository';
import { MonthlySettlementWriteRepository } from '../modules/finance/repositories/monthly-settlement-write.repository';
import { MonthlySettlementService } from '../modules/finance/monthly-settlement.service';

const perfDatabaseUrl = process.env.FINANCE_PERF_TEST_DATABASE_URL;
const perfSuite = perfDatabaseUrl ? describe : describe.skip;

type QueryPlanSummary = {
  executionMs: number;
  rootNode: string;
  indexNodes: string[];
  sharedReadBlocks: number;
  sharedHitBlocks: number;
};

perfSuite('Finance report query plans - PostgreSQL synthetic benchmark', () => {
  let pool: Pool;
  let settlementService: MonthlySettlementService;
  const prefix = `PERF-${process.pid}-${Date.now()}`;
  const teacherId = randomUUID();
  const groupId = randomUUID();
  const benchmarkMonth = '2025-12';

  beforeAll(async () => {
    const databaseName = new URL(perfDatabaseUrl!).pathname.slice(1);
    if (!databaseName.startsWith('edu_center_perf_test_')) {
      throw new Error(
        'FINANCE_PERF_TEST_DATABASE_URL must point to an isolated edu_center_perf_test_* database',
      );
    }
    pool = new Pool({ connectionString: perfDatabaseUrl, max: 4 });
    const tables = await pool.query(
      "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
    );
    if (tables.rows[0]?.count !== 0) {
      throw new Error('Finance query benchmark requires a fresh isolated test database');
    }
    await ensureDatabaseReady(perfDatabaseUrl!);
    await pool.query(`DROP INDEX idx_payments_year_month,
      idx_payment_allocations_year_month,
      idx_sessions_year_month`);
    const db = drizzle(pool, { schema });
    settlementService = new MonthlySettlementService(
      new FinanceOverviewRepository(db as any),
      new MonthlySettlementReadRepository(db as any),
      {} as any,
      {} as any,
      new MonthlySettlementWriteRepository(db as any),
      { record: async () => undefined } as any,
      { invalidatePrefix: async () => undefined } as any,
    );

    await pool.query(
      `INSERT INTO teachers (id, teacher_code, full_name, phone, specialization, contract_date)
       VALUES ($1, $2, 'Performance Benchmark Teacher', '0000000000', 'Test', DATE '2020-01-01')`,
      [teacherId, `${prefix}-T`],
    );
    await pool.query(
      `INSERT INTO groups (id, group_code, name, subject, grade_level, primary_teacher_id,
                           monthly_sessions_count, monthly_price, calculated_session_price, max_students)
       VALUES ($1, $2, 'Performance Benchmark Group', 'Test', 'Test', $3, 4, 100, 25, 10000)`,
      [groupId, `${prefix}-G`, teacherId],
    );
    await pool.query(
      `INSERT INTO students (student_code, full_name, grade_level, registration_date)
       SELECT $1 || lpad(n::text, 5, '0'), 'Benchmark Student ' || n, 'Test', DATE '2023-01-01'
       FROM generate_series(1, 5000) AS n`,
      [`${prefix}-S`],
    );
    await pool.query(`
      WITH months AS (
        SELECT generate_series(DATE '2023-01-01', DATE '2025-12-01', INTERVAL '1 month')::date AS month_start
      )
      INSERT INTO student_monthly_records (
        student_id, group_id, year_month, total_group_sessions, eligible_sessions,
        present_count, absent_count, excused_count, makeup_attended_count,
        session_price_snapshot, extra_makeup_fees, total_due, total_paid, remaining_balance
      )
      SELECT s.id, $1, to_char(m.month_start, 'YYYY-MM'), 1, 1, 1, 0, 0, 0,
             1, 0, 1, 1, 0
      FROM months m CROSS JOIN students s
      WHERE s.student_code LIKE $2 || '%'
      ORDER BY m.month_start, s.student_code`,
      [groupId, prefix],
    );
    await pool.query(`
      WITH months AS (
        SELECT generate_series(DATE '2023-01-01', DATE '2025-12-01', INTERVAL '1 month')::date AS month_start
      )
      INSERT INTO payments (receipt_number, student_id, year_month, amount, payment_date, payment_method)
      SELECT $1 || '-' || to_char(m.month_start, 'YYMM') || '-' || right(s.student_code, 5),
             s.id, to_char(m.month_start, 'YYYY-MM'), 1, m.month_start + 14, 'CASH'
      FROM months m CROSS JOIN students s
      WHERE s.student_code LIKE $2 || '%'
      ORDER BY m.month_start, s.student_code`,
      [prefix, prefix],
    );
    await pool.query(`
      INSERT INTO payment_allocations (payment_id, student_monthly_record_id, group_id, year_month, allocated_amount)
      SELECT p.id, smr.id, p.group_id, p.year_month, p.amount
      FROM (
        SELECT p.id, p.student_id, p.year_month, p.amount, $1::uuid AS group_id
        FROM payments p
        WHERE p.receipt_number LIKE $2 || '-%'
      ) p
      INNER JOIN student_monthly_records smr
        ON smr.student_id = p.student_id AND smr.group_id = p.group_id AND smr.year_month = p.year_month
      ORDER BY p.year_month, p.student_id`,
      [groupId, prefix],
    );
    await pool.query(`
      WITH months AS (
        SELECT generate_series(DATE '2023-01-01', DATE '2025-12-01', INTERVAL '1 month')::date AS month_start
      )
      INSERT INTO sessions (group_id, teacher_id, session_date, year_month, start_time, end_time, status)
      SELECT $1, $2, m.month_start + ((n - 1) % 28), to_char(m.month_start, 'YYYY-MM'),
             '09:00', '10:00', 'COMPLETED'
      FROM months m CROSS JOIN generate_series(1, 1000) AS n
      ORDER BY m.month_start, n`,
      [groupId, teacherId],
    );
    await pool.query('ANALYZE payments; ANALYZE payment_allocations; ANALYZE sessions');
  }, 120_000);

  afterAll(async () => {
    if (pool) {
      await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE');
      await pool.end();
    }
  });

  async function explain(sqlText: string): Promise<QueryPlanSummary> {
    const result = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sqlText}`, [benchmarkMonth]);
    const document = result.rows[0]?.['QUERY PLAN']?.[0];
    const root = document?.Plan;
    const indexNodes: string[] = [];
    const visit = (node: any) => {
      if (String(node['Node Type']).includes('Index')) {
        indexNodes.push(`${node['Node Type']}:${node['Index Name']}`);
      }
      for (const child of node.Plans ?? []) visit(child);
    };
    visit(root);
    return {
      executionMs: Number(document['Execution Time']),
      rootNode: root['Node Type'],
      indexNodes,
      sharedReadBlocks: Number(root['Shared Read Blocks'] ?? 0),
      sharedHitBlocks: Number(root['Shared Hit Blocks'] ?? 0),
    };
  }

  async function timeFullMonthSettlement(): Promise<number> {
    const start = performance.now();
    await settlementService.recalculateMonth(benchmarkMonth);
    return Number((performance.now() - start).toFixed(2));
  }

  it('compares month filters before and after candidate indexes on three years of synthetic data', async () => {
    const counts = await pool.query(
      `SELECT
         (SELECT count(*)::int FROM student_monthly_records WHERE year_month=$1) AS monthly_records,
         (SELECT count(*)::int FROM payments WHERE year_month=$1) AS payments,
         (SELECT count(*)::int FROM payment_allocations WHERE year_month=$1) AS allocations,
         (SELECT count(*)::int FROM sessions WHERE year_month=$1) AS sessions`,
      [benchmarkMonth],
    );
    expect(counts.rows[0]).toEqual({ monthly_records: 5000, payments: 5000, allocations: 5000, sessions: 1000 });

    const queries = {
      payments: 'SELECT COALESCE(SUM(amount), 0) FROM payments WHERE year_month = $1',
      allocations: `SELECT p.student_id, pa.group_id, SUM(pa.allocated_amount)
                    FROM payment_allocations pa INNER JOIN payments p ON p.id = pa.payment_id
                    WHERE pa.year_month = $1 GROUP BY p.student_id, pa.group_id`,
      sessions: 'SELECT * FROM sessions WHERE year_month = $1',
    };
    const before = {
      payments: await explain(queries.payments),
      allocations: await explain(queries.allocations),
      sessions: await explain(queries.sessions),
      fullSettlementMs: await timeFullMonthSettlement(),
    };

    await pool.query('CREATE INDEX idx_payments_year_month ON payments (year_month)');
    await pool.query('CREATE INDEX idx_payment_allocations_year_month ON payment_allocations (year_month)');
    await pool.query('CREATE INDEX idx_sessions_year_month ON sessions (year_month)');
    await pool.query('ANALYZE payments; ANALYZE payment_allocations; ANALYZE sessions');
    await pool.query(
      `UPDATE student_monthly_records SET total_due=1, total_paid=1, remaining_balance=0
       WHERE year_month=$1`,
      [benchmarkMonth],
    );

    const after = {
      payments: await explain(queries.payments),
      allocations: await explain(queries.allocations),
      sessions: await explain(queries.sessions),
      fullSettlementMs: await timeFullMonthSettlement(),
    };
    console.info('[Finance query benchmark]', JSON.stringify({ before, after }));
    expect(after.payments.executionMs).toBeGreaterThan(0);
    expect(after.allocations.executionMs).toBeGreaterThan(0);
    expect(after.sessions.executionMs).toBeGreaterThan(0);
  }, 120_000);
});
