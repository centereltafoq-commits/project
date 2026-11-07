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
      .where(eq(gradeLevels.name, name))
      .limit(1);
    return rows[0] || null;
  }

  async create(dto: CreateGradeLevelDto) {
    const rows = await this.db
      .insert(gradeLevels)
      .values({
        name: dto.name,
        code: dto.code || null,
        orderIndex: dto.orderIndex ?? 0,
        isActive: dto.isActive ?? true,
      })
      .returning();
    return rows[0];
  }

  async update(id: string, dto: UpdateGradeLevelDto) {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.code !== undefined) updateData.code = dto.code;
    if (dto.orderIndex !== undefined) updateData.orderIndex = dto.orderIndex;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    const rows = await this.db
      .update(gradeLevels)
      .set(updateData)
      .where(eq(gradeLevels.id, id))
      .returning();
    return rows[0] || null;
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
