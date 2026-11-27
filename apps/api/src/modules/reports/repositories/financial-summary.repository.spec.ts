import { describe, expect, it } from 'vitest';
import {
  assistantPayouts,
  expenses,
  payments,
  studentMonthlyRecords,
  teacherPayouts,
} from '../../../database/schemas';
import { FinancialSummaryRepository } from './financial-summary.repository';

function createMockDb() {
  let executeIdx = 0;
  const executeResults = [
    { rows: [{ teacher_share: '6000.00', center_share: '3400.00' }] },
    { rows: [{ assistant_dues: '1900.00' }] },
  ];

  let paymentsCall = 0;
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === expenses) {
            return {
              groupBy: async () => [{ category: 'RENT', amount: '2500.00' }],
            };
          }
          if (table === studentMonthlyRecords) {
            return Promise.resolve([{ totalRevenue: '10000.00', totalReceivables: '1500.00' }]);
          }
          if (table === payments) {
            paymentsCall += 1;
            return Promise.resolve([{ collected: paymentsCall === 1 ? '8500.00' : '8500.00' }]);
          }
          if (table === teacherPayouts) {
            return Promise.resolve([{ paid: '4000.00' }]);
          }
          if (table === assistantPayouts) {
            return Promise.resolve([{ paid: '1000.00' }]);
          }
          return Promise.resolve([]);
        },
      }),
    }),
    execute: async () => executeResults[executeIdx++] ?? { rows: [] },
  };
}

describe('FinancialSummaryRepository - Monthly Center Net Profit', () => {
  it('uses SUM(teacher_dues.center_amount) directly for centerShare and netCenterResult without deducting assistants or expenses', async () => {
    const repo = new FinancialSummaryRepository(createMockDb() as any);
    const report = await repo.getFinancialSummaryReport('2026-11');

    const ctrRow = report.data.find((r) => r.id === 'split-ctr');
    const netRow = report.data.find((r) => r.id === 'net-acc');
    const cashRow = report.data.find((r) => r.id === 'net-cash');
    const netKpi = report.summary.find((k) => k.key === 'net');

    expect(ctrRow?.amount).toBe(3400);
    expect(netRow?.amount).toBe(3400);
    expect(netKpi?.value).toBe(3400);
    expect(cashRow?.amount).toBe(1000);
  });
});
