import { Inject, Injectable } from '@nestjs/common';
import { and, asc, ilike, or, SQL, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../../database/database.module';
import { classrooms } from '../../../database/schemas';
import { createPaginatedResult } from '../../../common/utils/pagination.util';
import { ReportQueryDto } from '../dto/report-query.dto';
import { NormalizedReportPagination, ReportSummaryKpi } from '../reports.types';
import { CLASSROOM_STATUS_AR } from '../utils/report-labels.util';

@Injectable()
export class OperationsReportsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async getClassroomsReport(query: ReportQueryDto, yearMonth: string, pg: NormalizedReportPagination) {
    const conds: SQL[] = [];
    if (query.search) {
      const p = `%${query.search}%`;
      conds.push(or(ilike(classrooms.roomNumber, p), ilike(classrooms.name, p))!);
    }
    const whereClause = conds.length > 0 ? and(...conds) : undefined;

    const [rows, [kpi]] = await Promise.all([
      this.db
        .select({
          id: classrooms.id,
          roomNumber: classrooms.roomNumber,
          name: classrooms.name,
          maxCapacity: classrooms.maxCapacity,
          seatsCount: classrooms.seatsCount,
          equipment: classrooms.equipment,
          status: classrooms.status,
          sessionsCount: query.date
            ? sql<number>`(
                SELECT COUNT(*)::int FROM sessions s
                WHERE s.classroom_id = classrooms.id
                  AND s.status != 'CANCELLED'
                  AND s.session_date = ${query.date}
              )`
            : sql<number>`(
                SELECT COUNT(*)::int FROM sessions s
                WHERE s.classroom_id = classrooms.id
                  AND s.status != 'CANCELLED'
                  AND s.year_month = ${yearMonth}
              )`,
        })
        .from(classrooms)
        .where(whereClause)
        .orderBy(asc(classrooms.roomNumber))
        .limit(pg.limit)
        .offset(pg.offset),
      this.db
        .select({
          totalRooms: sql<number>`COUNT(*)::int`,
          availableRooms: sql<number>`COUNT(*) FILTER (WHERE ${classrooms.status} = 'AVAILABLE')::int`,
          totalCapacity: sql<number>`COALESCE(SUM(${classrooms.maxCapacity}), 0)::int`,
          totalSessions: query.date
            ? sql<number>`(
                SELECT COUNT(*)::int FROM sessions s
                WHERE s.status != 'CANCELLED' AND s.session_date = ${query.date}
              )`
            : sql<number>`(
                SELECT COUNT(*)::int FROM sessions s
                WHERE s.status != 'CANCELLED' AND s.year_month = ${yearMonth}
              )`,
        })
        .from(classrooms)
        .where(whereClause),
    ]);

    const mapped = rows.map((r) => ({
      ...r,
      statusAr: CLASSROOM_STATUS_AR[r.status] || r.status,
    }));

    const summary: ReportSummaryKpi[] = [
      { key: 'totalRooms', label: 'إجمالي القاعات', value: Number(kpi?.totalRooms ?? 0), tone: 'primary' },
      { key: 'available', label: 'متاحة للتشغيل', value: Number(kpi?.availableRooms ?? 0), tone: 'success' },
      { key: 'capacity', label: 'السعة الإجمالية (مقعد)', value: Number(kpi?.totalCapacity ?? 0), tone: 'purple' },
      { key: 'sessions', label: 'حصص الشهر بالقاعات', value: Number(kpi?.totalSessions ?? 0), tone: 'warning' },
    ];
    return { ...createPaginatedResult(mapped, Number(kpi?.totalRooms ?? 0), pg.page, pg.limit), summary };
  }
}
