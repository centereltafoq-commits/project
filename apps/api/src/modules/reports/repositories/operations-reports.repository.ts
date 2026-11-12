import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, ilike, or, SQL, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../../database/database.module';
import {
  bookingRequests,
  classrooms,
  students,
  teachers,
} from '../../../database/schemas';
import { createPaginatedResult } from '../../../common/utils/pagination.util';
import { ReportQueryDto } from '../dto/report-query.dto';
import { NormalizedReportPagination, ReportSummaryKpi } from '../reports.types';
import {
  BOOKING_STATUS_AR,
  BOOKING_TYPE_AR,
  CLASSROOM_STATUS_AR,
} from '../utils/report-labels.util';

@Injectable()
export class OperationsReportsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async getBookingsReport(query: ReportQueryDto, yearMonth: string, pg: NormalizedReportPagination) {
    const conds: SQL[] = [];
    if (query.yearMonth) {
      conds.push(sql`TO_CHAR(${bookingRequests.requestedDate}, 'YYYY-MM') = ${yearMonth}`);
    }
    if (query.teacherId) conds.push(eq(bookingRequests.teacherId, query.teacherId));
    if (query.studentId) conds.push(eq(bookingRequests.studentId, query.studentId));
    if (query.status) conds.push(eq(bookingRequests.status, query.status));
    if (query.search) {
      const p = `%${query.search}%`;
      conds.push(
        or(
          ilike(bookingRequests.purpose, p),
          ilike(teachers.fullName, p),
          ilike(students.fullName, p),
        )!,
      );
    }
    const whereClause = conds.length > 0 ? and(...conds) : undefined;

    const [rows, [kpi]] = await Promise.all([
      this.db
        .select({
          id: bookingRequests.id,
          requestType: bookingRequests.requestType,
          studentName: students.fullName,
          teacherName: teachers.fullName,
          purpose: bookingRequests.purpose,
          requestedDate: bookingRequests.requestedDate,
          startTime: bookingRequests.startTime,
          endTime: bookingRequests.endTime,
          classroomName: classrooms.name,
          roomNumber: classrooms.roomNumber,
          status: bookingRequests.status,
        })
        .from(bookingRequests)
        .innerJoin(teachers, eq(bookingRequests.teacherId, teachers.id))
        .leftJoin(students, eq(bookingRequests.studentId, students.id))
        .leftJoin(
          classrooms,
          sql`${classrooms.id} = COALESCE(${bookingRequests.assignedClassroomId}, ${bookingRequests.requestedClassroomId})`,
        )
        .where(whereClause)
        .orderBy(desc(bookingRequests.requestedDate), asc(bookingRequests.startTime))
        .limit(pg.limit)
        .offset(pg.offset),
      this.db
        .select({
          total: sql<number>`COUNT(*)::int`,
          pending: sql<number>`COUNT(*) FILTER (WHERE ${bookingRequests.status} = 'PENDING')::int`,
          confirmed: sql<number>`COUNT(*) FILTER (WHERE ${bookingRequests.status} = 'CONFIRMED')::int`,
          completed: sql<number>`COUNT(*) FILTER (WHERE ${bookingRequests.status} = 'COMPLETED')::int`,
        })
        .from(bookingRequests)
        .innerJoin(teachers, eq(bookingRequests.teacherId, teachers.id))
        .leftJoin(students, eq(bookingRequests.studentId, students.id))
        .where(whereClause),
    ]);

    const mapped = rows.map((r) => ({
      ...r,
      requestTypeAr: BOOKING_TYPE_AR[r.requestType] || r.requestType,
      partyLabel: r.studentName ? `${r.studentName} / ${r.teacherName}` : r.teacherName,
      timeSlot: `${r.startTime} - ${r.endTime}`,
      classroomLabel: r.classroomName ? `${r.roomNumber} - ${r.classroomName}` : 'غير محدد',
      statusAr: BOOKING_STATUS_AR[r.status] || r.status,
    }));

    const summary: ReportSummaryKpi[] = [
      { key: 'total', label: 'إجمالي الحجوزات', value: Number(kpi?.total ?? 0), tone: 'primary' },
      { key: 'pending', label: 'بانتظار الاعتماد', value: Number(kpi?.pending ?? 0), tone: 'warning' },
      { key: 'confirmed', label: 'معتمدة', value: Number(kpi?.confirmed ?? 0), tone: 'success' },
      { key: 'completed', label: 'منفذة', value: Number(kpi?.completed ?? 0), tone: 'purple' },
    ];
    return { ...createPaginatedResult(mapped, Number(kpi?.total ?? 0), pg.page, pg.limit), summary };
  }

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
          sessionsCount: sql<number>`(
            SELECT COUNT(*)::int FROM sessions s
            WHERE s.classroom_id = classrooms.id
              AND s.status != 'CANCELLED'
              AND s.year_month = ${yearMonth}
          )`,
          confirmedBookingsCount: sql<number>`(
            SELECT COUNT(*)::int FROM booking_requests br
            WHERE COALESCE(br.assigned_classroom_id, br.requested_classroom_id) = classrooms.id
              AND br.status IN ('CONFIRMED', 'COMPLETED')
              AND TO_CHAR(br.requested_date, 'YYYY-MM') = ${yearMonth}
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
          totalSessions: sql<number>`(
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
