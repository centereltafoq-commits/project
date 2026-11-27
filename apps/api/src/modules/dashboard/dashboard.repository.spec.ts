import { describe, expect, it, vi } from 'vitest';
import {
  assistantPayouts,
  assistants,
  attendance,
  expenses,
  groups,
  payments,
  sessions,
  studentMonthlyRecords,
  students,
  teacherPayouts,
  teachers,
} from '../../database/schemas';
import { DashboardRepository } from './dashboard.repository';

vi.mock('./dashboard-classrooms.helper', () => ({
  queryClassroomsLiveSnapshot: vi.fn().mockResolvedValue([]),
}));

vi.mock('./dashboard-session-progress.helper', () => ({
  queryStudentSessionProgress: vi.fn().mockResolvedValue({
    totalTrackedEnrollments: 0,
    nearLastTotalCount: 0,
    lastOrCompletedTotalCount: 0,
    inProgressTotalCount: 0,
    notStartedTotalCount: 0,
    tracks: [],
    students: [],
  }),
}));

function createMockDb() {
  let executeIdx = 0;
  const executeResults = [
    { rows: [{ total_dues: '5000.00', total_center_share: '2750.25' }] },
    { rows: [{ total_dues: '1800.00' }] },
  ];

  let paymentsCall = 0;
  let smrCall = 0;

  return {
    select: () => ({
      from: (table: unknown) => {
        if (table === students) return Promise.resolve([{ totalStudents: 50, activeStudents: 45 }]);
        if (table === teachers) return Promise.resolve([{ teachersCount: 5 }]);
        if (table === assistants) return Promise.resolve([{ assistantsCount: 3 }]);
        if (table === groups) return Promise.resolve([{ groupsCount: 6, scheduledGroupsCount: 6 }]);

        const resolveWhere = () => {
          if (table === sessions) {
            return [{ totalSessions: 20, executedSessions: 10, scheduledSessions: 10 }];
          }
          if (table === studentMonthlyRecords) {
            smrCall += 1;
            if (smrCall === 1) {
              return [{ totalBillableSessions: 40, totalPaidSessions: 30, totalUnpaidSessions: 10 }];
            }
            if (smrCall === 2) {
              return [{ totalRevenue: '9000.00', totalReceivables: '1000.00' }];
            }
            return [];
          }
          if (table === payments) {
            paymentsCall += 1;
            return paymentsCall === 1
              ? [{ totalCollected: '8000.00' }]
              : [{ todayCollected: '500.00', todayCount: 2 }];
          }
          if (table === teacherPayouts) return [{ totalPaidOut: '4000.00' }];
          if (table === assistantPayouts) return [{ totalPaidOut: '1200.00' }];
          if (table === expenses) return [{ totalExpenses: '1500.00' }];
          return [];
        };

        return {
          where: () => {
            const resolved = resolveWhere();
            return Object.assign(Promise.resolve(resolved), {
              groupBy: async () => resolved,
            });
          },
          innerJoin: () => ({
            innerJoin: () => ({
              leftJoin: () => ({
                where: () => ({
                  orderBy: async () => [],
                }),
              }),
            }),
            where: async () => (table === attendance ? [{ present: 0, absent: 0, excused: 0 }] : []),
          }),
        };
      },
    }),
    execute: async () => executeResults[executeIdx++] ?? { rows: [] },
  };
}

describe('DashboardRepository - Center Net Profit', () => {
  it('sets netCenterResult directly to SUM(teacher_dues.center_amount) without deducting assistant dues or expenses', async () => {
    const repo = new DashboardRepository(createMockDb() as any);
    const summary = await repo.fetchExecutiveSummary('2026-11', '2026-11-27', '12:00');

    expect(summary.netCenterResult).toBe(2750.25);
    expect(summary.totalAssistantDues).toBe(1800);
    expect(summary.totalExpenses).toBe(1500);
    expect(summary.netCashFlow).toBe(1300);
  });
});
