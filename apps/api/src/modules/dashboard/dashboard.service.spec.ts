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
    todayAttendance: { present: 45, absent: 5, excused: 2 },
    monthlySessionsStats: {
      totalSessions: 100,
      executedSessions: 50,
      scheduledSessions: 50,
      totalBillableSessions: 50,
      totalPaidSessions: 40,
      totalUnpaidSessions: 10,
      collectionRateSessions: 80,
    },
    monthlyPaymentStats: {
      paidStudentsCount: 95,
      unpaidStudentsCount: 25,
      totalBilledStudentsCount: 120,
      paidGroupsCount: 14,
      unpaidGroupsCount: 6,
      totalBilledGroupsCount: 20,
    },
    monthlySessionProgress: {
      totalTrackedEnrollments: 12,
      nearLastTotalCount: 4,
      lastOrCompletedTotalCount: 3,
      inProgressTotalCount: 4,
      notStartedTotalCount: 1,
      tracks: [
        {
          targetSessions: 4,
          totalEnrollments: 12,
          notStartedCount: 1,
          inProgressCount: 4,
          nearLastCount: 4,
          lastOrCompletedCount: 3,
          steps: [
            { stepNumber: 1, label: 'الحصة 1', isNearLast: false, isLast: false, studentsCount: 2 },
            { stepNumber: 2, label: 'الحصة 2', isNearLast: false, isLast: false, studentsCount: 2 },
            { stepNumber: 3, label: 'الحصة 3 (قبل الأخيرة)', isNearLast: true, isLast: false, studentsCount: 4 },
            { stepNumber: 4, label: 'الحصة 4 (الأخيرة)', isNearLast: false, isLast: true, studentsCount: 3 },
          ],
        },
      ],
      students: [
        {
          enrollmentId: 'enr-1',
          studentId: 'stu-1',
          studentName: 'أحمد',
          studentCode: 'ST-1',
          studentPhone: '010111',
          groupId: 'grp-1',
          groupName: 'فيزياء 4 حصص',
          groupCode: 'G-1',
          subject: 'فيزياء',
          attendedSessions: 3,
          targetSessions: 4,
          stepNumber: 3,
          status: 'NEAR_LAST',
          remainingBalance: 150,
        },
      ],
    },
    totalRevenue: 50000,
    totalCollectedPayments: 42000,
    todayCollectedPayments: 3500,
    todayPaymentsCount: 9,
    totalReceivables: 8000,
    totalTeacherDues: 25000,
    totalAssistantDues: 5000,
    totalExpenses: 7000,
    netCenterResult: 13000,
    netCashFlow: 10000,
    totalTeacherPaidOut: 20000,
    totalAssistantPaidOut: 5000,
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
    expect(res.todayCollectedPayments).toBe(3500);
    expect(res.todayPaymentsCount).toBe(9);
    expect(res.totalReceivables).toBe(8000);
    expect(res.totalTeacherDues).toBe(25000);
    expect(res.totalAssistantDues).toBe(5000);
    expect(res.totalExpenses).toBe(7000);
    expect(res.netCenterResult).toBe(13000);
    expect(res.netCashFlow).toBe(10000);
    expect(res.totalStudents).toBe(150);
    expect(res.monthlyPaymentStats).toEqual({
      paidStudentsCount: 95,
      unpaidStudentsCount: 25,
      totalBilledStudentsCount: 120,
      paidGroupsCount: 14,
      unpaidGroupsCount: 6,
      totalBilledGroupsCount: 20,
    });
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
    expect(res.todayCollectedPayments).toBe(0);
    expect(res.todayPaymentsCount).toBe(0);
    expect(res.totalReceivables).toBe(0);
    expect(res.totalTeacherDues).toBe(0);
    expect(res.totalAssistantDues).toBe(0);
    expect(res.totalExpenses).toBe(0);
    expect(res.netCenterResult).toBe(0);
    expect(res.netCashFlow).toBe(0);
    expect(res.monthlySessionsStats.executedSessions).toBe(50);
    expect(res.monthlySessionsStats.scheduledSessions).toBe(50);
    expect(res.monthlySessionsStats.totalBillableSessions).toBe(0);
    expect(res.monthlySessionsStats.totalPaidSessions).toBe(0);
    expect(res.monthlySessionsStats.totalUnpaidSessions).toBe(0);
    expect(res.monthlySessionsStats.collectionRateSessions).toBe(0);
    expect(res.monthlyPaymentStats).toEqual({
      paidStudentsCount: 0,
      unpaidStudentsCount: 0,
      totalBilledStudentsCount: 0,
      paidGroupsCount: 0,
      unpaidGroupsCount: 0,
      totalBilledGroupsCount: 0,
    });
    expect(res.classroomsSummary).toEqual({
      total: 0,
      availableNow: 0,
      occupiedNow: 0,
      maintenance: 0,
    });
    expect(res.classroomsLive).toEqual([]);
    expect(res.todaySessions).toEqual([]);
    expect(res.monthlySessionProgress.students[0].remainingBalance).toBe(0);
    expect(res.monthlySessionProgress.nearLastTotalCount).toBe(4);
  });

  it('masks classrooms payload while allowing authorized finance view separately', async () => {
    const accountant: AuthenticatedUser = {
      id: 'acc-2',
      email: 'acc2@test.com',
      fullName: 'Accountant',
      roleCode: SystemRole.ACCOUNTANT,
      permissions: [
        PERMISSIONS.DASHBOARD_VIEW,
        PERMISSIONS.FINANCE_VIEW,
        PERMISSIONS.ATTENDANCE_VIEW,
      ],
    };

    const res = await service.getSummary('2026-11', accountant);
    expect(res.totalRevenue).toBe(50000);
    expect(res.classroomsLive).toEqual([]);
    expect(res.classroomsSummary.total).toBe(0);
    expect(res.monthlySessionProgress.students[0].remainingBalance).toBe(150);
  });

  it('allows assistant with FINANCE_COLLECT_PAYMENT to view daily/monthly collections while zeroing profit & teacher dues', async () => {
    const assistant: AuthenticatedUser = {
      id: 'ast-1',
      email: '01099887766@assistant.local',
      fullName: 'أسيستنت التحصيل',
      roleCode: SystemRole.ASSISTANT,
      permissions: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.FINANCE_COLLECT_PAYMENT],
    };

    const res = await service.getSummary('2026-11', assistant);
    expect(res.todayCollectedPayments).toBe(3500);
    expect(res.todayPaymentsCount).toBe(9);
    expect(res.totalCollectedPayments).toBe(42000);
    expect(res.totalReceivables).toBe(8000);
    expect(res.monthlyPaymentStats.paidStudentsCount).toBe(95);
    expect(res.totalTeacherDues).toBe(0);
    expect(res.totalAssistantDues).toBe(0);
    expect(res.totalExpenses).toBe(0);
    expect(res.netCenterResult).toBe(0);
    expect(res.netCashFlow).toBe(0);
  });
});
