import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { splitDrizzleSqlStatements } from '../../../database/db-auto-bootstrap';
import {
  assistantDues,
  assistants,
  groups,
  studentMonthlyRecords,
  students,
  teachers,
} from '../../../database/schemas';
import { NewStudentMonthlyRow, MonthlySettlementWriteRepository } from './monthly-settlement-write.repository';

const testDatabaseUrl = process.env.SETTLEMENT_TEST_DATABASE_URL;
const settlementSuite = testDatabaseUrl ? describe : describe.skip;
const groupId = randomUUID();
const teacherId = randomUUID();
const assistantId = randomUUID();
const studentCodePrefix = `REPAIR-${process.pid}-${Date.now()}-`;

function makeMonthlyRow(
  studentId: string,
  month: string,
  totalDue = '1.00',
): NewStudentMonthlyRow {
  return {
    studentId,
    groupId,
    yearMonth: month,
    totalGroupSessions: 1,
    eligibleSessions: 1,
    presentCount: 1,
    absentCount: 0,
    excusedCount: 0,
    makeupAttendedCount: 0,
    sessionPriceSnapshot: '1.00',
    extraMakeupFees: '0.00',
    totalDue,
    totalPaid: '0.00',
    remainingBalance: totalDue,
    isClosed: false,
  };
}

settlementSuite('MonthlySettlementWriteRepository - PostgreSQL batches', () => {
  let client: Client;
  let repository: MonthlySettlementWriteRepository;
  let studentIds: string[] = [];

  beforeAll(async () => {
    const databaseName = new URL(testDatabaseUrl!).pathname.slice(1);
    if (!databaseName.startsWith('edu_center_settlement_test_')) {
      throw new Error(
        'SETTLEMENT_TEST_DATABASE_URL must point to an isolated edu_center_settlement_test_* database',
      );
    }

    client = new Client({ connectionString: testDatabaseUrl });
    await client.connect();
    const existingTables = await client.query(
      "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public'",
    );
    if (existingTables.rows[0]?.count !== 0) {
      throw new Error('Settlement integration tests require a fresh isolated test database');
    }

    const migrationPath = path.resolve(process.cwd(), 'drizzle', '0000_famous_banshee.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    for (const statement of splitDrizzleSqlStatements(migration)) {
      await client.query(statement);
    }

    const database = drizzle(client);
    repository = new MonthlySettlementWriteRepository(database as any);

    await database.insert(teachers).values({
      id: teacherId,
      teacherCode: `${studentCodePrefix}TEACHER`,
      fullName: 'Settlement Integration Teacher',
      phone: '0000000000',
      specialization: 'Test',
      contractDate: '2020-01-01',
    });
    await database.insert(groups).values({
      id: groupId,
      groupCode: `${studentCodePrefix}GROUP`,
      name: 'Settlement Integration Group',
      subject: 'Test',
      gradeLevel: 'Test',
      primaryTeacherId: teacherId,
      monthlySessionsCount: 1,
      monthlyPrice: '1.00',
      calculatedSessionPrice: '1.00',
      maxStudents: 10000,
    });
    await database.insert(assistants).values({
      id: assistantId,
      assistantCode: `${studentCodePrefix}ASSISTANT`,
      fullName: 'Settlement Integration Assistant',
      phone: '0000000001',
    });

    const insertedStudents = await client.query(
      `INSERT INTO students (student_code, full_name, grade_level, registration_date)
       SELECT $1 || n, 'Settlement Student ' || n, 'Test', DATE '2026-01-01'
       FROM generate_series(1, 5000) AS n
       RETURNING id`,
      [studentCodePrefix],
    );
    studentIds = insertedStudents.rows.map((row) => row.id as string);
  });

  afterAll(async () => {
    if (client) {
      await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
      await client.end();
    }
  });

  it('persists 5,000 student settlement rows without exceeding the parameter limit', async () => {
    const rows = studentIds.map((studentId) => makeMonthlyRow(studentId, '2099-01'));

    await repository.persistRecalculationBatch({
      yearMonth: '2099-01',
      studentRows: rows,
      teacherDueRows: [],
      teacherMonthlyRows: [],
      openAssistantIdsToRefreshDues: [],
      assistantDueRows: [],
      assistantMonthlyRows: [],
    });

    const saved = await client.query(
      'SELECT count(*)::int AS count, count(DISTINCT student_id)::int AS students FROM student_monthly_records WHERE year_month = $1',
      ['2099-01'],
    );
    expect(saved.rows[0]).toEqual({ count: 5000, students: 5000 });
  });

  it('rolls back earlier settlement batches when a later batch violates a constraint', async () => {
    const oldAssistantDue = await client.query(
      `INSERT INTO assistant_dues
         (assistant_id, year_month, calculation_method, amount, is_locked)
       VALUES ($1, '2099-02', 'SESSION_COMMISSION_PERCENT', 7.00, false)
       RETURNING id`,
      [assistantId],
    );
    await client.query(
      'ALTER TABLE assistant_dues ADD CONSTRAINT test_settlement_batch_failure CHECK (amount <> 99.00)',
    );
    const dues = Array.from({ length: 501 }, (_, index) => ({
      assistantId,
      groupId,
      yearMonth: '2099-02',
      calculationMethod: 'SESSION_COMMISSION_PERCENT',
      sessionsCount: 1,
      studentsCount: index + 1,
      amount: index === 500 ? '99.00' : '1.00',
      isLocked: false,
    }));

    await expect(
      repository.persistRecalculationBatch({
        yearMonth: '2099-02',
        studentRows: [makeMonthlyRow(studentIds[0]!, '2099-02')],
        teacherDueRows: [],
        teacherMonthlyRows: [],
        openAssistantIdsToRefreshDues: [assistantId],
        assistantDueRows: dues,
        assistantMonthlyRows: [],
      }),
    ).rejects.toThrow();

    const rolledBack = await client.query(
      'SELECT count(*)::int AS count FROM student_monthly_records WHERE year_month = $1',
      ['2099-02'],
    );
    const preserved = await client.query(
      'SELECT count(*)::int AS count FROM student_monthly_records WHERE year_month = $1',
      ['2099-01'],
    );
    const restoredAssistantDue = await client.query(
      'SELECT id, amount FROM assistant_dues WHERE year_month=$1',
      ['2099-02'],
    );
    expect(rolledBack.rows[0]?.count).toBe(0);
    expect(preserved.rows[0]?.count).toBe(5000);
    expect(restoredAssistantDue.rows).toEqual([{ id: oldAssistantDue.rows[0].id, amount: '7.00' }]);
    await client.query(
      'ALTER TABLE assistant_dues DROP CONSTRAINT test_settlement_batch_failure',
    );
  });

  it('does not overwrite a previously closed student record during recalculation', async () => {
    const closedRow = makeMonthlyRow(studentIds[0]!, '2099-03', '25.00');
    await repository.persistRecalculationBatch({
      yearMonth: '2099-03',
      studentRows: [{ ...closedRow, isClosed: true }],
      teacherDueRows: [],
      teacherMonthlyRows: [],
      openAssistantIdsToRefreshDues: [],
      assistantDueRows: [],
      assistantMonthlyRows: [],
    });
    await repository.persistRecalculationBatch({
      yearMonth: '2099-03',
      studentRows: [makeMonthlyRow(studentIds[0]!, '2099-03', '99.00')],
      teacherDueRows: [],
      teacherMonthlyRows: [],
      openAssistantIdsToRefreshDues: [],
      assistantDueRows: [],
      assistantMonthlyRows: [],
    });

    const saved = await client.query(
      'SELECT total_due, is_closed FROM student_monthly_records WHERE student_id=$1 AND year_month=$2',
      [studentIds[0], '2099-03'],
    );
    expect(saved.rows[0]).toEqual({ total_due: '25.00', is_closed: true });
  });
});
