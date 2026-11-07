import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, SystemRole } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardSummaryResponse } from './dashboard.types';

describe('DashboardService - Financial Metrics Guarding', () => {
  const dummyExecutiveSummary: DashboardSummaryResponse = {
    yearMonth: '2026-11',
    todayDate: '2026-11-07',
    totalStudents: 150,
    activeStudents: 140,
    teachersCount: 12,
    assistantsCount: 8,
    groupsCount: 20,
    todaySessionsCount: 5,
    todaySessions: [],
    todayAttendance: { present: 45, absent: 5, excused: 2, makeup: 3 },
    monthlySessionsStats: {
      totalSessions: 100,
      executedSessions: 50,
      scheduledSessions: 50,
      totalBillableSessions: 50,
      totalPaidSessions: 40,
      totalUnpaidSessions: 10,
      collectionRateSessions: 80,
    },
    totalRevenue: 50000,
    totalCollectedPayments: 42000,
    totalReceivables: 8000,
    totalTeacherDues: 25000,
    totalAssistantDues: 5000,
    totalExpenses: 7000,
    netCenterResult: 13000,
    netCashFlow: 10000,
    totalTeacherPaidOut: 20000,
    totalAssistantPaidOut: 5000,
    pendingBookingsCount: 3,
    upcomingAppointments: [],
    classroomsSummary: { total: 10, availableNow: 7, occupiedNow: 2, maintenance: 1 },
    classroomsLive: [],
  };

  const mockRepo = {
    fetchExecutiveSummary: vi.fn().mockResolvedValue(dummyExecutiveSummary),
  };
  const mockCache = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  };

  const service = new DashboardService(mockRepo as any, mockCache as any);

  it('returns full financial figures for OWNER', async () => {
    const owner: AuthenticatedUser = {
      id: 'owner-1',
      email: 'owner@test.com',
      fullName: 'Owner',
      roleCode: SystemRole.OWNER,
      permissions: [],
    };

    const res = await service.getSummary('2026-11', owner);
    expect(res.totalRevenue).toBe(50000);
    expect(res.totalCollectedPayments).toBe(42000);
    expect(res.totalReceivables).toBe(8000);
    expect(res.totalTeacherDues).toBe(25000);
    expect(res.totalAssistantDues).toBe(5000);
    expect(res.totalExpenses).toBe(7000);
    expect(res.netCenterResult).toBe(13000);
    expect(res.netCashFlow).toBe(10000);
    expect(res.totalStudents).toBe(150);
  });

  it('returns full financial figures for users with FINANCE_VIEW', async () => {
    const accountant: AuthenticatedUser = {
      id: 'acc-1',
      email: 'acc@test.com',
      fullName: 'Accountant',
      roleCode: SystemRole.ACCOUNTANT,
      permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.FINANCE_VIEW],
    };

    const res = await service.getSummary('2026-11', accountant);
    expect(res.totalRevenue).toBe(50000);
    expect(res.netCenterResult).toBe(13000);
  });

  it('masks financial figures to zero for users lacking FINANCE_VIEW', async () => {
    const manager: AuthenticatedUser = {
      id: 'mgr-1',
      email: 'mgr@test.com',
      fullName: 'Manager',
      roleCode: SystemRole.MANAGER,
      permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.STUDENTS_VIEW],
    };

    const res = await service.getSummary('2026-11', manager);
    expect(res.totalStudents).toBe(150);
    expect(res.todaySessionsCount).toBe(5);
    expect(res.totalRevenue).toBe(0);
    expect(res.totalCollectedPayments).toBe(0);
    expect(res.totalReceivables).toBe(0);
    expect(res.totalTeacherDues).toBe(0);
    expect(res.totalAssistantDues).toBe(0);
    expect(res.totalExpenses).toBe(0);
    expect(res.netCenterResult).toBe(0);
    expect(res.netCashFlow).toBe(0);
  });
});
