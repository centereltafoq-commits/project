import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, ilike, or, SQL, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../../database/database.module';
import {
  attendance,
  enrollments,
  groups,
  sessions,
  students,
  teachers,
} from '../../../database/schemas';
import { createPaginatedResult } from '../../../common/utils/pagination.util';
import { ReportQueryDto } from '../dto/report-query.dto';
import {
  NormalizedReportPagination,
  ReportFilterOptionsResponse,
  ReportSummaryKpi,
} from '../reports.types';
import { STUDENT_STATUS_AR } from '../utils/report-labels.util';

@Injectable()
export class AcademicReportsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async getFilterOptions(): Promise<ReportFilterOptionsResponse> {
    const [groupRows, teacherRows, studentRows] = await Promise.all([
      this.db
        .select({ id: groups.id, code: groups.groupCode, label: groups.name })
        .from(groups)
        .orderBy(asc(groups.name))
        .limit(200),
      this.db
        .select({ id: teachers.id, code: teachers.teacherCode, label: teachers.fullName })
        .from(teachers)
        .orderBy(asc(teachers.fullName))
        .limit(200),
      this.db
        .select({ id: students.id, code: students.studentCode, label: students.fullName })
        .from(students)
        .orderBy(asc(students.fullName))
        .limit(300),
    ]);
    return { groups: groupRows, teachers: teacherRows, students: studentRows };
  }

  async getStudentsReport(query: ReportQueryDto, pg: NormalizedReportPagination) {
    const conds: SQL[] = [];
    if (query.studentId) conds.push(eq(students.id, query.studentId));
    if (query.status) conds.push(eq(students.status, query.status));
    if (query.groupId) {
      conds.push(sql`EXISTS (
        SELECT 1 FROM ${enrollments} e
        WHERE e.student_id = ${students.id} AND e.group_id = ${query.groupId} AND e.status = 'ACTIVE'
      )`);
    }
    if (query.teacherId) {
      conds.push(sql`EXISTS (
        SELECT 1 FROM ${enrollments} e
        INNER JOIN ${groups} g ON g.id = e.group_id
        WHERE e.student_id = ${students.id} AND g.primary_teacher_id = ${query.teacherId} AND e.status = 'ACTIVE'
      )`);
    }
    if (query.search) {
      const p = `%${query.search}%`;
      conds.push(
        or(
          ilike(students.studentCode, p),
          ilike(students.fullName, p),
          ilike(students.phone, p),
          ilike(students.guardianPhone, p),
          ilike(students.gradeLevel, p),
        )!,
      );
    }
    const whereClause = conds.length > 0 ? and(...conds) : undefined;

    const [rows, [kpiRow], [enrollKpiRow]] = await Promise.all([
      this.db
        .select({
          id: students.id,
          studentCode: students.studentCode,
          fullName: students.fullName,
          phone: students.phone,
          guardianPhone: students.guardianPhone,
          gradeLevel: students.gradeLevel,
          status: students.status,
          registrationDate: students.registrationDate,
          activeGroupsCount: sql<number>`COUNT(DISTINCT ${enrollments.groupId})::int`,
        })
        .from(students)
        .leftJoin(
          enrollments,
          and(eq(enrollments.studentId, students.id), eq(enrollments.status, 'ACTIVE')),
        )
        .where(whereClause)
        .groupBy(students.id)
        .orderBy(asc(students.studentCode))
        .limit(pg.limit)
        .offset(pg.offset),
      this.db
        .select({
          total: sql<number>`COUNT(*)::int`,
          active: sql<number>`COUNT(*) FILTER (WHERE ${students.status} = 'ACTIVE')::int`,
          other: sql<number>`COUNT(*) FILTER (WHERE ${students.status} != 'ACTIVE')::int`,
        })
        .from(students)
        .where(whereClause),
      this.db
        .select({ enrollmentsCount: sql<number>`COUNT(*)::int` })
        .from(enrollments)
        .innerJoin(students, eq(enrollments.studentId, students.id))
        .where(and(eq(enrollments.status, 'ACTIVE'), ...(whereClause ? [whereClause] : []))),
    ]);

    const mapped = rows.map((r) => ({
      ...r,
      statusAr: STUDENT_STATUS_AR[r.status] || r.status,
    }));
    const summary: ReportSummaryKpi[] = [
      { key: 'total', label: 'إجمالي الطلاب', value: Number(kpiRow?.total ?? 0), tone: 'primary' },
      { key: 'active', label: 'الطلاب النشطون', value: Number(kpiRow?.active ?? 0), tone: 'success' },
      { key: 'other', label: 'موقوف / مؤرشف', value: Number(kpiRow?.other ?? 0), tone: 'warning' },
      { key: 'enrollments', label: 'إجمالي الاشتراكات النشطة', value: Number(enrollKpiRow?.enrollmentsCount ?? 0), tone: 'purple' },
    ];
    return { ...createPaginatedResult(mapped, Number(kpiRow?.total ?? 0), pg.page, pg.limit), summary };
  }

  async getAttendanceReport(
    query: ReportQueryDto,
    yearMonth: string,
    pg: NormalizedReportPagination,
  ) {
    const conds: SQL[] = [eq(sessions.yearMonth, yearMonth)];
    if (query.groupId) conds.push(eq(sessions.groupId, query.groupId));
    if (query.teacherId) conds.push(eq(groups.primaryTeacherId, query.teacherId));
    if (query.studentId) conds.push(eq(attendance.studentId, query.studentId));
    if (query.search) {
      const p = `%${query.search}%`;
      conds.push(or(ilike(students.fullName, p), ilike(students.studentCode, p), ilike(groups.name, p))!);
    }
    const whereClause = and(...conds);

    const [rows, [statsRow]] = await Promise.all([
      this.db
        .select({
          studentId: students.id,
          studentCode: students.studentCode,
          studentName: students.fullName,
          groupId: groups.id,
          groupName: groups.name,
          presentCount: sql<number>`COUNT(*) FILTER (WHERE ${attendance.status} = 'PRESENT')::int`,
          absentCount: sql<number>`COUNT(*) FILTER (WHERE ${attendance.status} = 'ABSENT')::int`,
          excusedCount: sql<number>`COUNT(*) FILTER (WHERE ${attendance.status} = 'EXCUSED')::int`,
          totalRecorded: sql<number>`COUNT(*)::int`,
        })
        .from(attendance)
        .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
        .innerJoin(students, eq(attendance.studentId, students.id))
        .innerJoin(groups, eq(sessions.groupId, groups.id))
        .where(whereClause)
        .groupBy(students.id, students.studentCode, students.fullName, groups.id, groups.name)
        .orderBy(asc(groups.name), asc(students.studentCode))
        .limit(pg.limit)
        .offset(pg.offset),
      this.db
        .select({
          distinctPairs: sql<number>`COUNT(DISTINCT (${attendance.studentId}::text || '-' || ${sessions.groupId}::text))::int`,
          present: sql<number>`COUNT(*) FILTER (WHERE ${attendance.status} = 'PRESENT')::int`,
          absent: sql<number>`COUNT(*) FILTER (WHERE ${attendance.status} = 'ABSENT')::int`,
          excused: sql<number>`COUNT(*) FILTER (WHERE ${attendance.status} = 'EXCUSED')::int`,
          total: sql<number>`COUNT(*)::int`,
        })
        .from(attendance)
        .innerJoin(sessions, eq(attendance.sessionId, sessions.id))
        .innerJoin(students, eq(attendance.studentId, students.id))
        .innerJoin(groups, eq(sessions.groupId, groups.id))
        .where(whereClause),
    ]);

    const mapped = rows.map((r) => {
      const attended = r.presentCount;
      const rate = r.totalRecorded > 0 ? Number(((attended / r.totalRecorded) * 100).toFixed(1)) : 0;
      return { id: `${r.studentId}-${r.groupId}`, ...r, attendanceRate: rate };
    });

    const overallTotal = Number(statsRow?.total ?? 0);
    const overallAttended = Number(statsRow?.present ?? 0);
    const overallRate = overallTotal > 0 ? Number(((overallAttended / overallTotal) * 100).toFixed(1)) : 0;

    const summary: ReportSummaryKpi[] = [
      { key: 'present', label: 'إجمالي الحضور', value: Number(statsRow?.present ?? 0), tone: 'success' },
      { key: 'absent', label: 'إجمالي الغياب', value: Number(statsRow?.absent ?? 0), tone: 'danger' },
      { key: 'excused', label: 'غياب بعذر', value: Number(statsRow?.excused ?? 0), tone: 'warning' },
      { key: 'rate', label: 'متوسط نسبة الحضور', value: overallRate, format: 'percent', tone: 'primary' },
    ];

    return {
      ...createPaginatedResult(mapped, Number(statsRow?.distinctPairs ?? 0), pg.page, pg.limit),
      summary,
    };
  }
}
