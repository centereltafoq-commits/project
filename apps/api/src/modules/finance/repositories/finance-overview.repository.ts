import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, ne, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../../database/database.module';
import {
  assistantMonthlyRecords,
  assistants,
  expenses,
  groups,
  studentMonthlyRecords,
  students,
  teacherMonthlyRecords,
  teachers,
} from '../../../database/schemas';
import { parseMoney } from '../utils/money.util';

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

  async fetchMonthExecutiveSummary(yearMonth: string) {
    const [[studentAgg], [teacherAgg], [assistantAgg], [expenseAgg]] = await Promise.all([
      this.db
        .select({
          totalDue: sql<string>`COALESCE(SUM(${studentMonthlyRecords.totalDue}), 0)`,
          totalPaid: sql<string>`COALESCE(SUM(${studentMonthlyRecords.totalPaid}), 0)`,
          remaining: sql<string>`COALESCE(SUM(${studentMonthlyRecords.remainingBalance}), 0)`,
          closedCount: sql<number>`COUNT(*) FILTER (WHERE ${studentMonthlyRecords.isClosed} = true)`,
          openCount: sql<number>`COUNT(*) FILTER (WHERE ${studentMonthlyRecords.isClosed} = false)`,
        })
        .from(studentMonthlyRecords)
        .where(eq(studentMonthlyRecords.yearMonth, yearMonth)),
      this.db
        .select({
          totalDues: sql<string>`COALESCE(SUM(${teacherMonthlyRecords.totalDues}), 0)`,
          totalPaidOut: sql<string>`COALESCE(SUM(${teacherMonthlyRecords.totalPaidOut}), 0)`,
          remaining: sql<string>`COALESCE(SUM(${teacherMonthlyRecords.remainingBalance}), 0)`,
          closedCount: sql<number>`COUNT(*) FILTER (WHERE ${teacherMonthlyRecords.isClosed} = true)`,
          openCount: sql<number>`COUNT(*) FILTER (WHERE ${teacherMonthlyRecords.isClosed} = false)`,
        })
        .from(teacherMonthlyRecords)
        .where(eq(teacherMonthlyRecords.yearMonth, yearMonth)),
      this.db
        .select({
          totalDues: sql<string>`COALESCE(SUM(${assistantMonthlyRecords.totalDues}), 0)`,
          totalPaidOut: sql<string>`COALESCE(SUM(${assistantMonthlyRecords.totalPaidOut}), 0)`,
          remaining: sql<string>`COALESCE(SUM(${assistantMonthlyRecords.remainingBalance}), 0)`,
        })
        .from(assistantMonthlyRecords)
        .where(eq(assistantMonthlyRecords.yearMonth, yearMonth)),
      this.db
        .select({
          totalExpenses: sql<string>`COALESCE(SUM(${expenses.amount}), 0)`,
        })
        .from(expenses)
        .where(eq(expenses.yearMonth, yearMonth)),
    ]);

    const closedTotal =
      Number(studentAgg?.closedCount ?? 0) + Number(teacherAgg?.closedCount ?? 0);
    const openTotal =
      Number(studentAgg?.openCount ?? 0) + Number(teacherAgg?.openCount ?? 0);

    return {
      yearMonth,
      isMonthClosed: closedTotal > 0 && openTotal === 0,
      students: {
        totalDue: parseMoney(studentAgg?.totalDue),
        totalPaid: parseMoney(studentAgg?.totalPaid),
        remainingBalance: parseMoney(studentAgg?.remaining),
      },
      teachers: {
        totalDues: parseMoney(teacherAgg?.totalDues),
        totalPaidOut: parseMoney(teacherAgg?.totalPaidOut),
        remainingBalance: parseMoney(teacherAgg?.remaining),
      },
      assistants: {
        totalDues: parseMoney(assistantAgg?.totalDues),
        totalPaidOut: parseMoney(assistantAgg?.totalPaidOut),
        remainingBalance: parseMoney(assistantAgg?.remaining),
      },
      expenses: {
        totalAmount: parseMoney(expenseAgg?.totalExpenses),
      },
    };
  }
}
