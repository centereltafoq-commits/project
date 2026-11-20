import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EnrollmentStatus } from '@edu-center/shared';
import * as schema from '../../database/schemas';
import { ensureDatabaseReady } from '../../database/db-auto-bootstrap';
import { EnrollmentsRepository } from './enrollments.repository';
import { GroupsMutationRepository } from './groups-mutation.repository';

const testDatabaseUrl = process.env.DATABASE_MIGRATION_TEST_URL;
const enrollmentSuite = testDatabaseUrl ? describe : describe.skip;

enrollmentSuite('Enrollment capacity and uniqueness - PostgreSQL integration', () => {
  let pool: Pool;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let enrollmentsRepo: EnrollmentsRepository;
  let groupsMutationRepo: GroupsMutationRepository;
  const teacherId = randomUUID();
  const studentIds = [randomUUID(), randomUUID(), randomUUID()];
  const groupIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  const prefix = `ENR-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    const databaseName = new URL(testDatabaseUrl!).pathname.slice(1);
    if (!databaseName.startsWith('edu_center_migration_test_')) {
      throw new Error(
        'DATABASE_MIGRATION_TEST_URL must point to an isolated edu_center_migration_test_* database',
      );
    }
    await ensureDatabaseReady(testDatabaseUrl!);
    pool = new Pool({ connectionString: testDatabaseUrl, max: 8 });
    db = drizzle(pool, { schema });
    enrollmentsRepo = new EnrollmentsRepository(db as any);
    groupsMutationRepo = new GroupsMutationRepository(db as any);

    await db.insert(schema.teachers).values({
      id: teacherId,
      teacherCode: `${prefix}-T`,
      fullName: 'Enrollment Test Teacher',
      phone: '0000000000',
      specialization: 'Test',
      contractDate: '2020-01-01',
    });
    await db.insert(schema.students).values(
      studentIds.map((id, index) => ({
        id,
        studentCode: `${prefix}-S${index + 1}`,
        fullName: `Enrollment Test Student ${index + 1}`,
        gradeLevel: 'Test',
        registrationDate: '2020-01-01',
      })),
    );
    await db.insert(schema.groups).values(
      groupIds.map((id, index) => ({
        id,
        groupCode: `${prefix}-G${index + 1}`,
        name: `Enrollment Test Group ${index + 1}`,
        subject: 'Test',
        gradeLevel: 'Test',
        primaryTeacherId: teacherId,
        monthlySessionsCount: 1,
        monthlyPrice: '100.00',
        calculatedSessionPrice: '100.00',
        maxStudents: index === 1 || index === 2 ? 2 : 1,
      })),
    );
  });

  afterAll(async () => {
    if (pool) {
      await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE');
      await pool.end();
    }
  });

  function enrollmentData(groupId: string, studentId: string, status: string) {
    return {
      groupId,
      studentId,
      startDate: '2098-01-01',
      endDate: status === EnrollmentStatus.ACTIVE ? null : '2098-01-31',
      agreedMonthlyPrice: '100.00',
      agreedSessionsCount: 1,
      agreedSessionPrice: '100.00',
      status,
      notes: null,
    };
  }

  it('allows only one of two concurrent enrollments for the last available place', async () => {
    const [groupId] = groupIds;
    const [firstStudent, secondStudent] = studentIds;
    const results = await Promise.allSettled([
      enrollmentsRepo.createActive(
        enrollmentData(groupId!, firstStudent!, EnrollmentStatus.ACTIVE),
      ),
      enrollmentsRepo.createActive(
        enrollmentData(groupId!, secondStudent!, EnrollmentStatus.ACTIVE),
      ),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const active = await pool.query(
      'SELECT count(*)::int AS count FROM enrollments WHERE group_id = $1 AND status = $2',
      [groupId, EnrollmentStatus.ACTIVE],
    );
    expect(active.rows[0]?.count).toBe(1);
  });

  it('rejects duplicate active enrollment while preserving multiple inactive historical records', async () => {
    const groupId = groupIds[1]!;
    const studentId = studentIds[0]!;
    await enrollmentsRepo.createActive(
      enrollmentData(groupId, studentId, EnrollmentStatus.ACTIVE),
    );
    await db.insert(schema.enrollments).values([
      enrollmentData(groupId, studentId, EnrollmentStatus.CANCELLED),
      enrollmentData(groupId, studentId, EnrollmentStatus.CANCELLED),
    ]);

    await expect(
      enrollmentsRepo.createActive(
        enrollmentData(groupId, studentId, EnrollmentStatus.ACTIVE),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    const history = await pool.query(
      'SELECT count(*)::int AS count FROM enrollments WHERE group_id=$1 AND student_id=$2 AND status=$3',
      [groupId, studentId, EnrollmentStatus.CANCELLED],
    );
    expect(history.rows[0]?.count).toBe(2);
  });

  it('serializes reactivation with active duplicates and capacity checks', async () => {
    const groupId = groupIds[2]!;
    const [activeStudent, pausedStudent, duplicateStudent] = studentIds;
    await enrollmentsRepo.createActive(
      enrollmentData(groupId, activeStudent!, EnrollmentStatus.ACTIVE),
    );
    const [paused] = await db
      .insert(schema.enrollments)
      .values(enrollmentData(groupId, pausedStudent!, EnrollmentStatus.PAUSED))
      .returning();
    const [duplicateHistory] = await db
      .insert(schema.enrollments)
      .values(enrollmentData(groupId, activeStudent!, EnrollmentStatus.CANCELLED))
      .returning();

    const reactivated = await enrollmentsRepo.update(paused!.id, {
      status: EnrollmentStatus.ACTIVE,
      endDate: null,
    });
    expect(reactivated?.status).toBe(EnrollmentStatus.ACTIVE);
    await expect(
      enrollmentsRepo.update(duplicateHistory!.id, {
        status: EnrollmentStatus.ACTIVE,
        endDate: null,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const overCapacity = await db
      .insert(schema.enrollments)
      .values(enrollmentData(groupId, duplicateStudent!, EnrollmentStatus.CANCELLED))
      .returning();
    await expect(
      enrollmentsRepo.update(overCapacity[0]!.id, {
        status: EnrollmentStatus.ACTIVE,
        endDate: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents capacity reductions from racing past active enrollments', async () => {
    const groupId = groupIds[3]!;
    const studentId = studentIds[0]!;
    const results = await Promise.allSettled([
      enrollmentsRepo.createActive(
        enrollmentData(groupId, studentId, EnrollmentStatus.ACTIVE),
      ),
      groupsMutationRepo.updateWithRelations(groupId, { maxStudents: 0 }),
    ]);

    const active = await pool.query(
      `SELECT g.max_students, count(e.id)::int AS active_count
       FROM groups g LEFT JOIN enrollments e
         ON e.group_id = g.id AND e.status = $2
       WHERE g.id = $1 GROUP BY g.id`,
      [groupId, EnrollmentStatus.ACTIVE],
    );
    expect(Number(active.rows[0]?.active_count)).toBeLessThanOrEqual(
      Number(active.rows[0]?.max_students),
    );
    expect(results.some((result) => result.status === 'fulfilled')).toBe(true);
  });
});
