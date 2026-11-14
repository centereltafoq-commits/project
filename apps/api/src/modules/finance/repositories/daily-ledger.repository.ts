import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../../database/database.module';
import {
  assistantPayouts,
  assistants,
  expenses,
  payments,
  students,
  teacherPayouts,
  teachers,
  users,
} from '../../../database/schemas';
import { DailyLedgerQueryDto } from '../dto/daily-ledger.dto';
import { parseMoney, roundMoney } from '../utils/money.util';

export interface DailyLedgerEntry {
  id: string;
  type: 'PAYMENT' | 'TEACHER_PAYOUT' | 'ASSISTANT_PAYOUT' | 'EXPENSE';
  direction: 'INFLOW' | 'OUTFLOW';
  date: string;
  yearMonth: string;
  referenceNumber: string;
  partyName: string;
  partyCode: string | null;
  categoryLabel: string;
  amount: number;
  paymentMethod: string;
  recordedByName: string | null;
  notes: string | null;
  createdAt: Date | string;
}

export interface DailyLedgerDaySummary {
  date: string;
  paymentsCount: number;
  paymentsTotal: number;
  teacherPayoutsCount: number;
  teacherPayoutsTotal: number;
  assistantPayoutsCount: number;
  assistantPayoutsTotal: number;
  expensesCount: number;
  expensesTotal: number;
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  totalTransactionsCount: number;
}

export interface DailyLedgerSummary {
  paymentsCount: number;
  paymentsTotal: number;
  teacherPayoutsCount: number;
  teacherPayoutsTotal: number;
  assistantPayoutsCount: number;
  assistantPayoutsTotal: number;
  expensesCount: number;
  expensesTotal: number;
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
}

const EXPENSE_CATEGORY_LABELS_AR: Record<string, string> = {
  RENT: 'مصروفات: الإيجار',
  ELECTRICITY_WATER: 'مصروفات: الكهرباء والمياه',
  INTERNET: 'مصروفات: الإنترنت',
  MAINTENANCE: 'مصروفات: الصيانة',
  SUPPLIES: 'مصروفات: الأدوات والمستلزمات',
  ADMINISTRATIVE: 'مصروفات: إدارية وتشغيلية',
  OTHER: 'مصروفات: أخرى',
};

@Injectable()
export class DailyLedgerRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async getDailyLedger(query: DailyLedgerQueryDto) {
    const now = new Date();
    const fallbackYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const resolvedYearMonth =
      query.yearMonth || (query.date ? query.date.slice(0, 7) : fallbackYearMonth);

    const [y, m] = resolvedYearMonth.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const startOfMonth = `${resolvedYearMonth}-01`;
    const endOfMonth = `${resolvedYearMonth}-${String(lastDay).padStart(2, '0')}`;

    const [paymentRows, teacherPayoutRows, assistantPayoutRows, expenseRows] =
      await Promise.all([
        this.db
          .select({
            id: payments.id,
            receiptNumber: payments.receiptNumber,
            yearMonth: payments.yearMonth,
            amount: payments.amount,
            paymentDate: payments.paymentDate,
            paymentMethod: payments.paymentMethod,
            notes: payments.notes,
            createdAt: payments.createdAt,
            studentName: students.fullName,
            studentCode: students.studentCode,
            receivedByName: users.fullName,
          })
          .from(payments)
          .innerJoin(students, eq(students.id, payments.studentId))
          .leftJoin(users, eq(users.id, payments.receivedByUserId))
          .where(
            query.date
              ? eq(payments.paymentDate, query.date)
              : and(
                  gte(payments.paymentDate, startOfMonth),
                  lte(payments.paymentDate, endOfMonth),
                ),
          )
          .orderBy(desc(payments.paymentDate), desc(payments.createdAt)),

        this.db
          .select({
            id: teacherPayouts.id,
            referenceNumber: teacherPayouts.referenceNumber,
            yearMonth: teacherPayouts.yearMonth,
            amount: teacherPayouts.amount,
            payoutDate: teacherPayouts.payoutDate,
            paymentMethod: teacherPayouts.paymentMethod,
            notes: teacherPayouts.notes,
            createdAt: teacherPayouts.createdAt,
            teacherName: teachers.fullName,
            teacherCode: teachers.teacherCode,
            paidByName: users.fullName,
          })
          .from(teacherPayouts)
          .innerJoin(teachers, eq(teachers.id, teacherPayouts.teacherId))
          .leftJoin(users, eq(users.id, teacherPayouts.paidByUserId))
          .where(
            query.date
              ? eq(teacherPayouts.payoutDate, query.date)
              : and(
                  gte(teacherPayouts.payoutDate, startOfMonth),
                  lte(teacherPayouts.payoutDate, endOfMonth),
                ),
          )
          .orderBy(desc(teacherPayouts.payoutDate), desc(teacherPayouts.createdAt)),

        this.db
          .select({
            id: assistantPayouts.id,
            referenceNumber: assistantPayouts.referenceNumber,
            yearMonth: assistantPayouts.yearMonth,
            amount: assistantPayouts.amount,
            payoutDate: assistantPayouts.payoutDate,
            paymentMethod: assistantPayouts.paymentMethod,
            notes: assistantPayouts.notes,
            createdAt: assistantPayouts.createdAt,
            assistantName: assistants.fullName,
            assistantCode: assistants.assistantCode,
            paidByName: users.fullName,
          })
          .from(assistantPayouts)
          .innerJoin(assistants, eq(assistants.id, assistantPayouts.assistantId))
          .leftJoin(users, eq(users.id, assistantPayouts.paidByUserId))
          .where(
            query.date
              ? eq(assistantPayouts.payoutDate, query.date)
              : and(
                  gte(assistantPayouts.payoutDate, startOfMonth),
                  lte(assistantPayouts.payoutDate, endOfMonth),
                ),
          )
          .orderBy(desc(assistantPayouts.payoutDate), desc(assistantPayouts.createdAt)),

        this.db
          .select({
            id: expenses.id,
            category: expenses.category,
            title: expenses.title,
            yearMonth: expenses.yearMonth,
            amount: expenses.amount,
            expenseDate: expenses.expenseDate,
            paymentMethod: expenses.paymentMethod,
            notes: expenses.notes,
            createdAt: expenses.createdAt,
            recordedByName: users.fullName,
          })
          .from(expenses)
          .leftJoin(users, eq(users.id, expenses.recordedByUserId))
          .where(
            query.date
              ? eq(expenses.expenseDate, query.date)
              : and(
                  gte(expenses.expenseDate, startOfMonth),
                  lte(expenses.expenseDate, endOfMonth),
                ),
          )
          .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt)),
      ]);

    const allEntries: DailyLedgerEntry[] = [
      ...paymentRows.map(
        (r): DailyLedgerEntry => ({
          id: r.id,
          type: 'PAYMENT',
          direction: 'INFLOW',
          date: r.paymentDate,
          yearMonth: r.yearMonth,
          referenceNumber: r.receiptNumber,
          partyName: r.studentName,
          partyCode: r.studentCode,
          categoryLabel:
            r.yearMonth !== r.paymentDate.slice(0, 7)
              ? `تحصيل متأخرات طالب (عن شهر ${r.yearMonth})`
              : `تحصيل اشتراك طالب (${r.yearMonth})`,
          amount: parseMoney(r.amount),
          paymentMethod: r.paymentMethod,
          recordedByName: r.receivedByName,
          notes: r.notes,
          createdAt: r.createdAt,
        }),
      ),
      ...teacherPayoutRows.map(
        (r): DailyLedgerEntry => ({
          id: r.id,
          type: 'TEACHER_PAYOUT',
          direction: 'OUTFLOW',
          date: r.payoutDate,
          yearMonth: r.yearMonth,
          referenceNumber: r.referenceNumber,
          partyName: r.teacherName,
          partyCode: r.teacherCode,
          categoryLabel:
            r.yearMonth !== r.payoutDate.slice(0, 7)
              ? `صرف متأخرات مدرس (عن شهر ${r.yearMonth})`
              : `صرف مستحقات مدرس (${r.yearMonth})`,
          amount: parseMoney(r.amount),
          paymentMethod: r.paymentMethod,
          recordedByName: r.paidByName,
          notes: r.notes,
          createdAt: r.createdAt,
        }),
      ),
      ...assistantPayoutRows.map(
        (r): DailyLedgerEntry => ({
          id: r.id,
          type: 'ASSISTANT_PAYOUT',
          direction: 'OUTFLOW',
          date: r.payoutDate,
          yearMonth: r.yearMonth,
          referenceNumber: r.referenceNumber,
          partyName: r.assistantName,
          partyCode: r.assistantCode,
          categoryLabel:
            r.yearMonth !== r.payoutDate.slice(0, 7)
              ? `صرف متأخرات مساعد (عن شهر ${r.yearMonth})`
              : `صرف مستحقات مساعد (${r.yearMonth})`,
          amount: parseMoney(r.amount),
          paymentMethod: r.paymentMethod,
          recordedByName: r.paidByName,
          notes: r.notes,
          createdAt: r.createdAt,
        }),
      ),
      ...expenseRows.map(
        (r): DailyLedgerEntry => ({
          id: r.id,
          type: 'EXPENSE',
          direction: 'OUTFLOW',
          date: r.expenseDate,
          yearMonth: r.yearMonth,
          referenceNumber: `EXP-${r.id.slice(0, 6).toUpperCase()}`,
          partyName: r.title,
          partyCode: null,
          categoryLabel: EXPENSE_CATEGORY_LABELS_AR[r.category] ?? `مصروفات: ${r.category}`,
          amount: parseMoney(r.amount),
          paymentMethod: r.paymentMethod,
          recordedByName: r.recordedByName,
          notes: r.notes,
          createdAt: r.createdAt,
        }),
      ),
    ];

    allEntries.sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const daysMap = new Map<string, DailyLedgerDaySummary>();
    const ensureDay = (dateKey: string): DailyLedgerDaySummary => {
      let existing = daysMap.get(dateKey);
      if (!existing) {
        existing = {
          date: dateKey,
          paymentsCount: 0,
          paymentsTotal: 0,
          teacherPayoutsCount: 0,
          teacherPayoutsTotal: 0,
          assistantPayoutsCount: 0,
          assistantPayoutsTotal: 0,
          expensesCount: 0,
          expensesTotal: 0,
          totalInflow: 0,
          totalOutflow: 0,
          netCashFlow: 0,
          totalTransactionsCount: 0,
        };
        daysMap.set(dateKey, existing);
      }
      return existing;
    };

    if (query.date) {
      ensureDay(query.date);
    }

    for (const entry of allEntries) {
      const day = ensureDay(entry.date);
      day.totalTransactionsCount += 1;
      if (entry.type === 'PAYMENT') {
        day.paymentsCount += 1;
        day.paymentsTotal = roundMoney(day.paymentsTotal + entry.amount);
        day.totalInflow = roundMoney(day.totalInflow + entry.amount);
      } else if (entry.type === 'TEACHER_PAYOUT') {
        day.teacherPayoutsCount += 1;
        day.teacherPayoutsTotal = roundMoney(day.teacherPayoutsTotal + entry.amount);
        day.totalOutflow = roundMoney(day.totalOutflow + entry.amount);
      } else if (entry.type === 'ASSISTANT_PAYOUT') {
        day.assistantPayoutsCount += 1;
        day.assistantPayoutsTotal = roundMoney(day.assistantPayoutsTotal + entry.amount);
        day.totalOutflow = roundMoney(day.totalOutflow + entry.amount);
      } else if (entry.type === 'EXPENSE') {
        day.expensesCount += 1;
        day.expensesTotal = roundMoney(day.expensesTotal + entry.amount);
        day.totalOutflow = roundMoney(day.totalOutflow + entry.amount);
      }
      day.netCashFlow = roundMoney(day.totalInflow - day.totalOutflow);
    }

    const daysSummary = Array.from(daysMap.values()).sort((a, b) =>
      b.date.localeCompare(a.date),
    );

    const dateFilteredEntries = query.date
      ? allEntries.filter((e) => e.date === query.date)
      : allEntries;

    const summary = this.computeSummary(dateFilteredEntries);

    let filteredEntries = dateFilteredEntries;
    if (query.type && query.type !== 'ALL') {
      filteredEntries = filteredEntries.filter((e) => e.type === query.type);
    }
    if (query.paymentMethod) {
      filteredEntries = filteredEntries.filter(
        (e) => e.paymentMethod === query.paymentMethod,
      );
    }
    if (query.search && query.search.trim()) {
      const q = query.search.trim().toLowerCase();
      filteredEntries = filteredEntries.filter(
        (e) =>
          e.referenceNumber.toLowerCase().includes(q) ||
          e.partyName.toLowerCase().includes(q) ||
          (e.partyCode && e.partyCode.toLowerCase().includes(q)) ||
          e.categoryLabel.toLowerCase().includes(q) ||
          (e.notes && e.notes.toLowerCase().includes(q)),
      );
    }

    return {
      yearMonth: resolvedYearMonth,
      selectedDate: query.date ?? null,
      daysSummary,
      summary,
      entries: filteredEntries,
    };
  }

  private computeSummary(entries: DailyLedgerEntry[]): DailyLedgerSummary {
    const s: DailyLedgerSummary = {
      paymentsCount: 0,
      paymentsTotal: 0,
      teacherPayoutsCount: 0,
      teacherPayoutsTotal: 0,
      assistantPayoutsCount: 0,
      assistantPayoutsTotal: 0,
      expensesCount: 0,
      expensesTotal: 0,
      totalInflow: 0,
      totalOutflow: 0,
      netCashFlow: 0,
    };

    for (const entry of entries) {
      if (entry.type === 'PAYMENT') {
        s.paymentsCount += 1;
        s.paymentsTotal = roundMoney(s.paymentsTotal + entry.amount);
        s.totalInflow = roundMoney(s.totalInflow + entry.amount);
      } else if (entry.type === 'TEACHER_PAYOUT') {
        s.teacherPayoutsCount += 1;
        s.teacherPayoutsTotal = roundMoney(s.teacherPayoutsTotal + entry.amount);
        s.totalOutflow = roundMoney(s.totalOutflow + entry.amount);
      } else if (entry.type === 'ASSISTANT_PAYOUT') {
        s.assistantPayoutsCount += 1;
        s.assistantPayoutsTotal = roundMoney(s.assistantPayoutsTotal + entry.amount);
        s.totalOutflow = roundMoney(s.totalOutflow + entry.amount);
      } else if (entry.type === 'EXPENSE') {
        s.expensesCount += 1;
        s.expensesTotal = roundMoney(s.expensesTotal + entry.amount);
        s.totalOutflow = roundMoney(s.totalOutflow + entry.amount);
      }
    }

    s.netCashFlow = roundMoney(s.totalInflow - s.totalOutflow);
    return s;
  }
}
