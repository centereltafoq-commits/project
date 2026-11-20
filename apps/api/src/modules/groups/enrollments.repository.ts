import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, ilike, inArray, ne, or, SQL, sql } from 'drizzle-orm';
import { EnrollmentStatus, SessionStatus } from '@edu-center/shared';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  attendance,
  enrollments,
  financialPolicies,
  paymentAllocations,
  payments,
  groups,
  sessions,
  studentMonthlyRecords,
  students,
} from '../../database/schemas';
import { normalizePagination } from '../../common/utils/pagination.util';
import { EnrollmentQueryDto } from './dto/enrollment.dto';
import { GroupMonthActivityBundle } from './enrollments-month-summary.calculator';

@Injectable()
export class EnrollmentsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async findPaginatedByGroup(groupId: string, query: EnrollmentQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const conditions: SQL[] = [eq(enrollments.groupId, groupId)];

    if (query.status) {
      conditions.push(eq(enrollments.status, query.status));
    }
    if (query.search) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(students.fullName, pattern),
          ilike(students.studentCode, pattern),
          ilike(students.phone, pattern),
          ilike(students.guardianPhone, pattern),
        )!,
      );
    }

    const whereClause = and(...conditions);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: enrollments.id,
          studentId: enrollments.studentId,
          studentCode: students.studentCode,
          studentName: students.fullName,
          studentPhone: students.phone,
          guardianPhone: students.guardianPhone,
          gradeLevel: students.gradeLevel,
          groupId: enrollments.groupId,
          startDate: enrollments.startDate,
          endDate: enrollments.endDate,
          agreedMonthlyPrice: enrollments.agreedMonthlyPrice,
          agreedSessionsCount: enrollments.agreedSessionsCount,
          agreedSessionPrice: enrollments.agreedSessionPrice,
          status: enrollments.status,
          notes: enrollments.notes,
          createdAt: enrollments.createdAt,
          updatedAt: enrollments.updatedAt,
        })
        .from(enrollments)
        .innerJoin(students, eq(enrollments.studentId, students.id))
        .where(whereClause)
        .orderBy(desc(enrollments.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(enrollments)
        .innerJoin(students, eq(enrollments.studentId, students.id))
        .where(whereClause),
    ]);

    return { rows, total: Number(total), page, limit };
  }

  async findGroupMonthActivity(
    groupId: string,
    yearMonth: string,
    studentIds: string[],
  ): Promise<GroupMonthActivityBundle> {
    const uniqueStudentIds = Array.from(new Set(studentIds));
    if (uniqueStudentIds.length === 0) {
      return {
        policy: null,
        monthSessions: [],
        sessionIdsWithAttendance: new Set<string>(),
        attendanceRows: [],
        storedRecords: [],
        allocatedByStudent: new Map<string, number>(),
      };
    }

    const [policyRows, monthSessions, storedRecords, allocationRows] = await Promise.all([
      this.db
        .select({
          fullMonthAbsencePolicy: financialPolicies.fullMonthAbsencePolicy,
          fullAbsenceFixedFee: financialPolicies.fullAbsenceFixedFee,
          chargeExcusedAbsence: financialPolicies.chargeExcusedAbsence,
        })
        .from(financialPolicies)
        .where(eq(financialPolicies.groupId, groupId))
        .limit(1),
      this.db
        .select({
          id: sessions.id,
          sessionDate: sessions.sessionDate,
          status: sessions.status,
        })
        .from(sessions)
        .where(
          and(
            eq(sessions.groupId, groupId),
            eq(sessions.yearMonth, yearMonth),
            ne(sessions.status, SessionStatus.CANCELLED),
          ),
        ),
      this.db
        .select({
          studentId: studentMonthlyRecords.studentId,
          isClosed: studentMonthlyRecords.isClosed,
          totalGroupSessions: studentMonthlyRecords.totalGroupSessions,
          eligibleSessions: studentMonthlyRecords.eligibleSessions,
          presentCount: studentMonthlyRecords.presentCount,
          absentCount: studentMonthlyRecords.absentCount,
          excusedCount: studentMonthlyRecords.excusedCount,
          sessionPriceSnapshot: studentMonthlyRecords.sessionPriceSnapshot,
          totalDue: studentMonthlyRecords.totalDue,
          totalPaid: studentMonthlyRecords.totalPaid,
        })
        .from(studentMonthlyRecords)
        .where(
          and(
            eq(studentMonthlyRecords.groupId, groupId),
            eq(studentMonthlyRecords.yearMonth, yearMonth),
            inArray(studentMonthlyRecords.studentId, uniqueStudentIds),
          ),
        ),
      this.db
        .select({
          studentId: payments.studentId,
          allocatedSum: sql<string>`COALESCE(SUM(${paymentAllocations.allocatedAmount}), 0)`,
        })
        .from(paymentAllocations)
        .innerJoin(payments, eq(paymentAllocations.paymentId, payments.id))
        .where(
          and(
            eq(paymentAllocations.groupId, groupId),
            eq(paymentAllocations.yearMonth, yearMonth),
            inArray(payments.studentId, uniqueStudentIds),
          ),
        )
        .groupBy(payments.studentId),
    ]);

    const sessionIds = monthSessions.map((s) => s.id);
    const [recordedSessionRows, attendanceRows] =
      sessionIds.length > 0
        ? await Promise.all([
            this.db
              .selectDistinct({ sessionId: attendance.sessionId })
              .from(attendance)
              .where(inArray(attendance.sessionId, sessionIds)),
            this.db
              .select({
                sessionId: attendance.sessionId,
                studentId: attendance.studentId,
                status: attendance.status,
              })
              .from(attendance)
              .where(
                and(
                  inArray(attendance.sessionId, sessionIds),
                  inArray(attendance.studentId, uniqueStudentIds),
                ),
              ),
          ])
        : [[], []];

    const allocatedByStudent = new Map<string, number>();
    for (const alloc of allocationRows) {
      allocatedByStudent.set(alloc.studentId, Number(alloc.allocatedSum || 0));
    }

    const policyRow = policyRows[0];
    return {
      policy: policyRow
        ? {
            fullMonthAbsencePolicy: policyRow.fullMonthAbsencePolicy,
            fullAbsenceFixedFee: Number(policyRow.fullAbsenceFixedFee || 0),
            chargeExcusedAbsence: Boolean(policyRow.chargeExcusedAbsence),
          }
        : null,
      monthSessions,
      sessionIdsWithAttendance: new Set(recordedSessionRows.map((r) => r.sessionId)),
      attendanceRows,
      storedRecords,
      allocatedByStudent,
    };
  }

  async findById(enrollmentId: string) {
    const [row] = await this.db
      .select()
      .from(enrollments)
      .where(eq(enrollments.id, enrollmentId))
      .limit(1);
    return row ?? null;
  }

  async findStudentExists(studentId: string) {
    const [row] = await this.db
      .select({ id: students.id })
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);
    return !!row;
  }

  async findActiveDuplicate(groupId: string, studentId: string, excludeEnrollmentId?: string) {
    const conditions: SQL[] = [
      eq(enrollments.groupId, groupId),
      eq(enrollments.studentId, studentId),
      eq(enrollments.status, EnrollmentStatus.ACTIVE),
    ];
    if (excludeEnrollmentId) {
      conditions.push(ne(enrollments.id, excludeEnrollmentId));
    }
    const [row] = await this.db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(...conditions))
      .limit(1);
    return row ?? null;
  }

  async countActiveInGroup(groupId: string): Promise<number> {
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(enrollments)
      .where(and(eq(enrollments.groupId, groupId), eq(enrollments.status, EnrollmentStatus.ACTIVE)));
    return Number(total);
  }

  async create(data: {
    studentId: string;
    groupId: string;
    startDate: string;
    endDate: string | null;
    agreedMonthlyPrice: string;
    agreedSessionsCount: number;
    agreedSessionPrice: string;
    status: string;
    notes: string | null;
  }) {
    const [created] = await this.db.insert(enrollments).values(data).returning();
    return created;
  }

  async createActive(data: {
    studentId: string;
    groupId: string;
    startDate: string;
    endDate: string | null;
    agreedMonthlyPrice: string;
    agreedSessionsCount: number;
    agreedSessionPrice: string;
    status: string;
    notes: string | null;
  }) {
    try {
      return await this.db.transaction(async (tx) => {
        const [group] = await tx
          .select({ id: groups.id, isActive: groups.isActive, maxStudents: groups.maxStudents })
          .from(groups)
          .where(eq(groups.id, data.groupId))
          .for('update')
          .limit(1);
        if (!group) throw new NotFoundException('المجموعة غير موجودة');
        if (!group.isActive) {
          throw new BadRequestException('لا يمكن تسجيل اشتراك جديد في مجموعة متوقفة');
        }

        const [student] = await tx
          .select({ id: students.id })
          .from(students)
          .where(eq(students.id, data.studentId))
          .limit(1);
        if (!student) throw new NotFoundException('الطالب غير موجود');

        await this.assertStudentCanBeActivated(tx, data.groupId, data.studentId, group.maxStudents);
        const [created] = await tx.insert(enrollments).values(data).returning();
        return created;
      });
    } catch (error) {
      this.rethrowActiveEnrollmentConflict(error);
      throw error;
    }
  }

  async update(
    id: string,
    updates: Partial<{
      status: string;
      startDate: string;
      endDate: string | null;
      agreedMonthlyPrice: string;
      agreedSessionPrice: string;
      notes: string | null;
    }>,
  ) {
    try {
      return await this.db.transaction(async (tx) => {
        const [initial] = await tx
          .select({ groupId: enrollments.groupId })
          .from(enrollments)
          .where(eq(enrollments.id, id))
          .limit(1);
        if (!initial) return null;

        const shouldActivate = updates.status === EnrollmentStatus.ACTIVE;
        let maxStudents: number | undefined;
        if (shouldActivate) {
          const [group] = await tx
            .select({ id: groups.id, maxStudents: groups.maxStudents })
            .from(groups)
            .where(eq(groups.id, initial.groupId))
            .for('update')
            .limit(1);
          if (!group) throw new NotFoundException('المجموعة غير موجودة');
          maxStudents = group.maxStudents;
        }

        const [existing] = await tx
          .select()
          .from(enrollments)
          .where(eq(enrollments.id, id))
          .for('update')
          .limit(1);
        if (!existing) return null;

        if (shouldActivate && existing.status !== EnrollmentStatus.ACTIVE) {
          await this.assertStudentCanBeActivated(
            tx,
            existing.groupId,
            existing.studentId,
            maxStudents!,
            id,
          );
        }

        const [updated] = await tx
          .update(enrollments)
          .set({ ...updates, updatedAt: new Date() })
          .where(eq(enrollments.id, id))
          .returning();
        return updated ?? null;
      });
    } catch (error) {
      this.rethrowActiveEnrollmentConflict(error);
      throw error;
    }
  }

  private async assertStudentCanBeActivated(
    tx: Parameters<Parameters<DrizzleDatabase['transaction']>[0]>[0],
    groupId: string,
    studentId: string,
    maxStudents: number,
    excludeEnrollmentId?: string,
  ): Promise<void> {
    const duplicateConditions = [
      eq(enrollments.groupId, groupId),
      eq(enrollments.studentId, studentId),
      eq(enrollments.status, EnrollmentStatus.ACTIVE),
    ];
    if (excludeEnrollmentId) duplicateConditions.push(ne(enrollments.id, excludeEnrollmentId));

    const [duplicate] = await tx
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(and(...duplicateConditions))
      .limit(1);
    if (duplicate) {
      throw new ConflictException('الطالب مشترك بالفعل باشتراك نشط في هذه المجموعة');
    }

    const [{ total }] = await tx
      .select({ total: count() })
      .from(enrollments)
      .where(and(eq(enrollments.groupId, groupId), eq(enrollments.status, EnrollmentStatus.ACTIVE)));
    if (Number(total) >= maxStudents) {
      throw new BadRequestException(`اكتملت السعة القصوى للمجموعة (${maxStudents} طالباً)`);
    }
  }

  private rethrowActiveEnrollmentConflict(error: unknown): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505' &&
      'constraint' in error &&
      error.constraint === 'uq_enrollments_group_student_active'
    ) {
      throw new ConflictException('الطالب مشترك بالفعل باشتراك نشط في هذه المجموعة');
    }
  }
}
