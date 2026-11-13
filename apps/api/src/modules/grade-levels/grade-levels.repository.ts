import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import { gradeLevels, groups, students } from '../../database/schemas';
import { CreateGradeLevelDto, UpdateGradeLevelDto } from './dto/grade-level.dto';

@Injectable()
export class GradeLevelsRepository {
  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: DrizzleDatabase,
  ) {}

  async findAll(activeOnly?: boolean) {
    const conditions = [];
    if (activeOnly) {
      conditions.push(eq(gradeLevels.isActive, true));
    }

    return this.db
      .select()
      .from(gradeLevels)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(gradeLevels.orderIndex), asc(gradeLevels.name));
  }

  async findById(id: string) {
    const rows = await this.db
      .select()
      .from(gradeLevels)
      .where(eq(gradeLevels.id, id))
      .limit(1);
    return rows[0] || null;
  }

  async findByName(name: string) {
    const rows = await this.db
      .select()
      .from(gradeLevels)
      .where(sql`LOWER(TRIM(${gradeLevels.name})) = LOWER(TRIM(${name}))`)
      .limit(1);
    return rows[0] || null;
  }

  async findByCode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return null;
    const rows = await this.db
      .select()
      .from(gradeLevels)
      .where(sql`LOWER(TRIM(${gradeLevels.code})) = LOWER(${trimmed})`)
      .limit(1);
    return rows[0] || null;
  }

  async create(dto: CreateGradeLevelDto) {
    const rows = await this.db
      .insert(gradeLevels)
      .values({
        name: dto.name.trim(),
        code: dto.code?.trim() || null,
        orderIndex: dto.orderIndex ?? 0,
        isActive: dto.isActive ?? true,
      })
      .returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateGradeLevelDto, previousName?: string) {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    const nextName = dto.name !== undefined ? dto.name.trim() : undefined;
    if (nextName !== undefined) updateData.name = nextName;
    if (dto.code !== undefined) updateData.code = dto.code.trim() || null;
    if (dto.orderIndex !== undefined) updateData.orderIndex = dto.orderIndex;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    return this.db.transaction(async (tx) => {
      const rows = await tx
        .update(gradeLevels)
        .set(updateData)
        .where(eq(gradeLevels.id, id))
        .returning();
      const updated = rows[0] || null;

      if (updated && nextName && previousName && nextName !== previousName) {
        await tx
          .update(students)
          .set({ gradeLevel: nextName, updatedAt: new Date() })
          .where(eq(students.gradeLevel, previousName));
        await tx
          .update(groups)
          .set({ gradeLevel: nextName, updatedAt: new Date() })
          .where(eq(groups.gradeLevel, previousName));
      }

      return updated;
    });
  }

  async delete(id: string) {
    const rows = await this.db
      .delete(gradeLevels)
      .where(eq(gradeLevels.id, id))
      .returning();
    return rows[0] || null;
  }

  async countUsage(name: string): Promise<{ studentsCount: number; groupsCount: number }> {
    const [studentsResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(students)
      .where(eq(students.gradeLevel, name));

    const [groupsResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(groups)
      .where(eq(groups.gradeLevel, name));

    return {
      studentsCount: studentsResult?.count || 0,
      groupsCount: groupsResult?.count || 0,
    };
  }
}
