import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, or, sql, SQL } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import { groups, groupTeachers, teacherAvailability, teachers } from '../../database/schemas';
import { normalizePagination } from '../../common/utils/pagination.util';
import { TeacherAvailabilitySlotDto, TeacherQueryDto } from './dto/teacher.dto';

function mapTeacherRow<T extends { canApproveBookings: string | boolean }>(
  row: T,
): Omit<T, 'canApproveBookings'> & { canApproveBookings: boolean } {
  return {
    ...row,
    canApproveBookings: row.canApproveBookings === true || row.canApproveBookings === 'true',
  };
}

@Injectable()
export class TeachersRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async findPaginated(query: TeacherQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
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

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const assignedGroupsCountSq = sql<number>`(
      SELECT COUNT(DISTINCT g.id)::int
      FROM ${groups} g
      LEFT JOIN ${groupTeachers} gt ON gt.group_id = g.id
      WHERE (g.primary_teacher_id = "teachers"."id" OR gt.teacher_id = "teachers"."id")
        AND g.is_active = true
    )`.as('assigned_groups_count');

    const [rawRows, [{ total }]] = await Promise.all([
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
          canApproveBookings: teachers.canApproveBookings,
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
      rows: rawRows.map(mapTeacherRow),
      total: Number(total),
      page,
      limit,
    };
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(teachers).where(eq(teachers.id, id)).limit(1);
    return row ? mapTeacherRow(row) : null;
  }

  async findByUserId(userId: string) {
    const [row] = await this.db.select().from(teachers).where(eq(teachers.userId, userId)).limit(1);
    return row ? mapTeacherRow(row) : null;
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
    canApproveBookings: boolean;
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
        canApproveBookings: data.canApproveBookings ? 'true' : 'false',
        notes: data.notes ?? null,
      })
      .returning();
    return mapTeacherRow(created);
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
      canApproveBookings: string;
      notes: string | null;
    }>,
  ) {
    const [updated] = await this.db
      .update(teachers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(teachers.id, id))
      .returning();
    return updated ? mapTeacherRow(updated) : null;
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
