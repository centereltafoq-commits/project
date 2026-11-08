import { Inject, Injectable } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { ExpenseCategory } from '@edu-center/shared';
import { DRIZZLE_DB, DrizzleDatabase } from '../../../database/database.module';
import {
  assistantDues,
  assistantMonthlyRecords,
  assistantPayouts,
  expenses,
  payments,
  studentMonthlyRecords,
  teacherDues,
  teacherMonthlyRecords,
  teacherPayouts,
} from '../../../database/schemas';
import { createPaginatedResult } from '../../../common/utils/pagination.util';
import { ReportSummaryKpi } from '../reports.types';
import { EXPENSE_CATEGORY_AR } from '../utils/report-labels.util';

@Injectable()
export class FinancialSummaryRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async getFinancialSummaryReport(yearMonth: string) {
    const [
      [stuRow],
      [payRow],
      [teacherShareRow],
      [teacherPaidRow],
      [assistantDueRow],
      [assistantPaidRow],
      expCategoriesRows,
    ] = await Promise.all([
      this.db
        .select({
          totalRevenue: sql<string>`COALESCE(SUM(${studentMonthlyRecords.totalDue}), 0)::text`,
          totalReceivables: sql<string>`COALESCE(SUM(CASE WHEN ${studentMonthlyRecords.remainingBalance} > 0 THEN ${studentMonthlyRecords.remainingBalance} ELSE 0 END), 0)::text`,
        })
        .from(studentMonthlyRecords)
        .where(eq(studentMonthlyRecords.yearMonth, yearMonth)),
      this.db
        .select({ collected: sql<string>`COALESCE(SUM(${payments.amount}), 0)::text` })
        .from(payments)
        .where(eq(payments.yearMonth, yearMonth)),
      this.db.execute<{ teacher_share: string; center_share: string }>(sql`
        SELECT
          COALESCE(
            NULLIF((SELECT SUM(${teacherMonthlyRecords.totalDues}) FROM ${teacherMonthlyRecords} WHERE ${teacherMonthlyRecords.yearMonth} = ${yearMonth}), 0),
            (SELECT SUM(${teacherDues.teacherAmount}) FROM ${teacherDues} WHERE ${teacherDues.yearMonth} = ${yearMonth}),
            0
          )::text AS teacher_share,
          COALESCE((SELECT SUM(${teacherDues.centerAmount}) FROM ${teacherDues} WHERE ${teacherDues.yearMonth} = ${yearMonth}), 0)::text AS center_share
      `).then((r) => r.rows),
      this.db
        .select({ paid: sql<string>`COALESCE(SUM(${teacherPayouts.amount}), 0)::text` })
        .from(teacherPayouts)
        .where(eq(teacherPayouts.yearMonth, yearMonth)),
      this.db.execute<{ assistant_dues: string }>(sql`
        SELECT COALESCE(
          NULLIF((SELECT SUM(${assistantMonthlyRecords.totalDues}) FROM ${assistantMonthlyRecords} WHERE ${assistantMonthlyRecords.yearMonth} = ${yearMonth}), 0),
          (SELECT SUM(${assistantDues.amount}) FROM ${assistantDues} WHERE ${assistantDues.yearMonth} = ${yearMonth}),
          0
        )::text AS assistant_dues
      `).then((r) => r.rows),
      this.db
        .select({ paid: sql<string>`COALESCE(SUM(${assistantPayouts.amount}), 0)::text` })
        .from(assistantPayouts)
        .where(eq(assistantPayouts.yearMonth, yearMonth)),
      this.db
        .select({
          category: expenses.category,
          amount: sql<string>`COALESCE(SUM(${expenses.amount}), 0)::text`,
        })
        .from(expenses)
        .where(eq(expenses.yearMonth, yearMonth))
        .groupBy(expenses.category),
    ]);

    const totalRevenue = Number(stuRow?.totalRevenue ?? 0);
    const totalReceivables = Number(stuRow?.totalReceivables ?? 0);
    const totalCollected = Number(payRow?.collected ?? 0);
    const teacherShare = Number(teacherShareRow?.teacher_share ?? 0);
    const centerShare = Number((totalRevenue - teacherShare).toFixed(2));
    const teacherPaid = Number(teacherPaidRow?.paid ?? 0);
    const assistantDuesSum = Number(assistantDueRow?.assistant_dues ?? 0);
    const assistantPaid = Number(assistantPaidRow?.paid ?? 0);

    const expByCat = new Map(expCategoriesRows.map((e) => [e.category, Number(e.amount)]));
    const totalExpenses = Array.from(expByCat.values()).reduce((a, b) => a + b, 0);
    const netCenterResult = Number((centerShare - assistantDuesSum - totalExpenses).toFixed(2));
    const netCashFlow = Number((totalCollected - teacherPaid - assistantPaid - totalExpenses).toFixed(2));

    const expenseRows = Object.values(ExpenseCategory).map((cat) => ({
      id: `exp-${cat}`,
      sectionAr: 'تفصيل المصروفات التشغيلية',
      lineItemAr: EXPENSE_CATEGORY_AR[cat] || cat,
      amount: expByCat.get(cat) ?? 0,
      rowKind: 'DEDUCTION',
      notes: 'مصروف تشغيلي شهري',
    }));

    const statementRows = [
      { id: 'rev-gross', sectionAr: 'الإيرادات والتحصيل', lineItemAr: 'إجمالي إيرادات المجموعات (مستحقات الطلاب)', amount: totalRevenue, rowKind: 'INFLOW', notes: 'إجمالي قيمة الحصص والاشتراكات المستحقة' },
      { id: 'rev-coll', sectionAr: 'الإيرادات والتحصيل', lineItemAr: 'إجمالي التحصيل الفعلي بالخزينة والمحافظ', amount: totalCollected, rowKind: 'INFLOW', notes: 'المبالغ المسددة فعلياً خلال الشهر' },
      { id: 'rev-rec', sectionAr: 'الإيرادات والتحصيل', lineItemAr: 'متأخرات ومديونيات الطلاب المتبقية', amount: totalReceivables, rowKind: 'SUBTOTAL', notes: 'مستحقات لم تُحصّل بعد' },
      { id: 'split-tch', sectionAr: 'توزيع أنصبة المجموعات', lineItemAr: 'نصيب المدرسين المستحق', amount: teacherShare, rowKind: 'DEDUCTION', notes: `المنصرف الفعلي للمدرسين: ${teacherPaid} ج.م` },
      { id: 'split-ctr', sectionAr: 'توزيع أنصبة المجموعات', lineItemAr: 'نصيب السنتر الإجمالي من المجموعات', amount: centerShare, rowKind: 'SUBTOTAL', notes: 'إيراد السنتر قبل المساعدين والمصروفات' },
      { id: 'ast-dues', sectionAr: 'مستحقات المساعدين', lineItemAr: 'إجمالي مستحقات المساعدين', amount: assistantDuesSum, rowKind: 'DEDUCTION', notes: `المنصرف الفعلي للمساعدين: ${assistantPaid} ج.م` },
      ...expenseRows,
      { id: 'exp-total', sectionAr: 'إجمالي المصروفات', lineItemAr: 'مجموع المصروفات التشغيلية للشهر', amount: totalExpenses, rowKind: 'SUBTOTAL', notes: 'مجموع كافة بنود المصروفات أعلاه' },
      { id: 'net-acc', sectionAr: 'صافي النتيجة', lineItemAr: 'صافي ربح / نتيجة السنتر المحاسبية', amount: netCenterResult, rowKind: 'NET', notes: 'نصيب السنتر - مستحقات المساعدين - المصروفات' },
      { id: 'net-cash', sectionAr: 'صافي النتيجة', lineItemAr: 'صافي التدفق النقدي الفعلي بالخزينة', amount: netCashFlow, rowKind: 'NET', notes: 'التحصيل الفعلي - المنصرف للمدرسين والمساعدين والمصروفات' },
    ];

    const summary: ReportSummaryKpi[] = [
      { key: 'rev', label: 'إجمالي إيرادات المجموعات', value: totalRevenue, format: 'currency', tone: 'primary' },
      { key: 'coll', label: 'التحصيل الفعلي', value: totalCollected, format: 'currency', tone: 'success' },
      { key: 'ctrShare', label: 'نصيب السنتر من المجموعات', value: centerShare, format: 'currency', tone: 'purple' },
      { key: 'net', label: 'صافي نتيجة السنتر', value: netCenterResult, format: 'currency', tone: netCenterResult >= 0 ? 'success' : 'danger' },
      { key: 'cashFlow', label: 'صافي التدفق النقدي', value: netCashFlow, format: 'currency', tone: netCashFlow >= 0 ? 'success' : 'danger' },
    ];

    return {
      ...createPaginatedResult(statementRows, statementRows.length, 1, statementRows.length),
      summary,
    };
  }
}
