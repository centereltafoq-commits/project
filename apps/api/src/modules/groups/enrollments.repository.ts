import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, ilike, ne, or, SQL } from 'drizzle-orm';
import { EnrollmentStatus } from '@edu-center/shared';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import { enrollments, students } from '../../database/schemas';
import { normalizePagination } from '../../common/utils/pagination.util';
import { EnrollmentQueryDto } from './dto/enrollment.dto';

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
    const [updated] = await this.db
      .update(enrollments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(enrollments.id, id))
      .returning();
    return updated ?? null;
  }
}
