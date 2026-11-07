import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, ilike, or, SQL, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../../database/database.module';
import {
  assistantMonthlyRecords,
  assistants,
  teacherMonthlyRecords,
  teachers,
} from '../../../database/schemas';
import { createPaginatedResult } from '../../../common/utils/pagination.util';
import { ReportQueryDto } from '../dto/report-query.dto';
import { NormalizedReportPagination, ReportSummaryKpi } from '../reports.types';
import { ASSISTANT_METHOD_AR } from '../utils/report-labels.util';

@Injectable()
export class StaffStatementsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async getTeacherStatementReport(
    query: ReportQueryDto,
    yearMonth: string,
    pg: NormalizedReportPagination,
  ) {
    const conds: SQL[] = [];
    if (query.teacherId) conds.push(eq(teachers.id, query.teacherId));
    if (query.groupId) {
      conds.push(
        sql`EXISTS (SELECT 1 FROM groups g WHERE g.primary_teacher_id = ${teachers.id} AND g.id = ${query.groupId})`,
      );
    }
    if (query.search) {
      const p = `%${query.search}%`;
      conds.push(
        or(
          ilike(teachers.fullName, p),
          ilike(teachers.teacherCode, p),
          ilike(teachers.specialization, p),
        )!,
      );
    }
    const whereClause = conds.length > 0 ? and(...conds) : undefined;

    const dueExpr = sql`COALESCE(${teacherMonthlyRecords.totalDues}, (
      SELECT COALESCE(SUM(td.teacher_amount), 0) FROM teacher_dues td
      WHERE td.teacher_id = ${teachers.id} AND td.year_month = ${yearMonth}
    ))`;
    const paidExpr = sql`COALESCE(${teacherMonthlyRecords.totalPaidOut}, (
      SELECT COALESCE(SUM(tp.amount), 0) FROM teacher_payouts tp
      WHERE tp.teacher_id = ${teachers.id} AND tp.year_month = ${yearMonth}
    ))`;

    const [rows, [kpi]] = await Promise.all([
      this.db
        .select({
          id: teachers.id,
          teacherCode: teachers.teacherCode,
          teacherName: teachers.fullName,
          specialization: teachers.specialization,
          groupsCount: sql<number>`COALESCE(${teacherMonthlyRecords.groupsCount}, (
            SELECT COUNT(*)::int FROM groups g WHERE g.primary_teacher_id = ${teachers.id} AND g.is_active = true
          ))`,
          executedSessionsCount: sql<number>`COALESCE(${teacherMonthlyRecords.executedSessionsCount}, (
            SELECT COUNT(*)::int FROM sessions s WHERE s.teacher_id = ${teachers.id} AND s.year_month = ${yearMonth} AND s.status = 'COMPLETED'
          ))`,
          totalDues: sql<string>`(${dueExpr})::text`,
          totalPaidOut: sql<string>`(${paidExpr})::text`,
        })
        .from(teachers)
        .leftJoin(
          teacherMonthlyRecords,
          and(
            eq(teacherMonthlyRecords.teacherId, teachers.id),
            eq(teacherMonthlyRecords.yearMonth, yearMonth),
          ),
        )
        .where(whereClause)
        .orderBy(asc(teachers.teacherCode))
        .limit(pg.limit)
        .offset(pg.offset),
      this.db
        .select({
          totalCount: sql<number>`COUNT(*)::int`,
          duesSum: sql<string>`COALESCE(SUM(${dueExpr}), 0)::text`,
          paidSum: sql<string>`COALESCE(SUM(${paidExpr}), 0)::text`,
        })
        .from(teachers)
        .leftJoin(
          teacherMonthlyRecords,
          and(
            eq(teacherMonthlyRecords.teacherId, teachers.id),
            eq(teacherMonthlyRecords.yearMonth, yearMonth),
          ),
        )
        .where(whereClause),
    ]);

    const mapped = rows.map((r) => {
      const dues = Number(r.totalDues);
      const paid = Number(r.totalPaidOut);
      return {
        ...r,
        yearMonth,
        totalDues: dues,
        totalPaidOut: paid,
        remainingBalance: Number((dues - paid).toFixed(2)),
      };
    });

    const duesSum = Number(kpi?.duesSum ?? 0);
    const paidSum = Number(kpi?.paidSum ?? 0);
    const summary: ReportSummaryKpi[] = [
      { key: 'teachers', label: 'عدد المدرسين', value: Number(kpi?.totalCount ?? 0), tone: 'purple' },
      { key: 'dues', label: 'إجمالي المستحقات', value: duesSum, format: 'currency', tone: 'primary' },
      { key: 'paid', label: 'إجمالي المنصرف', value: paidSum, format: 'currency', tone: 'success' },
      { key: 'rem', label: 'المتبقي للمدرسين', value: Number((duesSum - paidSum).toFixed(2)), format: 'currency', tone: 'warning' },
    ];
    return { ...createPaginatedResult(mapped, Number(kpi?.totalCount ?? 0), pg.page, pg.limit), summary };
  }

  async getAssistantStatementReport(
    query: ReportQueryDto,
    yearMonth: string,
    pg: NormalizedReportPagination,
  ) {
    const conds: SQL[] = [];
    if (query.search) {
      const p = `%${query.search}%`;
      conds.push(or(ilike(assistants.fullName, p), ilike(assistants.assistantCode, p))!);
    }
    const whereClause = conds.length > 0 ? and(...conds) : undefined;

    const dueExpr = sql`COALESCE(${assistantMonthlyRecords.totalDues}, (
      SELECT COALESCE(SUM(ad.amount), 0) FROM assistant_dues ad
      WHERE ad.assistant_id = ${assistants.id} AND ad.year_month = ${yearMonth}
    ))`;
    const paidExpr = sql`COALESCE(${assistantMonthlyRecords.totalPaidOut}, (
      SELECT COALESCE(SUM(ap.amount), 0) FROM assistant_payouts ap
      WHERE ap.assistant_id = ${assistants.id} AND ap.year_month = ${yearMonth}
    ))`;

    const [rows, [kpi]] = await Promise.all([
      this.db
        .select({
          id: assistants.id,
          assistantCode: assistants.assistantCode,
          assistantName: assistants.fullName,
          calculationMethod: sql<string>`COALESCE(${assistantMonthlyRecords.calculationMethodSnapshot}, ${assistants.calculationMethod})`,
          totalDues: sql<string>`(${dueExpr})::text`,
          totalPaidOut: sql<string>`(${paidExpr})::text`,
        })
        .from(assistants)
        .leftJoin(
          assistantMonthlyRecords,
          and(
            eq(assistantMonthlyRecords.assistantId, assistants.id),
            eq(assistantMonthlyRecords.yearMonth, yearMonth),
          ),
        )
        .where(whereClause)
        .orderBy(asc(assistants.assistantCode))
        .limit(pg.limit)
        .offset(pg.offset),
      this.db
        .select({
          totalCount: sql<number>`COUNT(*)::int`,
          duesSum: sql<string>`COALESCE(SUM(${dueExpr}), 0)::text`,
          paidSum: sql<string>`COALESCE(SUM(${paidExpr}), 0)::text`,
        })
        .from(assistants)
        .leftJoin(
          assistantMonthlyRecords,
          and(
            eq(assistantMonthlyRecords.assistantId, assistants.id),
            eq(assistantMonthlyRecords.yearMonth, yearMonth),
          ),
        )
        .where(whereClause),
    ]);

    const mapped = rows.map((r) => {
      const dues = Number(r.totalDues);
      const paid = Number(r.totalPaidOut);
      return {
        ...r,
        yearMonth,
        calculationMethodAr: ASSISTANT_METHOD_AR[r.calculationMethod] || r.calculationMethod,
        totalDues: dues,
        totalPaidOut: paid,
        remainingBalance: Number((dues - paid).toFixed(2)),
      };
    });

    const duesSum = Number(kpi?.duesSum ?? 0);
    const paidSum = Number(kpi?.paidSum ?? 0);
    const summary: ReportSummaryKpi[] = [
      { key: 'assistants', label: 'عدد المساعدين', value: Number(kpi?.totalCount ?? 0), tone: 'purple' },
      { key: 'dues', label: 'إجمالي المستحقات', value: duesSum, format: 'currency', tone: 'primary' },
      { key: 'paid', label: 'إجمالي المنصرف', value: paidSum, format: 'currency', tone: 'success' },
      { key: 'rem', label: 'المتبقي للمساعدين', value: Number((duesSum - paidSum).toFixed(2)), format: 'currency', tone: 'warning' },
    ];
    return { ...createPaginatedResult(mapped, Number(kpi?.totalCount ?? 0), pg.page, pg.limit), summary };
  }
}
