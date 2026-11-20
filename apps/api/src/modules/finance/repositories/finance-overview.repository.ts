import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, ne, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../../database/database.module';
import {
  assistantMonthlyRecords,
  assistantPayouts,
  assistants,
  expenses,
  groups,
  payments,
  studentMonthlyRecords,
  students,
  teacherMonthlyRecords,
  teacherPayouts,
  teachers,
} from '../../../database/schemas';
import { parseMoney, roundMoney } from '../utils/money.util';
import { FinanceTransaction } from './finance-month-lock.util';
import { runQueriesInParallel, runQueriesSequentially } from './finance-month-lock.util';

@Injectable()
export class FinanceOverviewRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async fetchFinanceLookups() {
    const [studentsList, groupsList, teachersList, assistantsList] = await Promise.all([
      this.db
        .select({
          id: students.id,
          code: students.studentCode,
          fullName: students.fullName,
          phone: students.phone,
          gradeLevel: students.gradeLevel,
        })
        .from(students)
        .where(ne(students.status, 'ARCHIVED'))
        .orderBy(asc(students.fullName))
        .limit(500),
      this.db
        .select({
          id: groups.id,
          code: groups.groupCode,
          name: groups.name,
          subject: groups.subject,
          gradeLevel: groups.gradeLevel,
          monthlyPrice: groups.monthlyPrice,
        })
        .from(groups)
        .orderBy(asc(groups.name))
        .limit(500),
      this.db
        .select({
          id: teachers.id,
          code: teachers.teacherCode,
          fullName: teachers.fullName,
          specialization: teachers.specialization,
        })
        .from(teachers)
        .orderBy(asc(teachers.fullName))
        .limit(300),
      this.db
        .select({
          id: assistants.id,
          code: assistants.assistantCode,
          fullName: assistants.fullName,
          calculationMethod: assistants.calculationMethod,
          rateValue: assistants.rateValue,
        })
        .from(assistants)
        .orderBy(asc(assistants.fullName))
        .limit(300),
    ]);

    return {
      students: studentsList,
      groups: groupsList,
      teachers: teachersList,
      assistants: assistantsList,
    };
  }

  async fetchMonthExecutiveSummary(yearMonth: string, tx?: FinanceTransaction) {
    const executor = tx ?? this.db;
    const summaryQueries = [
      () => executor
        .select({
          totalDue: sql<string>`COALESCE(SUM(${studentMonthlyRecords.totalDue}), 0)`,
          totalPaid: sql<string>`COALESCE(SUM(${studentMonthlyRecords.totalPaid}), 0)`,
          remaining: sql<string>`COALESCE(SUM(${studentMonthlyRecords.remainingBalance}), 0)`,
          closedCount: sql<number>`COUNT(*) FILTER (WHERE ${studentMonthlyRecords.isClosed} = true)`,
          openCount: sql<number>`COUNT(*) FILTER (WHERE ${studentMonthlyRecords.isClosed} = false)`,
        })
        .from(studentMonthlyRecords)
        .where(eq(studentMonthlyRecords.yearMonth, yearMonth)),
      () => executor
        .select({
          totalCollected: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
        })
        .from(payments)
        .where(eq(payments.yearMonth, yearMonth)),
      () => executor
        .select({
          totalDues: sql<string>`COALESCE(SUM(${teacherMonthlyRecords.totalDues}), 0)`,
          totalPaidOut: sql<string>`COALESCE(SUM(${teacherMonthlyRecords.totalPaidOut}), 0)`,
          remaining: sql<string>`COALESCE(SUM(${teacherMonthlyRecords.remainingBalance}), 0)`,
          closedCount: sql<number>`COUNT(*) FILTER (WHERE ${teacherMonthlyRecords.isClosed} = true)`,
          openCount: sql<number>`COUNT(*) FILTER (WHERE ${teacherMonthlyRecords.isClosed} = false)`,
        })
        .from(teacherMonthlyRecords)
        .where(eq(teacherMonthlyRecords.yearMonth, yearMonth)),
      () => executor
        .select({
          totalPaidOut: sql<string>`COALESCE(SUM(${teacherPayouts.amount}), 0)`,
        })
        .from(teacherPayouts)
        .where(eq(teacherPayouts.yearMonth, yearMonth)),
      () => executor
        .select({
          totalDues: sql<string>`COALESCE(SUM(${assistantMonthlyRecords.totalDues}), 0)`,
          totalPaidOut: sql<string>`COALESCE(SUM(${assistantMonthlyRecords.totalPaidOut}), 0)`,
          remaining: sql<string>`COALESCE(SUM(${assistantMonthlyRecords.remainingBalance}), 0)`,
          closedCount: sql<number>`COUNT(*) FILTER (WHERE ${assistantMonthlyRecords.isClosed} = true)`,
          openCount: sql<number>`COUNT(*) FILTER (WHERE ${assistantMonthlyRecords.isClosed} = false)`,
        })
        .from(assistantMonthlyRecords)
        .where(eq(assistantMonthlyRecords.yearMonth, yearMonth)),
      () => executor
        .select({
          totalPaidOut: sql<string>`COALESCE(SUM(${assistantPayouts.amount}), 0)`,
        })
        .from(assistantPayouts)
        .where(eq(assistantPayouts.yearMonth, yearMonth)),
      () => executor
        .select({
          totalExpenses: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
        })
        .from(expenses)
        .where(eq(expenses.yearMonth, yearMonth)),
    ] as const;
    const [
      [studentAgg],
      [paymentsAgg],
      [teacherAgg],
      [teacherPayoutAgg],
      [assistantAgg],
      [assistantPayoutAgg],
      [expenseAgg],
    ] = tx
      ? await runQueriesSequentially(summaryQueries)
      : await runQueriesInParallel(summaryQueries);

    const closedTotal =
      Number(studentAgg?.closedCount ?? 0) +
      Number(teacherAgg?.closedCount ?? 0) +
      Number(assistantAgg?.closedCount ?? 0);
    const openTotal =
      Number(studentAgg?.openCount ?? 0) +
      Number(teacherAgg?.openCount ?? 0) +
      Number(assistantAgg?.openCount ?? 0);

    const studentTotalDue = parseMoney(studentAgg?.totalDue);
    const studentTotalPaid = Math.max(
      parseMoney(studentAgg?.totalPaid),
      parseMoney(paymentsAgg?.totalCollected),
    );
    const teacherTotalDues = parseMoney(teacherAgg?.totalDues);
    const teacherTotalPaidOut = Math.max(
      parseMoney(teacherAgg?.totalPaidOut),
      parseMoney(teacherPayoutAgg?.totalPaidOut),
    );
    const assistantTotalDues = parseMoney(assistantAgg?.totalDues);
    const assistantTotalPaidOut = Math.max(
      parseMoney(assistantAgg?.totalPaidOut),
      parseMoney(assistantPayoutAgg?.totalPaidOut),
    );
    const totalExpenses = parseMoney(expenseAgg?.totalExpenses);

    const netCenterProfit = roundMoney(
      studentTotalDue - teacherTotalDues - assistantTotalDues - totalExpenses,
    );
    const netCashFlow = roundMoney(
      studentTotalPaid - teacherTotalPaidOut - assistantTotalPaidOut - totalExpenses,
    );

    return {
      yearMonth,
      isMonthClosed: closedTotal > 0 && openTotal === 0,
      students: {
        totalDue: studentTotalDue,
        totalPaid: studentTotalPaid,
        remainingBalance: parseMoney(studentAgg?.remaining),
      },
      teachers: {
        totalDues: teacherTotalDues,
        totalPaidOut: teacherTotalPaidOut,
        remainingBalance: parseMoney(teacherAgg?.remaining),
      },
      assistants: {
        totalDues: assistantTotalDues,
        totalPaidOut: assistantTotalPaidOut,
        remainingBalance: parseMoney(assistantAgg?.remaining),
      },
      expenses: {
        totalAmount: totalExpenses,
      },
      netCenterProfit,
      netCashFlow,
    };
  }
}
