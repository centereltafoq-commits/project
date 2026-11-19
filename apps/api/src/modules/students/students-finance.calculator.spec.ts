import { describe, expect, it } from 'vitest';
import {
  AttendanceStatus,
  EnrollmentStatus,
  FullMonthAbsencePolicy,
} from '@edu-center/shared';
import { computeStudentMonthlyBreakdown } from './students-finance.calculator';
import {
  buildStudentMonthsOverview,
  classifyStudentMonthPaymentStatus,
} from './students-months-overview.builder';

describe('computeStudentMonthlyBreakdown', () => {
  it('bills full monthly subscription immediately regardless of attendance/absence while tracking academic counts', () => {
    const bundle: any = {
      monthlyRecords: [],
      monthAllocations: [],
      studentEnrollments: [
        {
          id: 'enr-1',
          groupId: 'grp-1',
          groupName: 'Group Alpha',
          status: EnrollmentStatus.ACTIVE,
          startDate: '2026-11-01',
          endDate: null,
          agreedMonthlyPrice: '200.00',
          agreedSessionsCount: 4,
          agreedSessionPrice: '50.00',
          fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
          fullAbsenceFixedFee: '0.00',
          chargeExcusedAbsence: false,
        },
      ],
      groupSessionsInMonth: [
        { id: 's-1', groupId: 'grp-1', sessionDate: '2026-11-05', status: 'COMPLETED' },
        { id: 's-2', groupId: 'grp-1', sessionDate: '2026-11-12', status: 'COMPLETED' },
        { id: 's-3', groupId: 'grp-1', sessionDate: '2026-11-19', status: 'COMPLETED' },
        { id: 's-4', groupId: 'grp-1', sessionDate: '2026-11-26', status: 'COMPLETED' },
      ],
      monthAttendance: [
        { groupId: 'grp-1', sessionId: 's-1', status: AttendanceStatus.PRESENT },
        { groupId: 'grp-1', sessionId: 's-2', status: AttendanceStatus.ABSENT },
        { groupId: 'grp-1', sessionId: 's-3', status: AttendanceStatus.ABSENT },
        { groupId: 'grp-1', sessionId: 's-4', status: AttendanceStatus.EXCUSED },
      ],
      studentPayments: [],
    };

    const result = computeStudentMonthlyBreakdown('2026-11', bundle);

    expect(result.breakdown).toHaveLength(1);
    const item = result.breakdown[0];
    expect(item.presentCount).toBe(1);
    expect(item.absentCount).toBe(2);
    expect(item.excusedCount).toBe(1);
    expect(item.sessionPrice).toBe(50);
    expect(item.totalDue).toBe(200);
    expect(item.remaining).toBe(200);
  });

  it('bills full monthly subscription immediately even before any sessions are created or executed', () => {
    const bundle: any = {
      monthlyRecords: [],
      monthAllocations: [],
      studentEnrollments: [
        {
          id: 'enr-1',
          groupId: 'grp-1',
          groupName: 'Group Beta',
          status: EnrollmentStatus.ACTIVE,
          startDate: '2026-11-19',
          endDate: null,
          agreedMonthlyPrice: '100.00',
          agreedSessionsCount: 4,
          agreedSessionPrice: '25.00',
          fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
          fullAbsenceFixedFee: '0.00',
          chargeExcusedAbsence: true,
        },
      ],
      groupSessionsInMonth: [],
      monthAttendance: [],
      studentPayments: [],
    };

    const result = computeStudentMonthlyBreakdown('2026-11', bundle);
    const item = result.breakdown[0];
    expect(item.totalDue).toBe(100);
    expect(item.remaining).toBe(100);
  });

  it('waives the exit month fee while keeping earlier active months owed (enrolled month 11, exited month 12)', () => {
    const enrollment = {
      id: 'enr-1',
      groupId: 'grp-1',
      groupName: 'Group Exit Test',
      status: EnrollmentStatus.CANCELLED,
      startDate: '2026-11-01',
      endDate: '2026-12-05',
      agreedMonthlyPrice: '100.00',
      agreedSessionsCount: 4,
      agreedSessionPrice: '25.00',
      fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
      fullAbsenceFixedFee: '0.00',
      chargeExcusedAbsence: false,
    };

    const novResult = computeStudentMonthlyBreakdown('2026-11', {
      monthlyRecords: [],
      monthAllocations: [],
      studentEnrollments: [enrollment],
      groupSessionsInMonth: [],
      monthAttendance: [],
      studentPayments: [],
    } as any);
    expect(novResult.breakdown[0].totalDue).toBe(100);
    expect(novResult.monthTotals.remaining).toBe(100);

    const decResult = computeStudentMonthlyBreakdown('2026-12', {
      monthlyRecords: [],
      monthAllocations: [],
      studentEnrollments: [enrollment],
      groupSessionsInMonth: [],
      monthAttendance: [],
      studentPayments: [],
    } as any);
    expect(decResult.breakdown[0].totalDue).toBe(0);
    expect(decResult.monthTotals.remaining).toBe(0);
  });

  it('clamps remaining balance to 0 on overpayment', () => {
    const bundle: any = {
      monthlyRecords: [],
      monthAllocations: [{ paymentId: 'p-1', groupId: 'grp-1', allocatedAmount: '250.00' }],
      studentEnrollments: [
        {
          id: 'enr-1',
          groupId: 'grp-1',
          groupName: 'Group Zeta',
          status: EnrollmentStatus.ACTIVE,
          startDate: '2026-11-01',
          endDate: null,
          agreedMonthlyPrice: '200.00',
          agreedSessionsCount: 4,
          agreedSessionPrice: '50.00',
          fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
          fullAbsenceFixedFee: '0.00',
          chargeExcusedAbsence: false,
        },
      ],
      groupSessionsInMonth: [],
      monthAttendance: [],
      studentPayments: [{ id: 'p-1', yearMonth: '2026-11', amount: '250.00' }],
    };

    const result = computeStudentMonthlyBreakdown('2026-11', bundle);
    const item = result.breakdown[0];
    expect(item.totalDue).toBe(200);
    expect(item.totalPaid).toBe(250);
    expect(item.remaining).toBe(0);
    expect(result.monthTotals.remaining).toBe(0);
  });

  it('correctly credits unallocated remainder of partially-allocated payments to monthTotals.totalPaid', () => {
    const bundle: any = {
      monthlyRecords: [],
      monthAllocations: [
        {
          paymentId: 'pay-part',
          groupId: 'grp-1',
          allocatedAmount: '600.00',
        },
      ],
      studentEnrollments: [
        {
          id: 'enr-1',
          groupId: 'grp-1',
          groupName: 'Group Allocated',
          status: EnrollmentStatus.ACTIVE,
          startDate: '2026-11-01',
          endDate: null,
          agreedMonthlyPrice: '800.00',
          agreedSessionsCount: 4,
          agreedSessionPrice: '200.00',
          fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
          fullAbsenceFixedFee: '0.00',
          chargeExcusedAbsence: false,
        },
      ],
      groupSessionsInMonth: [],
      monthAttendance: [],
      studentPayments: [
        {
          id: 'pay-part',
          yearMonth: '2026-11',
          amount: '1000.00',
        },
      ],
    };

    const result = computeStudentMonthlyBreakdown('2026-11', bundle);
    const item = result.breakdown[0];
    expect(item.totalDue).toBe(800);
    expect(item.totalPaid).toBe(600);
    expect(item.remaining).toBe(200);

    expect(result.monthTotals.totalDue).toBe(800);
    expect(result.monthTotals.totalPaid).toBe(1000);
    expect(result.monthTotals.remaining).toBe(0);
  });
});

describe('buildStudentMonthsOverview & classifyStudentMonthPaymentStatus', () => {
  it('classifies PAID, PARTIAL, UNPAID, and NO_DUES accurately', () => {
    expect(classifyStudentMonthPaymentStatus(0, 0, 0)).toBe('NO_DUES');
    expect(classifyStudentMonthPaymentStatus(200, 200, 0)).toBe('PAID');
    expect(classifyStudentMonthPaymentStatus(200, 120, 80)).toBe('PARTIAL');
    expect(classifyStudentMonthPaymentStatus(200, 0, 200)).toBe('UNPAID');
  });

  it('builds descending month-by-month overview preserving prior month debts after a later month exit', () => {
    const bundle: any = {
      monthlyRecords: [],
      monthAllocations: [],
      monthAttendance: [],
      groupSessionsInMonth: [],
      allMonthlyRecords: [],
      studentEnrollments: [
        {
          id: 'enr-1',
          groupId: 'grp-1',
          groupName: 'Group Math',
          status: EnrollmentStatus.CANCELLED,
          startDate: '2026-09-01',
          endDate: '2026-11-15',
          agreedMonthlyPrice: '200.00',
          agreedSessionsCount: 4,
          agreedSessionPrice: '50.00',
          fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
          fullAbsenceFixedFee: '0.00',
          chargeExcusedAbsence: false,
        },
      ],
      allGroupSessions: [
        { id: 's-sep-1', groupId: 'grp-1', yearMonth: '2026-09', sessionDate: '2026-09-05', status: 'COMPLETED' },
        { id: 's-oct-1', groupId: 'grp-1', yearMonth: '2026-10', sessionDate: '2026-10-05', status: 'COMPLETED' },
      ],
      allStudentAttendance: [
        { groupId: 'grp-1', sessionId: 's-sep-1', yearMonth: '2026-09', status: AttendanceStatus.PRESENT },
        { groupId: 'grp-1', sessionId: 's-oct-1', yearMonth: '2026-10', status: AttendanceStatus.PRESENT },
      ],
      allPaymentAllocations: [
        { paymentId: 'p-sep', groupId: 'grp-1', yearMonth: '2026-09', allocatedAmount: '200.00' },
        { paymentId: 'p-oct', groupId: 'grp-1', yearMonth: '2026-10', allocatedAmount: '100.00' },
      ],
      studentPayments: [
        { id: 'p-sep', yearMonth: '2026-09', amount: '200.00' },
        { id: 'p-oct', yearMonth: '2026-10', amount: '100.00' },
      ],
    };

    const overview = buildStudentMonthsOverview('2026-11', '2026-11', bundle);

    expect(overview.map((m) => m.yearMonth)).toEqual(['2026-11', '2026-10', '2026-09']);

    // Exited in 2026-11 -> 2026-11 fees removed
    const nov = overview.find((m) => m.yearMonth === '2026-11')!;
    expect(nov.paymentStatus).toBe('NO_DUES');
    expect(nov.totalDue).toBe(0);
    expect(nov.remaining).toBe(0);

    // Earlier active months still retain dues!
    const oct = overview.find((m) => m.yearMonth === '2026-10')!;
    expect(oct.paymentStatus).toBe('PARTIAL');
    expect(oct.totalDue).toBe(200);
    expect(oct.totalPaid).toBe(100);
    expect(oct.remaining).toBe(100);

    const sep = overview.find((m) => m.yearMonth === '2026-09')!;
    expect(sep.paymentStatus).toBe('PAID');
    expect(sep.totalDue).toBe(200);
    expect(sep.totalPaid).toBe(200);
    expect(sep.remaining).toBe(0);
  });
});
