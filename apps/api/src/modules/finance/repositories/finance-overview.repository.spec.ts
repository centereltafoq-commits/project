import { describe, expect, it } from 'vitest';
import {
  assistantMonthlyRecords,
  assistantPayouts,
  expenses,
  payments,
  studentMonthlyRecords,
  teacherDues,
  teacherMonthlyRecords,
  teacherPayouts,
} from '../../../database/schemas';
import { FinanceOverviewRepository } from './finance-overview.repository';

function createMockDb(byTable: Map<unknown, unknown[]>) {
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: async () => byTable.get(table) ?? [],
      }),
    }),
  };
}

describe('FinanceOverviewRepository - fetchMonthExecutiveSummary', () => {
  it('computes netCenterProfit strictly from SUM(teacherDues.centerAmount) without deducting assistant dues or expenses', async () => {
    const byTable = new Map<unknown, unknown[]>([
      [
        studentMonthlyRecords,
        [{ totalDue: '10000.00', totalPaid: '8500.00', remaining: '1500.00', closedCount: 0, openCount: 5 }],
      ],
      [payments, [{ totalCollected: '8500.00' }]],
      [
        teacherMonthlyRecords,
        [{ totalDues: '6000.00', totalPaidOut: '4000.00', remaining: '2000.00', closedCount: 0, openCount: 2 }],
      ],
      [teacherPayouts, [{ totalPaidOut: '4000.00' }]],
      [
        assistantMonthlyRecords,
        [{ totalDues: '2200.00', totalPaidOut: '1500.00', remaining: '700.00', closedCount: 0, openCount: 2 }],
      ],
      [assistantPayouts, [{ totalPaidOut: '1500.00' }]],
      [expenses, [{ totalExpenses: '1800.00' }]],
      [teacherDues, [{ totalCenterShare: '3200.50' }]],
    ]);

    const repo = new FinanceOverviewRepository(createMockDb(byTable) as any);
    const summary = await repo.fetchMonthExecutiveSummary('2026-11');

    expect(summary.netCenterProfit).toBe(3200.5);
    expect(summary.assistants.totalDues).toBe(2200);
    expect(summary.expenses.totalAmount).toBe(1800);
    // Cash flow still reflects actual treasury inflows minus actual outflows
    expect(summary.netCashFlow).toBe(1200);
  });
});
