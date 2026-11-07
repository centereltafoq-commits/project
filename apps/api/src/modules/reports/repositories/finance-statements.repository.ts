import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, ilike, or, SQL, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../../database/database.module';
import {
  groups,
  studentMonthlyRecords,
  students,
  teacherDues,
  teachers,
} from '../../../database/schemas';
import { createPaginatedResult } from '../../../common/utils/pagination.util';
import { ReportQueryDto } from '../dto/report-query.dto';
import { NormalizedReportPagination, ReportSummaryKpi } from '../reports.types';

@Injectable()
export class FinanceStatementsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async getStudentStatementReport(
    query: ReportQueryDto,
    yearMonth: string,
    pg: NormalizedReportPagination,
  ) {
    const conds: SQL[] = [eq(studentMonthlyRecords.yearMonth, yearMonth)];
    if (query.groupId) conds.push(eq(studentMonthlyRecords.groupId, query.groupId));
    if (query.studentId) conds.push(eq(studentMonthlyRecords.studentId, query.studentId));
    if (query.teacherId) conds.push(eq(groups.primaryTeacherId, query.teacherId));
    if (query.search) {
      const p = `%${query.search}%`;
      conds.push(
        or(ilike(students.fullName, p), ilike(students.studentCode, p), ilike(groups.name, p))!,
      );
    }
    const whereClause = and(...conds);

    const [rows, [kpi]] = await Promise.all([
      this.db
        .select({
          id: studentMonthlyRecords.id,
          studentCode: students.studentCode,
          studentName: students.fullName,
          groupName: groups.name,
          yearMonth: studentMonthlyRecords.yearMonth,
          presentCount: studentMonthlyRecords.presentCount,
          absentCount: studentMonthlyRecords.absentCount,
          totalDue: studentMonthlyRecords.totalDue,
          totalPaid: studentMonthlyRecords.totalPaid,
          remainingBalance: studentMonthlyRecords.remainingBalance,
          isClosed: studentMonthlyRecords.isClosed,
        })
        .from(studentMonthlyRecords)
        .innerJoin(students, eq(studentMonthlyRecords.studentId, students.id))
        .innerJoin(groups, eq(studentMonthlyRecords.groupId, groups.id))
        .where(whereClause)
        .orderBy(asc(students.studentCode), asc(groups.name))
        .limit(pg.limit)
        .offset(pg.offset),
      this.db
        .select({
          totalCount: sql<number>`COUNT(*)::int`,
          dueSum: sql<string>`COALESCE(SUM(${studentMonthlyRecords.totalDue}), 0)::text`,
          paidSum: sql<string>`COALESCE(SUM(${studentMonthlyRecords.totalPaid}), 0)::text`,
          remSum: sql<string>`COALESCE(SUM(${studentMonthlyRecords.remainingBalance}), 0)::text`,
        })
        .from(studentMonthlyRecords)
        .innerJoin(students, eq(studentMonthlyRecords.studentId, students.id))
        .innerJoin(groups, eq(studentMonthlyRecords.groupId, groups.id))
        .where(whereClause),
    ]);

    const mapped = rows.map((r) => ({
      ...r,
      totalDue: Number(r.totalDue),
      totalPaid: Number(r.totalPaid),
      remainingBalance: Number(r.remainingBalance),
    }));

    const summary: ReportSummaryKpi[] = [
      { key: 'due', label: 'إجمالي المستحق', value: Number(kpi?.dueSum ?? 0), format: 'currency', tone: 'primary' },
      { key: 'paid', label: 'إجمالي المدفوع', value: Number(kpi?.paidSum ?? 0), format: 'currency', tone: 'success' },
      { key: 'rem', label: 'إجمالي المتبقي', value: Number(kpi?.remSum ?? 0), format: 'currency', tone: 'danger' },
      { key: 'count', label: 'عدد حسابات الطلاب', value: Number(kpi?.totalCount ?? 0), tone: 'purple' },
    ];
    return { ...createPaginatedResult(mapped, Number(kpi?.totalCount ?? 0), pg.page, pg.limit), summary };
  }

  async getGroupsRevenueReport(
    query: ReportQueryDto,
    yearMonth: string,
    pg: NormalizedReportPagination,
  ) {
    const conds: SQL[] = [];
    if (query.groupId) conds.push(eq(groups.id, query.groupId));
    if (query.teacherId) conds.push(eq(groups.primaryTeacherId, query.teacherId));
    if (query.search) {
      const p = `%${query.search}%`;
      conds.push(
        or(ilike(groups.groupCode, p), ilike(groups.name, p), ilike(teachers.fullName, p))!,
      );
    }
    const whereClause = conds.length > 0 ? and(...conds) : undefined;

    const [rows, [kpi]] = await Promise.all([
      this.db
        .select({
          id: groups.id,
          groupCode: groups.groupCode,
          groupName: groups.name,
          subject: groups.subject,
          gradeLevel: groups.gradeLevel,
          teacherName: teachers.fullName,
          studentsCount: sql<number>`COALESCE(${teacherDues.studentsCount}, (
            SELECT COUNT(*)::int FROM enrollments e WHERE e.group_id = ${groups.id} AND e.status = 'ACTIVE'
          ))`,
          grossRevenue: sql<string>`COALESCE(${teacherDues.grossGroupRevenue}, (
            SELECT COALESCE(SUM(smr.total_due), 0) FROM student_monthly_records smr
            WHERE smr.group_id = ${groups.id} AND smr.year_month = ${yearMonth}
          ))::text`,
          teacherShare: sql<string>`COALESCE(${teacherDues.teacherAmount}, 0)::text`,
          centerShare: sql<string>`COALESCE(${teacherDues.centerAmount}, 0)::text`,
        })
        .from(groups)
        .innerJoin(teachers, eq(groups.primaryTeacherId, teachers.id))
        .leftJoin(
          teacherDues,
          and(
            eq(teacherDues.groupId, groups.id),
            eq(teacherDues.teacherId, groups.primaryTeacherId),
            eq(teacherDues.yearMonth, yearMonth),
          ),
        )
        .where(whereClause)
        .orderBy(asc(groups.groupCode))
        .limit(pg.limit)
        .offset(pg.offset),
      this.db
        .select({
          totalCount: sql<number>`COUNT(*)::int`,
          grossSum: sql<string>`COALESCE(SUM(COALESCE(${teacherDues.grossGroupRevenue}, (
            SELECT COALESCE(SUM(smr.total_due), 0) FROM student_monthly_records smr
            WHERE smr.group_id = ${groups.id} AND smr.year_month = ${yearMonth}
          ))), 0)::text`,
          teacherSum: sql<string>`COALESCE(SUM(COALESCE(${teacherDues.teacherAmount}, 0)), 0)::text`,
          centerSum: sql<string>`COALESCE(SUM(COALESCE(${teacherDues.centerAmount}, 0)), 0)::text`,
        })
        .from(groups)
        .innerJoin(teachers, eq(groups.primaryTeacherId, teachers.id))
        .leftJoin(
          teacherDues,
          and(
            eq(teacherDues.groupId, groups.id),
            eq(teacherDues.teacherId, groups.primaryTeacherId),
            eq(teacherDues.yearMonth, yearMonth),
          ),
        )
        .where(whereClause),
    ]);

    const mapped = rows.map((r) => ({
      ...r,
      grossRevenue: Number(r.grossRevenue),
      teacherShare: Number(r.teacherShare),
      centerShare: Number(r.centerShare),
    }));

    const summary: ReportSummaryKpi[] = [
      { key: 'groups', label: 'عدد المجموعات', value: Number(kpi?.totalCount ?? 0), tone: 'purple' },
      { key: 'gross', label: 'إجمالي المستحق', value: Number(kpi?.grossSum ?? 0), format: 'currency', tone: 'primary' },
      { key: 'teacher', label: 'إجمالي نصيب المدرسين', value: Number(kpi?.teacherSum ?? 0), format: 'currency', tone: 'warning' },
      { key: 'center', label: 'إجمالي نصيب السنتر', value: Number(kpi?.centerSum ?? 0), format: 'currency', tone: 'success' },
    ];
    return { ...createPaginatedResult(mapped, Number(kpi?.totalCount ?? 0), pg.page, pg.limit), summary };
  }
}
