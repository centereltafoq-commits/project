import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, inArray, or, sql, SQL } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import { groups, groupTeachers, teacherAvailability, teachers } from '../../database/schemas';
import { normalizePagination } from '../../common/utils/pagination.util';
import { TeacherAvailabilitySlotDto, TeacherQueryDto } from './dto/teacher.dto';
import { TeacherExportQueryDto } from './dto/teacher-excel.dto';

@Injectable()
export class TeachersRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  private buildWhereClause(
    query: Pick<TeacherQueryDto, 'employmentStatus' | 'specialization' | 'search'>,
  ) {
    const conditions: SQL[] = [];

    if (query.employmentStatus) {
      conditions.push(eq(teachers.employmentStatus, query.employmentStatus));
    }
    if (query.specialization) {
      conditions.push(ilike(teachers.specialization, `%${query.specialization.trim()}%`));
    }
    if (query.search) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(teachers.fullName, pattern),
          ilike(teachers.teacherCode, pattern),
          ilike(teachers.phone, pattern),
          ilike(teachers.specialization, pattern),
        )!,
      );
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private getAssignedGroupsCountSubquery() {
    return sql<number>`(
      SELECT COUNT(DISTINCT g.id)::int
      FROM ${groups} g
      LEFT JOIN ${groupTeachers} gt ON gt.group_id = g.id
      WHERE (g.primary_teacher_id = "teachers"."id" OR gt.teacher_id = "teachers"."id")
        AND g.is_active = true
    )`.as('assigned_groups_count');
  }

  async findPaginated(query: TeacherQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const whereClause = this.buildWhereClause(query);
    const assignedGroupsCountSq = this.getAssignedGroupsCountSubquery();

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: teachers.id,
          teacherCode: teachers.teacherCode,
          userId: teachers.userId,
          fullName: teachers.fullName,
          phone: teachers.phone,
          specialization: teachers.specialization,
          contractDate: teachers.contractDate,
          employmentStatus: teachers.employmentStatus,
          notes: teachers.notes,
          assignedGroupsCount: assignedGroupsCountSq,
          createdAt: teachers.createdAt,
          updatedAt: teachers.updatedAt,
        })
        .from(teachers)
        .where(whereClause)
        .orderBy(desc(teachers.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(teachers).where(whereClause),
    ]);

    return {
      rows,
      total: Number(total),
      page,
      limit,
    };
  }

  async findAllForExport(query: TeacherExportQueryDto) {
    const whereClause = this.buildWhereClause(query);
    const assignedGroupsCountSq = this.getAssignedGroupsCountSubquery();

    return this.db
      .select({
        id: teachers.id,
        teacherCode: teachers.teacherCode,
        fullName: teachers.fullName,
        phone: teachers.phone,
        specialization: teachers.specialization,
        contractDate: teachers.contractDate,
        employmentStatus: teachers.employmentStatus,
        notes: teachers.notes,
        assignedGroupsCount: assignedGroupsCountSq,
      })
      .from(teachers)
      .where(whereClause)
      .orderBy(desc(teachers.createdAt))
      .limit(10_000);
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
            .select({ teacherCode: teachers.teacherCode })
            .from(teachers)
            .where(inArray(teachers.teacherCode, uniqueCodes))
        : Promise.resolve([]),
      uniquePhones.length > 0
        ? this.db
            .select({ fullName: teachers.fullName, phone: teachers.phone })
            .from(teachers)
            .where(inArray(teachers.phone, uniquePhones))
        : Promise.resolve([]),
    ]);

    const existingCodes = new Set(codeRows.map((row) => row.teacherCode.trim().toUpperCase()));
    const existingNamePhones = new Set(
      phoneRows.map((row) => `${row.fullName.trim().toLowerCase()}|${row.phone.trim()}`),
    );

    return { existingCodes, existingNamePhones };
  }

  async createManyTx(
    rows: Array<{
      teacherCode: string;
      fullName: string;
      phone: string;
      specialization: string;
      contractDate: string;
      employmentStatus: string;
      notes: string | null;
    }>,
  ) {
    if (rows.length === 0) {
      return [];
    }

    return this.db.transaction(async (tx) => {
      const inserted: Array<typeof teachers.$inferSelect> = [];
      const chunkSize = 500;
      for (let idx = 0; idx < rows.length; idx += chunkSize) {
        const chunk = rows.slice(idx, idx + chunkSize);
        const result = await tx
          .insert(teachers)
          .values(
            chunk.map((item) => ({
              teacherCode: item.teacherCode,
              userId: null,
              fullName: item.fullName,
              phone: item.phone,
              specialization: item.specialization,
              contractDate: item.contractDate,
              employmentStatus: item.employmentStatus,
              notes: item.notes,
            })),
          )
          .returning();
        inserted.push(...result);
      }
      return inserted;
    });
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(teachers).where(eq(teachers.id, id)).limit(1);
    return row ?? null;
  }

  async findByUserId(userId: string) {
    const [row] = await this.db.select().from(teachers).where(eq(teachers.userId, userId)).limit(1);
    return row ?? null;
  }

  async findByCode(teacherCode: string) {
    const [row] = await this.db
      .select({ id: teachers.id })
      .from(teachers)
      .where(eq(teachers.teacherCode, teacherCode))
      .limit(1);
    return row ?? null;
  }

  async create(data: {
    teacherCode: string;
    userId?: string | null;
    fullName: string;
    phone: string;
    specialization: string;
    contractDate: string;
    employmentStatus: string;
    notes?: string | null;
  }) {
    const [created] = await this.db
      .insert(teachers)
      .values({
        teacherCode: data.teacherCode,
        userId: data.userId ?? null,
        fullName: data.fullName,
        phone: data.phone,
        specialization: data.specialization,
        contractDate: data.contractDate,
        employmentStatus: data.employmentStatus,
        notes: data.notes ?? null,
      })
      .returning();
    return created;
  }

  async update(
    id: string,
    updates: Partial<{
      userId: string | null;
      fullName: string;
      phone: string;
      specialization: string;
      contractDate: string;
      employmentStatus: string;
      notes: string | null;
    }>,
  ) {
    const [updated] = await this.db
      .update(teachers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(teachers.id, id))
      .returning();
    return updated ?? null;
  }

  async replaceAvailability(teacherId: string, slots: TeacherAvailabilitySlotDto[]) {
    return this.db.transaction(async (tx) => {
      await tx.delete(teacherAvailability).where(eq(teacherAvailability.teacherId, teacherId));
      if (slots.length > 0) {
        await tx.insert(teacherAvailability).values(
          slots.map((s) => ({
            teacherId,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            isActive: s.isActive ?? true,
          })),
        );
      }
      return tx
        .select()
        .from(teacherAvailability)
        .where(eq(teacherAvailability.teacherId, teacherId))
        .orderBy(asc(teacherAvailability.dayOfWeek), asc(teacherAvailability.startTime));
    });
  }
}
