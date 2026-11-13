import { describe, expect, it } from 'vitest';
import {
  AttendanceStatus,
  FullMonthAbsencePolicy,
} from '@edu-center/shared';
import { computeStudentMonthlyBreakdown } from './students-finance.calculator';

describe('computeStudentMonthlyBreakdown', () => {
  it('bills all completed group sessions regardless of individual ABSENT/EXCUSED attendance while tracking academic counts separately', () => {
    const bundle: any = {
      monthlyRecords: [],
      monthAllocations: [],
      studentEnrollments: [
        {
          id: 'enr-1',
          groupId: 'grp-1',
          groupName: 'Group Alpha',
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
    // Group completed 4 sessions -> all enrolled students owe 4 * 50 = 200 regardless of absence/excused
    expect(item.totalDue).toBe(200);
    expect(item.remaining).toBe(200);
  });

  it('bills completed group sessions automatically even when individual attendance sheet is empty', () => {
    const bundle: any = {
      monthlyRecords: [],
      monthAllocations: [],
      studentEnrollments: [
        {
          id: 'enr-1',
          groupId: 'grp-1',
          groupName: 'Group Beta',
          startDate: '2026-11-01',
          endDate: null,
          agreedMonthlyPrice: '200.00',
          agreedSessionsCount: 4,
          agreedSessionPrice: '50.00',
          fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
          fullAbsenceFixedFee: '0.00',
          chargeExcusedAbsence: true,
        },
      ],
      groupSessionsInMonth: [
        { id: 's-1', groupId: 'grp-1', sessionDate: '2026-11-05', status: 'COMPLETED' },
        { id: 's-2', groupId: 'grp-1', sessionDate: '2026-11-12', status: 'COMPLETED' },
        { id: 's-3', groupId: 'grp-1', sessionDate: '2026-11-19', status: 'SCHEDULED' },
      ],
      monthAttendance: [],
      studentPayments: [],
    };

    const result = computeStudentMonthlyBreakdown('2026-11', bundle);
    const item = result.breakdown[0];
    expect(item.presentCount).toBe(0);
    // Only COMPLETED sessions (s-1, s-2) are billed = 2 * 50 = 100; SCHEDULED (s-3) is not billed yet
    expect(item.totalDue).toBe(100);
  });

  it('decouples billing from full-month absence policies and charges completed group sessions normally', () => {
    const bundle: any = {
      monthlyRecords: [],
      monthAllocations: [],
      studentEnrollments: [
        {
          id: 'enr-1',
          groupId: 'grp-1',
          groupName: 'Group Gamma',
          startDate: '2026-11-01',
          endDate: null,
          agreedMonthlyPrice: '200.00',
          agreedSessionsCount: 4,
          agreedSessionPrice: '50.00',
          fullMonthAbsencePolicy: FullMonthAbsencePolicy.CHARGE_FIXED_RESERVATION_FEE,
          fullAbsenceFixedFee: '75.00',
          chargeExcusedAbsence: false,
        },
      ],
      groupSessionsInMonth: [
        { id: 's-1', groupId: 'grp-1', sessionDate: '2026-11-05', status: 'COMPLETED' },
        { id: 's-2', groupId: 'grp-1', sessionDate: '2026-11-12', status: 'COMPLETED' },
      ],
      monthAttendance: [
        { groupId: 'grp-1', sessionId: 's-1', status: AttendanceStatus.ABSENT },
        { groupId: 'grp-1', sessionId: 's-2', status: AttendanceStatus.ABSENT },
      ],
      studentPayments: [],
    };

    const result = computeStudentMonthlyBreakdown('2026-11', bundle);
    const item = result.breakdown[0];
    expect(item.totalDue).toBe(100);
  });

  it('calculates session price from agreedMonthlyPrice / agreedSessionsCount and bills all completed group sessions', () => {
    const bundle: any = {
      monthlyRecords: [],
      monthAllocations: [],
      studentEnrollments: [
        {
          id: 'enr-1',
          groupId: 'grp-1',
          groupName: 'Group Delta',
          startDate: '2026-11-01',
          endDate: null,
          agreedMonthlyPrice: '300.00',
          agreedSessionsCount: 6,
          agreedSessionPrice: '0.00',
          fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
          fullAbsenceFixedFee: '0.00',
          chargeExcusedAbsence: false,
        },
      ],
      groupSessionsInMonth: [
        { id: 's-1', groupId: 'grp-1', sessionDate: '2026-11-05', status: 'COMPLETED' },
        { id: 's-2', groupId: 'grp-1', sessionDate: '2026-11-12', status: 'COMPLETED' },
      ],
      monthAttendance: [
        { groupId: 'grp-1', sessionId: 's-1', status: AttendanceStatus.PRESENT },
        { groupId: 'grp-1', sessionId: 's-2', status: AttendanceStatus.ABSENT },
      ],
      studentPayments: [],
    };

    const result = computeStudentMonthlyBreakdown('2026-11', bundle);
    const item = result.breakdown[0];
    // 300 / 6 = 50 per session, 2 completed group sessions -> 100
    expect(item.sessionPrice).toBe(50);
    expect(item.totalDue).toBe(100);
  });

  it('excludes cancelled sessions and bills completed group sessions regardless of absence policy', () => {
    const bundle: any = {
      monthlyRecords: [],
      monthAllocations: [],
      studentEnrollments: [
        {
          id: 'enr-1',
          groupId: 'grp-1',
          groupName: 'Group Epsilon',
          startDate: '2026-11-01',
          endDate: null,
          agreedMonthlyPrice: '400.00',
          agreedSessionsCount: 4,
          agreedSessionPrice: '100.00',
          fullMonthAbsencePolicy: FullMonthAbsencePolicy.CHARGE_FULL_SUBSCRIPTION,
          fullAbsenceFixedFee: '0.00',
          chargeExcusedAbsence: false,
        },
      ],
      groupSessionsInMonth: [
        { id: 's-1', groupId: 'grp-1', sessionDate: '2026-11-05', status: 'COMPLETED' },
        { id: 's-2', groupId: 'grp-1', sessionDate: '2026-11-12', status: 'COMPLETED' },
        { id: 's-3', groupId: 'grp-1', sessionDate: '2026-11-19', status: 'CANCELLED' },
      ],
      monthAttendance: [
        { groupId: 'grp-1', sessionId: 's-1', status: AttendanceStatus.ABSENT },
        { groupId: 'grp-1', sessionId: 's-2', status: AttendanceStatus.ABSENT },
      ],
      studentPayments: [],
    };

    const result = computeStudentMonthlyBreakdown('2026-11', bundle);
    const item = result.breakdown[0];
    // Cancelled session s-3 is excluded
    expect(item.totalSessions).toBe(2);
    // 2 completed group sessions * 100 = 200
    expect(item.totalDue).toBe(200);
  });

  it('clamps remaining balance to 0 on overpayment', () => {
    const bundle: any = {
      monthlyRecords: [],
      monthAllocations: [{ paymentId: 'p-1', groupId: 'grp-1', allocatedAmount: '150.00' }],
      studentEnrollments: [
        {
          id: 'enr-1',
          groupId: 'grp-1',
          groupName: 'Group Zeta',
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
      ],
      monthAttendance: [
        { groupId: 'grp-1', sessionId: 's-1', status: AttendanceStatus.PRESENT },
      ],
      studentPayments: [{ id: 'p-1', yearMonth: '2026-11', amount: '150.00' }],
    };

    const result = computeStudentMonthlyBreakdown('2026-11', bundle);
    const item = result.breakdown[0];
    expect(item.totalDue).toBe(50);
    expect(item.totalPaid).toBe(150);
    expect(item.remaining).toBe(0);
    expect(result.monthTotals.remaining).toBe(0);
  });

  it('prevents penny rounding drift on full subscription packages with recurring fractions (e.g. 500 / 3)', () => {
    const bundle: any = {
      monthlyRecords: [],
      monthAllocations: [],
      studentEnrollments: [
        {
          id: 'enr-1',
          groupId: 'grp-1',
          groupName: 'Group Recurring',
          startDate: '2026-11-01',
          endDate: null,
          agreedMonthlyPrice: '500.00',
          agreedSessionsCount: 3,
          agreedSessionPrice: '0.00',
          fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
          fullAbsenceFixedFee: '0.00',
          chargeExcusedAbsence: false,
        },
      ],
      groupSessionsInMonth: [
        { id: 's-1', groupId: 'grp-1', sessionDate: '2026-11-05', status: 'COMPLETED' },
        { id: 's-2', groupId: 'grp-1', sessionDate: '2026-11-12', status: 'COMPLETED' },
        { id: 's-3', groupId: 'grp-1', sessionDate: '2026-11-19', status: 'COMPLETED' },
      ],
      monthAttendance: [
        { groupId: 'grp-1', sessionId: 's-1', status: AttendanceStatus.PRESENT },
        { groupId: 'grp-1', sessionId: 's-2', status: AttendanceStatus.PRESENT },
        { groupId: 'grp-1', sessionId: 's-3', status: AttendanceStatus.PRESENT },
      ],
      studentPayments: [],
    };

    const result = computeStudentMonthlyBreakdown('2026-11', bundle);
    const item = result.breakdown[0];
    expect(item.presentCount).toBe(3);
    // Exactly 500.00, not 500.01
    expect(item.totalDue).toBe(500);
    expect(result.monthTotals.totalDue).toBe(500);
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
      groupSessionsInMonth: [
        { id: 's-1', groupId: 'grp-1', sessionDate: '2026-11-05', status: 'COMPLETED' },
        { id: 's-2', groupId: 'grp-1', sessionDate: '2026-11-12', status: 'COMPLETED' },
        { id: 's-3', groupId: 'grp-1', sessionDate: '2026-11-19', status: 'COMPLETED' },
        { id: 's-4', groupId: 'grp-1', sessionDate: '2026-11-26', status: 'COMPLETED' },
      ],
      monthAttendance: [
        { groupId: 'grp-1', sessionId: 's-1', status: AttendanceStatus.PRESENT },
        { groupId: 'grp-1', sessionId: 's-2', status: AttendanceStatus.PRESENT },
        { groupId: 'grp-1', sessionId: 's-3', status: AttendanceStatus.PRESENT },
        { groupId: 'grp-1', sessionId: 's-4', status: AttendanceStatus.PRESENT },
      ],
      studentPayments: [
        {
          id: 'pay-part',
          yearMonth: '2026-11',
          amount: '1000.00', // 1000 paid: 600 to grp-1, 400 unallocated credit
        },
      ],
    };

    const result = computeStudentMonthlyBreakdown('2026-11', bundle);
    const item = result.breakdown[0];
    // grp-1 totalDue is 800, allocated paid is 600, remaining is 200
    expect(item.totalDue).toBe(800);
    expect(item.totalPaid).toBe(600);
    expect(item.remaining).toBe(200);

    // monthTotals must count the full 1000 paid (600 allocated + 400 unallocated)
    expect(result.monthTotals.totalDue).toBe(800);
    expect(result.monthTotals.totalPaid).toBe(1000);
    // Student overall has 0 remaining debt because they paid 1000 against 800
    expect(result.monthTotals.remaining).toBe(0);
  });
});
