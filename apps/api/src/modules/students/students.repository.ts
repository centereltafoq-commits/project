import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, inArray, or, sql, SQL } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import { enrollments, gradeLevels, students } from '../../database/schemas';
import { normalizePagination } from '../../common/utils/pagination.util';
import { StudentQueryDto } from './dto/student.dto';
import { StudentExportQueryDto } from './dto/student-excel.dto';

@Injectable()
export class StudentsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  private buildWhereClause(query: Pick<StudentQueryDto, 'status' | 'gradeLevel' | 'search'>) {
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

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private getActiveGroupsCountSubquery() {
    return sql<number>`(
      SELECT COUNT(*)::int
      FROM ${enrollments} e
      WHERE e.student_id = "students"."id" AND e.status = 'ACTIVE'
    )`.as('active_groups_count');
  }

  async findPaginated(query: StudentQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const whereClause = this.buildWhereClause(query);
    const activeGroupsCountSq = this.getActiveGroupsCountSubquery();

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

  async findAllForExport(query: StudentExportQueryDto) {
    const whereClause = this.buildWhereClause(query);
    const activeGroupsCountSq = this.getActiveGroupsCountSubquery();

    return this.db
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
      })
      .from(students)
      .where(whereClause)
      .orderBy(desc(students.createdAt))
      .limit(10_000);
  }

  async findActiveGradeLevelNames(): Promise<string[]> {
    const rows = await this.db
      .select({ name: gradeLevels.name })
      .from(gradeLevels)
      .where(eq(gradeLevels.isActive, true))
      .orderBy(asc(gradeLevels.orderIndex), asc(gradeLevels.name));
    return rows.map((r) => r.name);
  }

  async findAllGradeLevelRecords(): Promise<Array<{ name: string; isActive: boolean }>> {
    return this.db
      .select({ name: gradeLevels.name, isActive: gradeLevels.isActive })
      .from(gradeLevels)
      .orderBy(asc(gradeLevels.orderIndex), asc(gradeLevels.name));
  }

  async findExistingCodesAndNamePhones(
    codes: string[],
    phones: string[],
  ): Promise<{ existingCodes: Set<string>; existingNamePhones: Set<string> }> {
    const uniqueCodes = Array.from(new Set(codes.filter(Boolean)));
    const uniquePhones = Array.from(new Set(phones.filter(Boolean)));

    const [codeRows, phoneRows] = await Promise.all([
      uniqueCodes.length > 0
        ? this.db
            .select({ studentCode: students.studentCode })
            .from(students)
            .where(inArray(students.studentCode, uniqueCodes))
        : Promise.resolve([]),
      uniquePhones.length > 0
        ? this.db
            .select({ fullName: students.fullName, phone: students.phone })
            .from(students)
            .where(inArray(students.phone, uniquePhones))
        : Promise.resolve([]),
    ]);

    const existingCodes = new Set(codeRows.map((row) => row.studentCode.trim().toUpperCase()));
    const existingNamePhones = new Set(
      phoneRows.map((row) => `${row.fullName.trim().toLowerCase()}|${row.phone.trim()}`),
    );

    return { existingCodes, existingNamePhones };
  }

  async createManyTx(
    rows: Array<{
      studentCode: string;
      fullName: string;
      phone: string;
      guardianPhone: string | null;
      gradeLevel: string;
      registrationDate: string;
      status: string;
      notes: string | null;
    }>,
  ) {
    if (rows.length === 0) {
      return [];
    }

    return this.db.transaction(async (tx) => {
      const inserted: Array<typeof students.$inferSelect> = [];
      const chunkSize = 500;
      for (let idx = 0; idx < rows.length; idx += chunkSize) {
        const chunk = rows.slice(idx, idx + chunkSize);
        const result = await tx.insert(students).values(chunk).returning();
        inserted.push(...result);
      }
      return inserted;
    });
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
    guardianPhone: string | null;
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
        guardianPhone: data.guardianPhone ?? null,
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
      guardianPhone: string | null;
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
