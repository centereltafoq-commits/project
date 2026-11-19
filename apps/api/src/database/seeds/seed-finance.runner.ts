import {
  AssistantCalculationMethod,
  ExpenseCategory,
  PaymentMethod,
} from '@edu-center/shared';
import { DrizzleDatabase } from '../database.module';
import {
  assistantDues,
  assistantMonthlyRecords,
  assistantPayouts,
  expenses,
  teacherDues,
  teacherMonthlyRecords,
  teacherPayouts,
} from '../schemas';
import { seedUuid } from './seed-identity.data';
import { SeededCatalogContext } from './seed-operations.runner';
import { GroupFinancialAccumulator } from './seed-student-finance.runner';

export async function seedStaffSettlementsAndExpenses(
  db: DrizzleDatabase,
  ctx: SeededCatalogContext,
  groupAccs: Map<string, GroupFinancialAccumulator>,
): Promise<void> {
  const [yr, mo] = ctx.yearMonth.split('-');
  const d = (day: number) => `${yr}-${mo}-${String(day).padStart(2, '0')}`;

  let payoutSeq = 1;
  for (const acc of groupAccs.values()) {
    await db
      .insert(teacherDues)
      .values({
        teacherId: acc.teacherId,
        groupId: acc.groupId,
        yearMonth: ctx.yearMonth,
        executedSessionsCount: acc.executedSessions,
        studentsCount: acc.studentsCount,
        grossGroupRevenue: acc.grossRevenue.toFixed(2),
        teacherAmount: acc.teacherAmount.toFixed(2),
        centerAmount: acc.centerAmount.toFixed(2),
        calculationBreakdown: `نسبة المدرس المعتمدة من إجمالي مستحقات المجموعة (${acc.grossRevenue.toFixed(2)} ج.م)`,
      })
      .onConflictDoUpdate({
        target: [teacherDues.teacherId, teacherDues.groupId, teacherDues.yearMonth],
        set: {
          executedSessionsCount: acc.executedSessions,
          studentsCount: acc.studentsCount,
          grossGroupRevenue: acc.grossRevenue.toFixed(2),
          teacherAmount: acc.teacherAmount.toFixed(2),
          centerAmount: acc.centerAmount.toFixed(2),
        },
      });

    const paidOut = Number((acc.teacherAmount * 0.6).toFixed(2));
    const remaining = Number((acc.teacherAmount - paidOut).toFixed(2));

    await db
      .insert(teacherMonthlyRecords)
      .values({
        teacherId: acc.teacherId,
        yearMonth: ctx.yearMonth,
        groupsCount: 1,
        executedSessionsCount: acc.executedSessions,
        totalDues: acc.teacherAmount.toFixed(2),
        totalPaidOut: paidOut.toFixed(2),
        remainingBalance: remaining.toFixed(2),
      })
      .onConflictDoUpdate({
        target: [teacherMonthlyRecords.teacherId, teacherMonthlyRecords.yearMonth],
        set: {
          executedSessionsCount: acc.executedSessions,
          totalDues: acc.teacherAmount.toFixed(2),
          totalPaidOut: paidOut.toFixed(2),
          remainingBalance: remaining.toFixed(2),
        },
      });

    if (paidOut > 0) {
      const refNo = `TPO-${ctx.yearMonth.replace('-', '')}-${String(100 + payoutSeq)}`;
      payoutSeq++;
      await db
        .insert(teacherPayouts)
        .values({
          referenceNumber: refNo,
          teacherId: acc.teacherId,
          yearMonth: ctx.yearMonth,
          amount: paidOut.toFixed(2),
          payoutDate: d(18),
          paymentMethod: PaymentMethod.CASH,
          paidByUserId: ctx.accountantUserId,
          notes: 'دفعة تحت الحساب من مستحقات الشهر',
        })
        .onConflictDoUpdate({
          target: teacherPayouts.referenceNumber,
          set: { amount: paidOut.toFixed(2), yearMonth: ctx.yearMonth },
        });
    }
  }

  const mathGroup = ctx.groupsList.find((g) => g.groupCode === 'GRP-4101')!;
  const physGroup = ctx.groupsList.find((g) => g.groupCode === 'GRP-4102')!;
  const engGroup = ctx.groupsList.find((g) => g.groupCode === 'GRP-4104')!;
  const mathAcc = groupAccs.get(mathGroup.id)!;
  const physAcc = groupAccs.get(physGroup.id)!;

  const astEntries = [
    {
      idx: 1,
      code: 'AST-3101',
      groupId: mathGroup.id,
      method: AssistantCalculationMethod.SESSION_COMMISSION_PERCENT,
      sessionsCount: mathAcc.executedSessions,
      studentsCount: mathAcc.studentsCount,
      amount: Number((mathAcc.centerAmount * 0.1).toFixed(2)),
      note: '10% عمولة من نصيب السنتر في مجموعة الرياضيات',
    },
    {
      idx: 2,
      code: 'AST-3102',
      groupId: physGroup.id,
      method: AssistantCalculationMethod.FIXED_PER_SESSION,
      sessionsCount: physAcc.executedSessions,
      studentsCount: physAcc.studentsCount,
      amount: Number((physAcc.executedSessions * 120).toFixed(2)),
      note: `${physAcc.executedSessions} حصص × 120 ج.م`,
    },
    {
      idx: 3,
      code: 'AST-3103',
      groupId: engGroup.id,
      method: AssistantCalculationMethod.FIXED_MONTHLY,
      sessionsCount: 3,
      studentsCount: 5,
      amount: 450,
      note: 'مكافأة إشراف ومتابعة امتحانات شهرية',
    },
  ];

  for (const item of astEntries) {
    const assistantId = ctx.assistantsByCode.get(item.code)!;
    const paid = Number((item.amount * 0.5).toFixed(2));
    const rem = Number((item.amount - paid).toFixed(2));

    await db
      .insert(assistantDues)
      .values({
        id: seedUuid('40', item.idx),
        assistantId,
        groupId: item.groupId,
        yearMonth: ctx.yearMonth,
        calculationMethod: item.method,
        sessionsCount: item.sessionsCount,
        studentsCount: item.studentsCount,
        amount: item.amount.toFixed(2),
        calculationBreakdown: item.note,
      })
      .onConflictDoUpdate({
        target: assistantDues.id,
        set: { amount: item.amount.toFixed(2), yearMonth: ctx.yearMonth },
      });

    await db
      .insert(assistantMonthlyRecords)
      .values({
        assistantId,
        yearMonth: ctx.yearMonth,
        calculationMethodSnapshot: item.method,
        totalDues: item.amount.toFixed(2),
        totalPaidOut: paid.toFixed(2),
        remainingBalance: rem.toFixed(2),
        detailsNote: item.note,
      })
      .onConflictDoUpdate({
        target: [assistantMonthlyRecords.assistantId, assistantMonthlyRecords.yearMonth],
        set: {
          totalDues: item.amount.toFixed(2),
          totalPaidOut: paid.toFixed(2),
          remainingBalance: rem.toFixed(2),
        },
      });

    const refNo = `APO-${ctx.yearMonth.replace('-', '')}-${String(200 + item.idx)}`;
    await db
      .insert(assistantPayouts)
      .values({
        referenceNumber: refNo,
        assistantId,
        yearMonth: ctx.yearMonth,
        amount: paid.toFixed(2),
        payoutDate: d(19),
        paymentMethod: PaymentMethod.VODAFONE_CASH,
        paidByUserId: ctx.accountantUserId,
        notes: 'صرف جزء من مستحقات المساعد',
      })
      .onConflictDoUpdate({
        target: assistantPayouts.referenceNumber,
        set: { amount: paid.toFixed(2), yearMonth: ctx.yearMonth },
      });
  }

  const expenseItems = [
    { idx: 1, cat: ExpenseCategory.RENT, title: 'دفعة إيجار المقر الإداري والقاعات', amount: '400.00', day: 1, method: PaymentMethod.BANK_TRANSFER },
    { idx: 2, cat: ExpenseCategory.ELECTRICITY_WATER, title: 'فاتورة الكهرباء والمياه الشهرية', amount: '180.00', day: 6, method: PaymentMethod.CASH },
    { idx: 3, cat: ExpenseCategory.INTERNET, title: 'اشتراك الإنترنت الفايبر فائق السرعة', amount: '95.00', day: 8, method: PaymentMethod.INSTAPAY },
    { idx: 4, cat: ExpenseCategory.SUPPLIES, title: 'أقلام سبورة وورق تصوير امتحانات', amount: '125.00', day: 11, method: PaymentMethod.CASH },
    { idx: 5, cat: ExpenseCategory.MAINTENANCE, title: 'صيانة دورية لتكييف قاعة الفارابي', amount: '110.00', day: 14, method: PaymentMethod.CASH },
    { idx: 6, cat: ExpenseCategory.ADMINISTRATIVE, title: 'ضيافة ومستلزمات استقبال أولياء الأمور', amount: '70.00', day: 17, method: PaymentMethod.CASH },
  ];

  for (const exp of expenseItems) {
    await db
      .insert(expenses)
      .values({
        id: seedUuid('50', exp.idx),
        category: exp.cat,
        title: exp.title,
        amount: exp.amount,
        expenseDate: d(exp.day),
        yearMonth: ctx.yearMonth,
        paymentMethod: exp.method,
        recordedByUserId: ctx.accountantUserId,
      })
      .onConflictDoUpdate({
        target: expenses.id,
        set: { amount: exp.amount, yearMonth: ctx.yearMonth, expenseDate: d(exp.day) },
      });
  }
}
