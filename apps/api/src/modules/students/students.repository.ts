import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, ilike, or, sql, SQL } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import { enrollments, students } from '../../database/schemas';
import { normalizePagination } from '../../common/utils/pagination.util';
import { StudentQueryDto } from './dto/student.dto';

@Injectable()
export class StudentsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async findPaginated(query: StudentQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const conditions: SQL[] = [];

    if (query.status) {
      conditions.push(eq(students.status, query.status));
    }
    if (query.gradeLevel) {
      conditions.push(eq(students.gradeLevel, query.gradeLevel));
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

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const activeGroupsCountSq = sql<number>`(
      SELECT COUNT(*)::int
      FROM ${enrollments} e
      WHERE e.student_id = "students"."id" AND e.status = 'ACTIVE'
    )`.as('active_groups_count');

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: students.id,
          studentCode: students.studentCode,
          fullName: students.fullName,
          phone: students.phone,
          guardianPhone: students.guardianPhone,
          gradeLevel: students.gradeLevel,
          registrationDate: students.registrationDate,
          status: students.status,
          notes: students.notes,
          activeGroupsCount: activeGroupsCountSq,
          createdAt: students.createdAt,
          updatedAt: students.updatedAt,
        })
        .from(students)
        .where(whereClause)
        .orderBy(desc(students.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(students).where(whereClause),
    ]);

    return { rows, total: Number(total), page, limit };
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(students).where(eq(students.id, id)).limit(1);
    return row ?? null;
  }

  async findByCode(studentCode: string) {
    const [row] = await this.db
      .select({ id: students.id, studentCode: students.studentCode })
      .from(students)
      .where(eq(students.studentCode, studentCode))
      .limit(1);
    return row ?? null;
  }

  async create(data: {
    studentCode: string;
    fullName: string;
    phone: string;
    guardianPhone: string;
    gradeLevel: string;
    registrationDate: string;
    status: string;
    notes?: string | null;
  }) {
    const [created] = await this.db
      .insert(students)
      .values({
        studentCode: data.studentCode,
        fullName: data.fullName,
        phone: data.phone,
        guardianPhone: data.guardianPhone,
        gradeLevel: data.gradeLevel,
        registrationDate: data.registrationDate,
        status: data.status,
        notes: data.notes ?? null,
      })
      .returning();
    return created;
  }

  async update(
    id: string,
    updates: Partial<{
      fullName: string;
      phone: string;
      guardianPhone: string;
      gradeLevel: string;
      registrationDate: string;
      status: string;
      notes: string | null;
    }>,
  ) {
    const [updated] = await this.db
      .update(students)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(students.id, id))
      .returning();
    return updated ?? null;
  }
}
