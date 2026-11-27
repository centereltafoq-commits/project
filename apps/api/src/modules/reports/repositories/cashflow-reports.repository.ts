import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ilike, or, SQL, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../../database/database.module';
import { expenses, payments, students, users } from '../../../database/schemas';
import { createPaginatedResult } from '../../../common/utils/pagination.util';
import { ReportQueryDto } from '../dto/report-query.dto';
import { NormalizedReportPagination, ReportSummaryKpi } from '../reports.types';
import { EXPENSE_CATEGORY_AR, PAYMENT_METHOD_AR } from '../utils/report-labels.util';

@Injectable()
export class CashflowReportsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async getCollectionsReport(
    query: ReportQueryDto,
    yearMonth: string,
    pg: NormalizedReportPagination,
  ) {
    const conds: SQL[] = [eq(payments.yearMonth, yearMonth)];
    if (query.date) {
      conds.push(eq(payments.paymentDate, query.date));
    }
    if (query.studentId) conds.push(eq(payments.studentId, query.studentId));
    if (query.groupId) {
      conds.push(sql`EXISTS (
        SELECT 1 FROM payment_allocations pa
        WHERE pa.payment_id = ${payments.id} AND pa.group_id = ${query.groupId}
      )`);
    }
    if (query.teacherId) {
      conds.push(sql`EXISTS (
        SELECT 1 FROM payment_allocations pa
        INNER JOIN groups g ON g.id = pa.group_id
        WHERE pa.payment_id = ${payments.id} AND g.primary_teacher_id = ${query.teacherId}
      )`);
    }
    if (query.search) {
      const p = `%${query.search}%`;
      conds.push(
        or(
          ilike(payments.receiptNumber, p),
          ilike(students.fullName, p),
          ilike(students.studentCode, p),
        )!,
      );
    }
    const whereClause = and(...conds);

    const [rows, [kpi]] = await Promise.all([
      this.db
        .select({
          id: payments.id,
          receiptNumber: payments.receiptNumber,
          paymentDate: payments.paymentDate,
          yearMonth: payments.yearMonth,
          studentCode: students.studentCode,
          studentName: students.fullName,
          amount: payments.amount,
          paymentMethod: payments.paymentMethod,
          collectorName: users.fullName,
          notes: payments.notes,
        })
        .from(payments)
        .innerJoin(students, eq(payments.studentId, students.id))
        .leftJoin(users, eq(payments.receivedByUserId, users.id))
        .where(whereClause)
        .orderBy(desc(payments.paymentDate), desc(payments.createdAt))
        .limit(pg.limit)
        .offset(pg.offset),
      this.db
        .select({
          receiptsCount: sql<number>`COUNT(*)::int`,
          totalCollected: sql<string>`COALESCE(SUM(${payments.amount}), 0)::text`,
          cashTotal: sql<string>`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} = 'CASH' THEN ${payments.amount} ELSE 0 END), 0)::text`,
          electronicTotal: sql<string>`COALESCE(SUM(CASE WHEN ${payments.paymentMethod} != 'CASH' THEN ${payments.amount} ELSE 0 END), 0)::text`,
        })
        .from(payments)
        .innerJoin(students, eq(payments.studentId, students.id))
        .where(whereClause),
    ]);

    const mapped = rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
      paymentMethodAr: PAYMENT_METHOD_AR[r.paymentMethod] || r.paymentMethod,
      collectorName: r.collectorName || 'النظام',
    }));

    const summary: ReportSummaryKpi[] = [
      { key: 'count', label: 'عدد إيصالات التحصيل', value: Number(kpi?.receiptsCount ?? 0), tone: 'purple' },
      { key: 'total', label: 'إجمالي المحصّل', value: Number(kpi?.totalCollected ?? 0), format: 'currency', tone: 'success' },
      { key: 'cash', label: 'تحصيل نقدي (خزينة)', value: Number(kpi?.cashTotal ?? 0), format: 'currency', tone: 'primary' },
      { key: 'digital', label: 'محافظ وتحويلات', value: Number(kpi?.electronicTotal ?? 0), format: 'currency', tone: 'warning' },
    ];
    return { ...createPaginatedResult(mapped, Number(kpi?.receiptsCount ?? 0), pg.page, pg.limit), summary };
  }

  async getExpensesReport(
    query: ReportQueryDto,
    yearMonth: string,
    pg: NormalizedReportPagination,
  ) {
    const conds: SQL[] = [eq(expenses.yearMonth, yearMonth)];
    if (query.date) {
      conds.push(eq(expenses.expenseDate, query.date));
    }
    if (query.status) conds.push(eq(expenses.category, query.status));
    if (query.search) {
      const p = `%${query.search}%`;
      conds.push(or(ilike(expenses.title, p), ilike(expenses.category, p), ilike(expenses.notes, p))!);
    }
    const whereClause = and(...conds);

    const [rows, [kpi]] = await Promise.all([
      this.db
        .select({
          id: expenses.id,
          expenseDate: expenses.expenseDate,
          yearMonth: expenses.yearMonth,
          category: expenses.category,
          title: expenses.title,
          amount: expenses.amount,
          paymentMethod: expenses.paymentMethod,
          recordedByName: users.fullName,
          notes: expenses.notes,
        })
        .from(expenses)
        .leftJoin(users, eq(expenses.recordedByUserId, users.id))
        .where(whereClause)
        .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt))
        .limit(pg.limit)
        .offset(pg.offset),
      this.db
        .select({
          itemsCount: sql<number>`COUNT(*)::int`,
          totalExpenses: sql<string>`COALESCE(SUM(${expenses.amount}), 0)::text`,
          cashTotal: sql<string>`COALESCE(SUM(CASE WHEN ${expenses.paymentMethod} = 'CASH' THEN ${expenses.amount} ELSE 0 END), 0)::text`,
        })
        .from(expenses)
        .where(whereClause),
    ]);

    const mapped = rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
      categoryAr: EXPENSE_CATEGORY_AR[r.category] || r.category,
      paymentMethodAr: PAYMENT_METHOD_AR[r.paymentMethod] || r.paymentMethod,
      recordedByName: r.recordedByName || 'الإدارة',
    }));

    const totalExp = Number(kpi?.totalExpenses ?? 0);
    const cashExp = Number(kpi?.cashTotal ?? 0);
    const summary: ReportSummaryKpi[] = [
      { key: 'items', label: 'عدد بنود المصروفات', value: Number(kpi?.itemsCount ?? 0), tone: 'purple' },
      { key: 'total', label: 'إجمالي المصروفات', value: totalExp, format: 'currency', tone: 'danger' },
      { key: 'cash', label: 'منصرف نقداً', value: cashExp, format: 'currency', tone: 'warning' },
      { key: 'other', label: 'منصرف تحويلات', value: Number((totalExp - cashExp).toFixed(2)), format: 'currency', tone: 'primary' },
    ];
    return { ...createPaginatedResult(mapped, Number(kpi?.itemsCount ?? 0), pg.page, pg.limit), summary };
  }
}
