import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '../../../database/schemas';
import { splitDrizzleSqlStatements } from '../../../database/db-auto-bootstrap';
import { ExpenseCategory, PaymentMethod } from '@edu-center/shared';
import { ExpensesRepository } from './expenses.repository';
import { PaymentsRepository } from './payments.repository';
import { MonthlySettlementWriteRepository } from './monthly-settlement-write.repository';
import { TeacherPayoutsRepository } from './teacher-payouts.repository';

const testDatabaseUrl = process.env.SETTLEMENT_TEST_DATABASE_URL;
const financeLockSuite = testDatabaseUrl ? describe : describe.skip;
const yearMonth = '2098-07';

function makeDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((done) => (resolve = done));
  return { promise, resolve };
}

async function waitForAdvisoryLockWaiter(pool: Pool, minimumCount = 1): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const result = await pool.query(
      `SELECT count(*)::int AS count FROM pg_stat_activity
       WHERE datname = current_database()
         AND wait_event_type = 'Lock'
         AND query ILIKE '%pg_advisory_xact_lock%'`,
    );
    if (result.rows[0]?.count >= minimumCount) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for a transaction to block on the monthly advisory lock');
}

financeLockSuite('Finance month lock - PostgreSQL integration', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let settlementWriteRepo: MonthlySettlementWriteRepository;
  let paymentsRepo: PaymentsRepository;
  let expensesRepo: ExpensesRepository;
  let teacherPayoutsRepo: TeacherPayoutsRepository;
  const teacherId = randomUUID();
  const groupId = randomUUID();
  const studentId = randomUUID();
  const roleId = randomUUID();
  const userId = randomUUID();
  const studentRecordId = randomUUID();
  const prefix = `FIN-LOCK-${process.pid}-${Date.now()}`;

  beforeAll(async () => {
    const databaseName = new URL(testDatabaseUrl!).pathname.slice(1);
    if (!databaseName.startsWith('edu_center_settlement_test_')) {
      throw new Error(
        'SETTLEMENT_TEST_DATABASE_URL must point to an isolated edu_center_settlement_test_* database',
      );
    }

    pool = new Pool({ connectionString: testDatabaseUrl, max: 6 });
    const existingTables = await pool.query(
      "SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public'",
    );
    if (existingTables.rows[0]?.count !== 0) {
      throw new Error('Finance lock integration tests require a fresh isolated test database');
    }

    const migrationPath = path.resolve(process.cwd(), 'drizzle', '0000_famous_banshee.sql');
    const migration = fs.readFileSync(migrationPath, 'utf8');
    for (const statement of splitDrizzleSqlStatements(migration)) {
      await pool.query(statement);
    }

    db = drizzle(pool, { schema });
    settlementWriteRepo = new MonthlySettlementWriteRepository(db as any);
    paymentsRepo = new PaymentsRepository(db as any);
    expensesRepo = new ExpensesRepository(db as any);
    teacherPayoutsRepo = new TeacherPayoutsRepository(db as any);

    await db.insert(schema.roles).values({ id: roleId, code: `${prefix}-ROLE`, nameAr: 'اختبار' });
    await db.insert(schema.users).values({
      id: userId,
      fullName: 'Finance Lock Test User',
      email: `${prefix}@example.test`,
      passwordHash: 'not-used-in-test',
      roleId,
    });
    await db.insert(schema.teachers).values({
      id: teacherId,
      teacherCode: `${prefix}-T`,
      fullName: 'Finance Lock Test Teacher',
      phone: '0000000000',
      specialization: 'Test',
      contractDate: '2020-01-01',
    });
    await db.insert(schema.groups).values({
      id: groupId,
      groupCode: `${prefix}-G`,
      name: 'Finance Lock Test Group',
      subject: 'Test',
      gradeLevel: 'Test',
      primaryTeacherId: teacherId,
      monthlySessionsCount: 1,
      monthlyPrice: '100.00',
      calculatedSessionPrice: '100.00',
      maxStudents: 10,
    });
    await db.insert(schema.students).values({
      id: studentId,
      studentCode: `${prefix}-S`,
      fullName: 'Finance Lock Test Student',
      gradeLevel: 'Test',
      registrationDate: '2020-01-01',
    });
    await db.insert(schema.studentMonthlyRecords).values({
      id: studentRecordId,
      studentId,
      groupId,
      yearMonth,
      totalGroupSessions: 1,
      eligibleSessions: 1,
      presentCount: 1,
      absentCount: 0,
      excusedCount: 0,
      makeupAttendedCount: 0,
      sessionPriceSnapshot: '100.00',
      extraMakeupFees: '0.00',
      totalDue: '100.00',
      totalPaid: '0.00',
      remainingBalance: '100.00',
    });
  });

  afterAll(async () => {
    if (pool) {
      await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
      await pool.end();
    }
  });

  it('serializes a recalculation with collection and preserves the saved allocation total', async () => {
    const acquired = makeDeferred();
    const release = makeDeferred();
    const recalculation = settlementWriteRepo.withMonthLock(yearMonth, async (tx) => {
      // The settlement snapshot has already been read at this point.
      acquired.resolve();
      await release.promise;
      await settlementWriteRepo.persistRecalculationBatch(
        {
          yearMonth,
          studentRows: [
            {
              studentId,
              groupId,
              yearMonth,
              totalGroupSessions: 1,
              eligibleSessions: 1,
              presentCount: 1,
              absentCount: 0,
              excusedCount: 0,
              makeupAttendedCount: 0,
              sessionPriceSnapshot: '100.00',
              extraMakeupFees: '0.00',
              totalDue: '100.00',
              totalPaid: '0.00',
              remainingBalance: '100.00',
              isClosed: false,
            },
          ],
          teacherDueRows: [],
          teacherMonthlyRows: [],
          openAssistantIdsToRefreshDues: [],
          assistantDueRows: [],
          assistantMonthlyRows: [],
        },
        tx,
      );
    });

    await acquired.promise;
    const paymentStarted = makeDeferred();
    const payment = (async () => {
      paymentStarted.resolve();
      return paymentsRepo.createPaymentWithAllocations({
        receiptNumber: `${prefix}-R1`,
        studentId,
        yearMonth,
        amount: 30,
        paymentDate: '2098-07-15',
        paymentMethod: PaymentMethod.CASH,
        receivedByUserId: userId,
      });
    })();
    await paymentStarted.promise;
    await waitForAdvisoryLockWaiter(pool);
    release.resolve();
    await Promise.all([recalculation, payment]);

    const totals = await pool.query(
      `SELECT smr.total_paid, COALESCE(SUM(pa.allocated_amount), 0)::numeric(12,2) AS allocated
       FROM student_monthly_records smr
       LEFT JOIN payment_allocations pa
         ON pa.student_monthly_record_id = smr.id AND pa.year_month = smr.year_month
       WHERE smr.id = $1
       GROUP BY smr.id`,
      [studentRecordId],
    );
    expect(totals.rows[0]).toEqual({ total_paid: '30.00', allocated: '30.00' });

    await Promise.all(
      [2, 3].map((suffix) =>
        paymentsRepo.createPaymentWithAllocations({
          receiptNumber: `${prefix}-R${suffix}`,
          studentId,
          yearMonth,
          amount: 20,
          paymentDate: '2098-07-16',
          paymentMethod: PaymentMethod.CASH,
          receivedByUserId: userId,
        }),
      ),
    );
    const concurrentTotals = await pool.query(
      `SELECT smr.total_paid, COALESCE(SUM(pa.allocated_amount), 0)::numeric(12,2) AS allocated
       FROM student_monthly_records smr
       LEFT JOIN payment_allocations pa
         ON pa.student_monthly_record_id = smr.id AND pa.year_month = smr.year_month
       WHERE smr.id = $1
       GROUP BY smr.id`,
      [studentRecordId],
    );
    expect(concurrentTotals.rows[0]).toEqual({ total_paid: '70.00', allocated: '70.00' });
  });

  it('serializes closing with expense creation and payout of the remaining teacher balance', async () => {
    await db.insert(schema.teacherMonthlyRecords).values({
      teacherId,
      yearMonth,
      groupsCount: 1,
      executedSessionsCount: 1,
      totalDues: '200.00',
      totalPaidOut: '0.00',
      remainingBalance: '200.00',
      isClosed: false,
    });

    const acquired = makeDeferred();
    const release = makeDeferred();
    const close = settlementWriteRepo.withMonthLock(yearMonth, async (tx) => {
      acquired.resolve();
      await release.promise;
      return settlementWriteRepo.lockMonthRecords(yearMonth, tx);
    });

    await acquired.promise;
    const expenseStarted = makeDeferred();
    const expense = (async () => {
      expenseStarted.resolve();
      return expensesRepo.create({
        category: ExpenseCategory.RENT,
        title: 'Lock race test',
        amount: '10.00',
        expenseDate: '2098-07-15',
        yearMonth,
        paymentMethod: PaymentMethod.CASH,
        recordedByUserId: userId,
      });
    })();
    const payoutStarted = makeDeferred();
    const payout = (async () => {
      payoutStarted.resolve();
      return teacherPayoutsRepo.createTx({
        referenceNumber: `${prefix}-PAYOUT`,
        teacherId,
        yearMonth,
        amount: 100,
        payoutDate: '2098-07-17',
        paymentMethod: PaymentMethod.CASH,
        paidByUserId: userId,
      });
    })();
    await expenseStarted.promise;
    await payoutStarted.promise;
    await waitForAdvisoryLockWaiter(pool, 2);
    release.resolve();
    await close;
    await expect(expense).rejects.toThrow('مغلق نهائياً');
    await expect(payout).resolves.toMatchObject({ amount: 100 });

    const expenseCount = await pool.query(
      'SELECT count(*)::int AS count FROM expenses WHERE title = $1',
      ['Lock race test'],
    );
    expect(expenseCount.rows[0]?.count).toBe(0);
    const frozenDues = await pool.query(
      'SELECT total_dues, total_paid_out, remaining_balance, is_closed FROM teacher_monthly_records WHERE teacher_id=$1 AND year_month=$2',
      [teacherId, yearMonth],
    );
    expect(frozenDues.rows[0]).toEqual({
      total_dues: '200.00',
      total_paid_out: '100.00',
      remaining_balance: '100.00',
      is_closed: true,
    });
  });
});
