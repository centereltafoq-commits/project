import { describe, expect, it } from 'vitest';
import { PERMISSIONS, SystemRole } from '@edu-center/shared';
import {
  assistantPayouts,
  expenses,
  payments,
  teacherPayouts,
} from '../../../database/schemas';
import { DailyLedgerRepository } from './daily-ledger.repository';

function serializeSqlNodes(node: unknown): string {
  if (!node || typeof node !== 'object') return String(node ?? '');
  if ('name' in node && typeof (node as any).name === 'string') {
    return (node as any).name;
  }
  if ('value' in node) return String((node as any).value);
  if ('queryChunks' in node && Array.isArray((node as any).queryChunks)) {
    return (node as any).queryChunks.map(serializeSqlNodes).join(' ');
  }
  return '';
}

describe('DailyLedgerRepository - Strict Month Isolation', () => {
  it('filters payments, payouts, and expenses strictly by yearMonth so cross-month dates never leak into month 10', async () => {
    const capturedWheres: Array<{ table: unknown; whereText: string }> = [];

    const mockDb = {
      select: () => ({
        from: (table: unknown) => ({
          innerJoin: () => ({
            leftJoin: () => ({
              where: (cond: unknown) => {
                capturedWheres.push({ table, whereText: serializeSqlNodes(cond) });
                return { orderBy: async () => [] };
              },
            }),
          }),
          leftJoin: () => ({
            where: (cond: unknown) => {
              capturedWheres.push({ table, whereText: serializeSqlNodes(cond) });
              return { orderBy: async () => [] };
            },
          }),
        }),
      }),
    };

    const repo = new DailyLedgerRepository(mockDb as any);
    await repo.getDailyLedger({ yearMonth: '2026-10' });

    expect(capturedWheres).toHaveLength(4);
    for (const entry of capturedWheres) {
      expect(entry.whereText).toContain('year_month');
      expect(entry.whereText).toContain('2026-10');
    }

    capturedWheres.length = 0;
    await repo.getDailyLedger({ yearMonth: '2026-10', date: '2026-11-27' });
    expect(capturedWheres).toHaveLength(4);
    expect(capturedWheres.find((c) => c.table === payments)?.whereText).toContain('year_month');
    expect(capturedWheres.find((c) => c.table === payments)?.whereText).toContain('2026-10');
    expect(capturedWheres.find((c) => c.table === payments)?.whereText).toContain('2026-11-27');
    expect(capturedWheres.find((c) => c.table === teacherPayouts)?.whereText).toContain('year_month');
    expect(capturedWheres.find((c) => c.table === assistantPayouts)?.whereText).toContain('year_month');
    expect(capturedWheres.find((c) => c.table === expenses)?.whereText).toContain('year_month');
  });

  it('restricts ledger queries to student payments and masks netCashFlow for FINANCE_COLLECT_PAYMENT without FINANCE_VIEW', async () => {
    const queriedTables: unknown[] = [];

    const mockDb = {
      select: () => ({
        from: (table: unknown) => {
          queriedTables.push(table);
          return {
            innerJoin: () => ({
              leftJoin: () => ({
                where: () => ({
                  orderBy: async () => [
                    {
                      id: 'pay-1',
                      receiptNumber: 'REC-001',
                      yearMonth: '2026-11',
                      amount: '600.00',
                      paymentDate: '2026-11-10',
                      paymentMethod: 'CASH',
                      notes: null,
                      createdAt: new Date('2026-11-10T10:00:00Z'),
                      studentName: 'أحمد علي',
                      studentCode: 'ST-001',
                      receivedByName: 'أسيستنت التحصيل',
                    },
                  ],
                }),
              }),
            }),
            leftJoin: () => ({
              where: () => ({
                orderBy: async () => [],
              }),
            }),
          };
        },
      }),
    };

    const repo = new DailyLedgerRepository(mockDb as any);
    const ledger = await repo.getDailyLedger(
      { yearMonth: '2026-11' },
      {
        id: 'ast-1',
        email: '01099887766@assistant.local',
        fullName: 'أسيستنت',
        roleCode: SystemRole.ASSISTANT,
        permissions: [PERMISSIONS.FINANCE_COLLECT_PAYMENT],
      },
    );

    expect(queriedTables).toEqual([payments]);
    expect(ledger.summary.paymentsTotal).toBe(600);
    expect(ledger.summary.totalInflow).toBe(600);
    expect(ledger.summary.totalOutflow).toBe(0);
    expect(ledger.summary.netCashFlow).toBe(0);
    expect(ledger.daysSummary[0]?.netCashFlow).toBe(0);
    expect(ledger.entries).toHaveLength(1);
  });
});
