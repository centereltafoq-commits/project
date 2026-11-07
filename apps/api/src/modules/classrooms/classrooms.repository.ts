import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, gte, ilike, or, sql, SQL } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import { classroomMaintenances, classrooms } from '../../database/schemas';
import { normalizePagination } from '../../common/utils/pagination.util';
import { ClassroomQueryDto } from './dto/classroom.dto';

@Injectable()
export class ClassroomsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async findPaginated(query: ClassroomQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const conditions: SQL[] = [];

    if (query.status) {
      conditions.push(eq(classrooms.status, query.status));
    }
    if (query.minCapacity) {
      conditions.push(gte(classrooms.maxCapacity, query.minCapacity));
    }
    if (query.search) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(or(ilike(classrooms.roomNumber, pattern), ilike(classrooms.name, pattern))!);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const upcomingMaintSq = sql<number>`(
      SELECT COUNT(*)::int
      FROM ${classroomMaintenances} cm
      WHERE cm.classroom_id = "classrooms"."id" AND cm.end_at >= NOW()
    )`.as('upcoming_maintenances_count');

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: classrooms.id,
          roomNumber: classrooms.roomNumber,
          name: classrooms.name,
          maxCapacity: classrooms.maxCapacity,
          seatsCount: classrooms.seatsCount,
          equipment: classrooms.equipment,
          status: classrooms.status,
          notes: classrooms.notes,
          upcomingMaintenancesCount: upcomingMaintSq,
          createdAt: classrooms.createdAt,
          updatedAt: classrooms.updatedAt,
        })
        .from(classrooms)
        .where(whereClause)
        .orderBy(asc(classrooms.roomNumber))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(classrooms).where(whereClause),
    ]);

    return { rows, total: Number(total), page, limit };
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(classrooms).where(eq(classrooms.id, id)).limit(1);
    return row ?? null;
  }

  async findByRoomNumber(roomNumber: string) {
    const [row] = await this.db
      .select({ id: classrooms.id, roomNumber: classrooms.roomNumber })
      .from(classrooms)
      .where(eq(classrooms.roomNumber, roomNumber))
      .limit(1);
    return row ?? null;
  }

  async listMaintenances(classroomId: string) {
    return this.db
      .select()
      .from(classroomMaintenances)
      .where(eq(classroomMaintenances.classroomId, classroomId))
      .orderBy(desc(classroomMaintenances.startAt));
  }

  async create(data: {
    roomNumber: string;
    name: string;
    maxCapacity: number;
    seatsCount: number;
    equipment: string[];
    status: string;
    notes?: string | null;
  }) {
    const [created] = await this.db
      .insert(classrooms)
      .values({ ...data, notes: data.notes ?? null })
      .returning();
    return created;
  }

  async update(
    id: string,
    updates: Partial<{
      roomNumber: string;
      name: string;
      maxCapacity: number;
      seatsCount: number;
      equipment: string[];
      status: string;
      notes: string | null;
    }>,
  ) {
    const [updated] = await this.db
      .update(classrooms)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(classrooms.id, id))
      .returning();
    return updated ?? null;
  }

  async createMaintenance(classroomId: string, startAt: Date, endAt: Date, reason: string) {
    const [created] = await this.db
      .insert(classroomMaintenances)
      .values({ classroomId, startAt, endAt, reason })
      .returning();
    return created;
  }

  async deleteMaintenance(maintId: string) {
    const [deleted] = await this.db
      .delete(classroomMaintenances)
      .where(eq(classroomMaintenances.id, maintId))
      .returning();
    return deleted ?? null;
  }
}
