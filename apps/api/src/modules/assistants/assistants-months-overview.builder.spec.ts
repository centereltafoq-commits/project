import { describe, expect, it } from 'vitest';
import { AssistantCalculationMethod } from '@edu-center/shared';
import { buildAssistantMonthsOverview } from './assistants-months-overview.builder';

describe('buildAssistantMonthsOverview', () => {
  it('computes monthly payout statuses across multiple months and skips dues before creation', () => {
    const overview = buildAssistantMonthsOverview({
      requestedYearMonth: '2026-06',
      currentYearMonth: '2026-06',
      assistant: {
        calculationMethod: AssistantCalculationMethod.FIXED_PER_SESSION,
        rateValue: '100',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
      },
      bundle: {
        linkedGroups: [
          {
            linkId: 'link-1',
            groupId: 'grp-1',
            groupCode: 'G-1',
            groupName: 'فيزياء 1',
            subject: 'فيزياء',
            gradeLevel: 'الأول الثانوي',
            teacherName: 'أ. علي',
            monthlySessionsCount: 8,
            monthlyPrice: '300',
            calculatedSessionPrice: '37.50',
            isActive: true,
            overrideCalculationMethod: null,
            overrideRateValue: null,
            activeStudentsCount: 20,
          },
        ],
        storedDues: [],
        storedMonthlyRecord: null,
        payouts: [
          {
            id: 'pay-1',
            assistantId: 'ast-1',
            referenceNumber: 'PAY-1',
            yearMonth: '2026-03',
            amount: '400.00',
            payoutDate: '2026-03-28',
            paymentMethod: 'CASH',
            notes: null,
            createdBy: 'usr-1',
            createdAt: new Date(),
          },
          {
            id: 'pay-2',
            assistantId: 'ast-1',
            referenceNumber: 'PAY-2',
            yearMonth: '2026-04',
            amount: '150.00',
            payoutDate: '2026-04-28',
            paymentMethod: 'CASH',
            notes: null,
            createdBy: 'usr-1',
            createdAt: new Date(),
          },
        ],
        sessionCounts: [],
        attendanceCounts: [],
        allStoredDues: [],
        allStoredMonthlyRecords: [],
        allSessionCounts: [
          { groupId: 'grp-1', yearMonth: '2026-03', executedCount: 4, executedMinutes: 480 },
          { groupId: 'grp-1', yearMonth: '2026-04', executedCount: 3, executedMinutes: 360 },
          { groupId: 'grp-1', yearMonth: '2026-05', executedCount: 2, executedMinutes: 240 },
        ],
        allAttendanceCounts: [],
      } as never,
    });

    const byMonth = new Map(overview.map((m) => [m.yearMonth, m]));
    expect(byMonth.get('2026-03')).toMatchObject({
      payoutStatus: 'PAID',
      totalDues: 400,
      totalPayouts: 400,
      remainingBalance: 0,
      executedSessionsCount: 4,
    });
    expect(byMonth.get('2026-04')).toMatchObject({
      payoutStatus: 'PARTIAL',
      totalDues: 300,
      totalPayouts: 150,
      remainingBalance: 150,
      executedSessionsCount: 3,
    });
    expect(byMonth.get('2026-05')).toMatchObject({
      payoutStatus: 'UNPAID',
      totalDues: 200,
      totalPayouts: 0,
      remainingBalance: 200,
      executedSessionsCount: 2,
    });
    expect(byMonth.get('2026-06')).toMatchObject({
      payoutStatus: 'NO_DUES',
      totalDues: 0,
      totalPayouts: 0,
      remainingBalance: 0,
      executedSessionsCount: 0,
    });
  });
});
