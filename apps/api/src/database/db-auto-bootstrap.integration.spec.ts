import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureDatabaseReady } from './db-auto-bootstrap';

const migrationTestUrl = process.env.DATABASE_MIGRATION_TEST_URL;
const migrationSuite = migrationTestUrl ? describe : describe.skip;

migrationSuite('numbered database migrations - PostgreSQL integration', () => {
  let pool: Pool;

  beforeAll(async () => {
    const databaseName = new URL(migrationTestUrl!).pathname.slice(1);
    if (!databaseName.startsWith('edu_center_migration_test_')) {
      throw new Error(
        'DATABASE_MIGRATION_TEST_URL must point to an isolated edu_center_migration_test_* database',
      );
    }
    pool = new Pool({ connectionString: migrationTestUrl, max: 8 });
    const tables = await pool.query(
      "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
    );
    if (tables.rows[0]?.count !== 0) {
      throw new Error('Database migration integration tests require a fresh isolated database');
    }
  });

  afterAll(async () => {
    if (pool) {
      await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE');
      await pool.end();
    }
  });

  it('serializes concurrent first starts and records each numbered migration once', async () => {
    const results = await Promise.all([
      ensureDatabaseReady(migrationTestUrl!),
      ensureDatabaseReady(migrationTestUrl!),
    ]);

    expect(results.filter((result) => result.schemaInitialized)).toHaveLength(1);
    const history = await pool.query(
      'SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations',
    );
    const users = await pool.query('SELECT count(*)::int AS count FROM public.users');
    expect(history.rows[0]?.count).toBe(3);
    expect(users.rows[0]?.count).toBe(1);
  });

  it('adopts a complete legacy schema with extra columns and preserves existing data', async () => {
    const studentCode = `MIG-${randomUUID()}`;
    await pool.query(
      `INSERT INTO public.students (student_code, full_name, grade_level, registration_date)
       VALUES ($1, 'Legacy Student', 'Test', DATE '2026-01-01')`,
      [studentCode],
    );
    await pool.query(
      'ALTER TABLE public.teachers ADD COLUMN can_approve_bookings boolean NOT NULL DEFAULT false',
    );
    await pool.query(`DROP INDEX public.uq_enrollments_group_student_active,
      public.idx_payments_year_month,
      public.idx_payment_allocations_year_month,
      public.idx_sessions_year_month`);
    await pool.query('DROP SCHEMA drizzle CASCADE');

    const result = await ensureDatabaseReady(migrationTestUrl!);
    expect(result.schemaInitialized).toBe(false);
    expect(result.identitySeeded).toBe(false);
    const savedStudent = await pool.query(
      'SELECT full_name FROM public.students WHERE student_code = $1',
      [studentCode],
    );
    const extraColumn = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'teachers'
         AND column_name = 'can_approve_bookings'`,
    );
    expect(savedStudent.rows[0]?.full_name).toBe('Legacy Student');
    expect(extraColumn.rowCount).toBe(1);
    const migratedIndex = await pool.query(
      "SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uq_enrollments_group_student_active'",
    );
    expect(migratedIndex.rowCount).toBe(1);
    const financeIndexes = await pool.query(
      `SELECT count(*)::int AS count FROM pg_indexes WHERE schemaname='public'
       AND indexname IN ('idx_payments_year_month', 'idx_payment_allocations_year_month', 'idx_sessions_year_month')`,
    );
    expect(financeIndexes.rows[0]?.count).toBe(3);
    expect(await ensureDatabaseReady(migrationTestUrl!)).toMatchObject({
      schemaInitialized: false,
      identitySeeded: false,
    });
  });

  it('shows active duplicate enrollment pairs before applying the unique index', async () => {
    await pool.query(`DROP INDEX public.uq_enrollments_group_student_active,
      public.idx_payments_year_month,
      public.idx_payment_allocations_year_month,
      public.idx_sessions_year_month`);
    await pool.query('DROP SCHEMA drizzle CASCADE');
    const [student] = (
      await pool.query('SELECT id FROM public.students ORDER BY created_at LIMIT 1')
    ).rows;
    const teacherId = randomUUID();
    const groupId = randomUUID();
    await pool.query(
      `INSERT INTO public.teachers (id, teacher_code, full_name, phone, specialization, contract_date)
       VALUES ($1, $2, 'Migration Duplicate Test Teacher', '0000000000', 'Test', DATE '2020-01-01')`,
      [teacherId, `MIG-T-${teacherId.slice(0, 8)}`],
    );
    await pool.query(
      `INSERT INTO public.groups (id, group_code, name, subject, grade_level, primary_teacher_id,
                                  monthly_sessions_count, monthly_price, calculated_session_price, max_students)
       VALUES ($1, $2, 'Migration Duplicate Test Group', 'Test', 'Test', $3, 1, 100, 100, 10)`,
      [groupId, `MIG-G-${groupId.slice(0, 8)}`, teacherId],
    );
    await pool.query(
      `INSERT INTO public.enrollments (student_id, group_id, start_date, agreed_monthly_price,
                                       agreed_sessions_count, agreed_session_price, status)
       VALUES ($1, $2, DATE '2026-01-01', 100, 1, 100, 'ACTIVE'),
              ($1, $2, DATE '2026-01-01', 100, 1, 100, 'ACTIVE')`,
      [student.id, groupId],
    );

    await expect(ensureDatabaseReady(migrationTestUrl!)).rejects.toThrow(groupId);
    const duplicates = await pool.query(
      'SELECT count(*)::int AS count FROM public.enrollments WHERE group_id=$1 AND student_id=$2 AND status=$3',
      [groupId, student.id, 'ACTIVE'],
    );
    const history = await pool.query('SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations');
    expect(duplicates.rows[0]?.count).toBe(2);
    expect(history.rows[0]?.count).toBe(1);

    await pool.query(
      'UPDATE public.enrollments SET status=$1 WHERE group_id=$2 AND student_id=$3',
      ['CANCELLED', groupId, student.id],
    );
    await ensureDatabaseReady(migrationTestUrl!);
    const migratedHistory = await pool.query(
      'SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations',
    );
    expect(migratedHistory.rows[0]?.count).toBe(3);
  });

  it('fails before stamping a legacy schema that is missing a required column', async () => {
    await pool.query(`DROP INDEX public.uq_enrollments_group_student_active,
      public.idx_payments_year_month,
      public.idx_payment_allocations_year_month,
      public.idx_sessions_year_month`);
    await pool.query('DROP SCHEMA drizzle CASCADE');
    await pool.query('ALTER TABLE public.students DROP COLUMN phone');

    await expect(ensureDatabaseReady(migrationTestUrl!)).rejects.toThrow(
      'students.phone',
    );
    const history = await pool.query(
      "SELECT to_regclass('drizzle.__drizzle_migrations') AS table_name",
    );
    expect(history.rows[0]?.table_name).toBeNull();

    await pool.query('ALTER TABLE public.students ADD COLUMN phone varchar(30)');
    await ensureDatabaseReady(migrationTestUrl!);
  });
});
