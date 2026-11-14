import { describe, expect, it } from 'vitest';
import { GroupRevenueSplitMethod, SessionStatus } from '@edu-center/shared';
import {
  buildTeacherMonthSessions,
  buildTeacherMonthsOverview,
  classifyTeacherPayoutStatus,
  computeTeacherMonthlySummary,
} from './teachers-finance.calculator';

describe('computeTeacherMonthlySummary', () => {
  it('returns 0 dues when a group has 0 completed sessions in the month', () => {
    const bundle: any = {
      storedDues: [],
      storedMonthlyRecord: null,
      payouts: [],
      monthSessions: [
        { id: 's-1', groupId: 'grp-1', status: SessionStatus.SCHEDULED, teacherId: 't-1' },
      ],
      monthAttendanceCounts: [],
      assignedGroups: [
        {
          id: 'grp-1',
          name: 'Math Prep 3',
          isActive: true,
          activeStudentsCount: 20,
          monthlySessionsCount: 4,
          monthlyPrice: 400,
          calculatedSessionPrice: 100,
          revenueSplitMethod: GroupRevenueSplitMethod.FIXED_PER_STUDENT,
          teacherSharePerStudent: 300,
          centerSharePerStudent: 100,
          teacherPercentage: 0,
        },
      ],
    };

    const result = computeTeacherMonthlySummary('2026-11', bundle);

    expect(result.groups).toHaveLength(1);
    const grp = result.groups[0];
    expect(grp.executedSessionsCount).toBe(0);
    // Zero sessions completed must yield 0 teacher dues, NOT 20 * 300 = 6000!
    expect(grp.teacherShare).toBe(0);
    expect(grp.centerShare).toBe(0);
    expect(grp.grossRevenue).toBe(0);
    expect(result.totals.totalDues).toBe(0);
    expect(result.totals.remainingBalance).toBe(0);
  });

  it('calculates teacher share when sessions are executed and attendances exist', () => {
    const bundle: any = {
      storedDues: [],
      storedMonthlyRecord: null,
      payouts: [{ id: 'p-1', yearMonth: '2026-11', amount: '1500.00' }],
      monthSessions: [
        { id: 's-1', groupId: 'grp-1', status: SessionStatus.COMPLETED, teacherId: 't-1' },
        { id: 's-2', groupId: 'grp-1', status: SessionStatus.COMPLETED, teacherId: 't-1' },
      ],
      monthAttendanceCounts: [{ groupId: 'grp-1', presentEntries: 30 }],
      assignedGroups: [
        {
          id: 'grp-1',
          name: 'Physics Sec 1',
          isActive: true,
          activeStudentsCount: 15,
          monthlySessionsCount: 4,
          monthlyPrice: 400,
          calculatedSessionPrice: 100,
          revenueSplitMethod: GroupRevenueSplitMethod.CUSTOM_PERCENTAGE,
          teacherSharePerStudent: 0,
          centerSharePerStudent: 0,
          teacherPercentage: 70,
        },
      ],
    };

    const result = computeTeacherMonthlySummary('2026-11', bundle);
    const grp = result.groups[0];
    expect(grp.executedSessionsCount).toBe(2);
    // 30 attendances * 100 = 3000 gross; 70% of 3000 = 2100 to teacher, 900 to center
    expect(grp.grossRevenue).toBe(3000);
    expect(grp.teacherShare).toBe(2100);
    expect(grp.centerShare).toBe(900);
    // Payout of 1500 was paid -> remainingBalance = 2100 - 1500 = 600
    expect(result.totals.totalDues).toBe(2100);
    expect(result.totals.totalPayouts).toBe(1500);
    expect(result.totals.remainingBalance).toBe(600);
  });

  it('uses frozen storedDues when present (closed/recalculated month)', () => {
    const bundle: any = {
      storedDues: [
        {
          groupId: 'grp-1',
          groupName: 'Locked Chemistry',
          executedSessionsCount: 4,
          studentsCount: 18,
          grossGroupRevenue: '3600.00',
          teacherAmount: '2500.00',
          centerAmount: '1100.00',
          isLocked: true,
        },
      ],
      storedMonthlyRecord: {
        totalDues: '2500.00',
        totalPaidOut: '2500.00',
        remainingBalance: '0.00',
        isClosed: true,
      },
      payouts: [{ id: 'p-1', yearMonth: '2026-10', amount: '2500.00' }],
      monthSessions: [],
      monthAttendanceCounts: [],
      assignedGroups: [
        {
          id: 'grp-1',
          name: 'Locked Chemistry',
          isActive: true,
          activeStudentsCount: 25,
          monthlySessionsCount: 4,
          monthlyPrice: 500,
          calculatedSessionPrice: 125,
          revenueSplitMethod: GroupRevenueSplitMethod.CUSTOM_PERCENTAGE,
          teacherSharePerStudent: 0,
          centerSharePerStudent: 0,
          teacherPercentage: 50,
        },
      ],
    };

    const result = computeTeacherMonthlySummary('2026-10', bundle);
    const grp = result.groups[0];
    expect(grp.isLocked).toBe(true);
    expect(grp.teacherShare).toBe(2500);
    expect(grp.centerShare).toBe(1100);
    expect(result.totals.isClosed).toBe(true);
    expect(result.totals.remainingBalance).toBe(0);
  });

  it('clamps remaining balance to 0 when payouts exceed dues (advance payments)', () => {
    const bundle: any = {
      storedDues: [],
      storedMonthlyRecord: null,
      payouts: [{ id: 'p-1', yearMonth: '2026-11', amount: '3000.00' }],
      monthSessions: [
        { id: 's-1', groupId: 'grp-1', status: SessionStatus.COMPLETED, teacherId: 't-1' },
      ],
      monthAttendanceCounts: [{ groupId: 'grp-1', presentEntries: 10 }],
      assignedGroups: [
        {
          id: 'grp-1',
          name: 'History',
          isActive: true,
          activeStudentsCount: 10,
          monthlySessionsCount: 4,
          monthlyPrice: 200,
          calculatedSessionPrice: 50,
          revenueSplitMethod: GroupRevenueSplitMethod.CUSTOM_PERCENTAGE,
          teacherPercentage: 50,
        },
      ],
    };

    const result = computeTeacherMonthlySummary('2026-11', bundle);
    // 10 attendances * 50 = 500 gross; 50% = 250 dues
    expect(result.totals.totalDues).toBe(250);
    expect(result.totals.totalPayouts).toBe(3000);
    // 250 - 3000 = -2750 -> clamped to 0
    expect(result.totals.remainingBalance).toBe(0);
  });

  it('uses live recalculated dues for open months even when an older unlocked storedMonthlyRecord exists', () => {
    const bundle: any = {
      storedDues: [
        {
          groupId: 'grp-1',
          groupName: 'Open Math',
          executedSessionsCount: 1,
          studentsCount: 10,
          grossGroupRevenue: '1000.00',
          teacherAmount: '700.00',
          centerAmount: '300.00',
          isLocked: false,
        },
      ],
      storedMonthlyRecord: {
        totalDues: '700.00',
        totalPaidOut: '200.00',
        remainingBalance: '500.00',
        isClosed: false,
      },
      payouts: [{ id: 'p-1', yearMonth: '2026-11', amount: '200.00' }],
      monthSessions: [
        { id: 's-1', groupId: 'grp-1', status: SessionStatus.COMPLETED, teacherId: 't-1' },
        { id: 's-2', groupId: 'grp-1', status: SessionStatus.COMPLETED, teacherId: 't-1' },
      ],
      monthAttendanceCounts: [{ groupId: 'grp-1', presentEntries: 20 }],
      assignedGroups: [
        {
          id: 'grp-1',
          name: 'Open Math',
          isActive: true,
          activeStudentsCount: 10,
          monthlySessionsCount: 4,
          monthlyPrice: 400,
          calculatedSessionPrice: 100,
          revenueSplitMethod: GroupRevenueSplitMethod.CUSTOM_PERCENTAGE,
          teacherPercentage: 70,
        },
      ],
    };

    const result = computeTeacherMonthlySummary('2026-11', bundle);
    // 20 attendances * 100 = 2000 gross -> 70% = 1400 live dues (not stale 700)
    expect(result.totals.totalDues).toBe(1400);
    expect(result.totals.totalPayouts).toBe(200);
    expect(result.totals.remainingBalance).toBe(1200);
  });
});

describe('classifyTeacherPayoutStatus & buildTeacherMonthsOverview', () => {
  it('classifies PAID, PARTIAL, UNPAID, and NO_DUES accurately', () => {
    expect(classifyTeacherPayoutStatus(0, 0, 0)).toBe('NO_DUES');
    expect(classifyTeacherPayoutStatus(2000, 2000, 0)).toBe('PAID');
    expect(classifyTeacherPayoutStatus(2000, 800, 1200)).toBe('PARTIAL');
    expect(classifyTeacherPayoutStatus(2000, 0, 2000)).toBe('UNPAID');
  });

  it('builds descending monthsOverview with accurate payoutStatus and session counts across months', () => {
    const bundle: any = {
      assignedGroups: [
        {
          id: 'grp-1',
          name: 'Algebra 1',
          isActive: true,
          activeStudentsCount: 10,
          monthlySessionsCount: 4,
          monthlyPrice: 400,
          calculatedSessionPrice: 100,
          revenueSplitMethod: GroupRevenueSplitMethod.CUSTOM_PERCENTAGE,
          teacherPercentage: 70,
        },
      ],
      availability: [],
      storedDues: [],
      storedMonthlyRecord: null,
      payouts: [
        { id: 'p-1', yearMonth: '2026-09', amount: '1400.00' },
        { id: 'p-2', yearMonth: '2026-10', amount: '500.00' },
      ],
      monthSessions: [],
      monthAttendanceCounts: [],
      allStoredDues: [],
      allStoredMonthlyRecords: [],
      allGroupSessions: [
        {
          id: 's-sep-1',
          groupId: 'grp-1',
          groupName: 'Algebra 1',
          yearMonth: '2026-09',
          sessionDate: '2026-09-10',
          startTime: '16:00',
          endTime: '18:00',
          topic: 'Intro',
          status: SessionStatus.COMPLETED,
          teacherId: 't-1',
        },
        {
          id: 's-oct-1',
          groupId: 'grp-1',
          groupName: 'Algebra 1',
          yearMonth: '2026-10',
          sessionDate: '2026-10-12',
          startTime: '16:00',
          endTime: '18:00',
          topic: 'Linear Equations',
          status: SessionStatus.COMPLETED,
          teacherId: 't-1',
        },
        {
          id: 's-nov-1',
          groupId: 'grp-1',
          groupName: 'Algebra 1',
          yearMonth: '2026-11',
          sessionDate: '2026-11-05',
          startTime: '16:00',
          endTime: '18:00',
          topic: 'Quadratics',
          status: SessionStatus.COMPLETED,
          teacherId: 't-1',
        },
      ],
      allAttendanceCountsBySession: [
        { sessionId: 's-sep-1', groupId: 'grp-1', yearMonth: '2026-09', presentEntries: 20 },
        { sessionId: 's-oct-1', groupId: 'grp-1', yearMonth: '2026-10', presentEntries: 20 },
        { sessionId: 's-nov-1', groupId: 'grp-1', yearMonth: '2026-11', presentEntries: 20 },
      ],
    };

    const overview = buildTeacherMonthsOverview({
      requestedYearMonth: '2026-11',
      currentYearMonth: '2026-11',
      contractDate: '2026-08-01',
      bundle,
    });

    expect(overview.map((m) => m.yearMonth)).toEqual([
      '2026-11',
      '2026-10',
      '2026-09',
      '2026-08',
    ]);

    const nov = overview.find((m) => m.yearMonth === '2026-11')!;
    expect(nov.payoutStatus).toBe('UNPAID');
    expect(nov.executedSessionsCount).toBe(1);
    expect(nov.totalDues).toBe(1400);
    expect(nov.remainingBalance).toBe(1400);

    const oct = overview.find((m) => m.yearMonth === '2026-10')!;
    expect(oct.payoutStatus).toBe('PARTIAL');
    expect(oct.totalDues).toBe(1400);
    expect(oct.totalPayouts).toBe(500);
    expect(oct.remainingBalance).toBe(900);

    const sep = overview.find((m) => m.yearMonth === '2026-09')!;
    expect(sep.payoutStatus).toBe('PAID');
    expect(sep.totalDues).toBe(1400);
    expect(sep.totalPayouts).toBe(1400);
    expect(sep.remainingBalance).toBe(0);

    const aug = overview.find((m) => m.yearMonth === '2026-08')!;
    expect(aug.payoutStatus).toBe('NO_DUES');
    expect(aug.executedSessionsCount).toBe(0);
    expect(aug.totalDues).toBe(0);

    const novSessions = buildTeacherMonthSessions('2026-11', bundle);
    expect(novSessions).toHaveLength(1);
    expect(novSessions[0]?.topic).toBe('Quadratics');
    expect(novSessions[0]?.presentCount).toBe(20);
  });
});


