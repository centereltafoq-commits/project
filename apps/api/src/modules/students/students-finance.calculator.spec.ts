import { describe, expect, it } from 'vitest';
import {
  AttendanceStatus,
  FullMonthAbsencePolicy,
} from '@edu-center/shared';
import { computeStudentMonthlyBreakdown } from './students-finance.calculator';

describe('computeStudentMonthlyBreakdown', () => {
  it('charges only attended sessions and does not bill unexcused absences', () => {
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
      studentMakeups: [],
    };

    const result = computeStudentMonthlyBreakdown('2026-11', bundle);

    expect(result.breakdown).toHaveLength(1);
    const item = result.breakdown[0];
    expect(item.presentCount).toBe(1);
    expect(item.absentCount).toBe(2);
    expect(item.excusedCount).toBe(1);
    expect(item.sessionPrice).toBe(50);
    // Student attended 1 session, excused is not charged -> totalDue should be 1 * 50 = 50, NOT 150 or 200
    expect(item.totalDue).toBe(50);
    expect(item.remaining).toBe(50);
  });

  it('charges excused absences when chargeExcusedAbsence is true', () => {
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
      ],
      monthAttendance: [
        { groupId: 'grp-1', sessionId: 's-1', status: AttendanceStatus.PRESENT },
        { groupId: 'grp-1', sessionId: 's-2', status: AttendanceStatus.EXCUSED },
      ],
      studentPayments: [],
      studentMakeups: [],
    };

    const result = computeStudentMonthlyBreakdown('2026-11', bundle);
    const item = result.breakdown[0];
    // 1 present + 1 excused = 2 chargeable * 50 = 100
    expect(item.totalDue).toBe(100);
  });

  it('charges fixed reservation fee on full-month absence if policy is CHARGE_FIXED_RESERVATION_FEE', () => {
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
      studentMakeups: [],
    };

    const result = computeStudentMonthlyBreakdown('2026-11', bundle);
    const item = result.breakdown[0];
    expect(item.totalDue).toBe(75);
  });

  it('calculates session price from agreedMonthlyPrice / agreedSessionsCount when agreedSessionPrice is missing or zero', () => {
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
      studentMakeups: [],
    };

    const result = computeStudentMonthlyBreakdown('2026-11', bundle);
    const item = result.breakdown[0];
    // 300 / 6 = 50 per session, 1 attended -> 50
    expect(item.sessionPrice).toBe(50);
    expect(item.totalDue).toBe(50);
  });

  it('charges full subscription amount when policy is CHARGE_FULL_SUBSCRIPTION on full-month absence', () => {
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
      studentMakeups: [],
    };

    const result = computeStudentMonthlyBreakdown('2026-11', bundle);
    const item = result.breakdown[0];
    // Cancelled session s-3 is excluded
    expect(item.totalSessions).toBe(2);
    // Student absent full month, charged full agreed monthly price
    expect(item.totalDue).toBe(400);
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
      studentMakeups: [],
    };

    const result = computeStudentMonthlyBreakdown('2026-11', bundle);
    const item = result.breakdown[0];
    expect(item.totalDue).toBe(50);
    expect(item.totalPaid).toBe(150);
    expect(item.remaining).toBe(0);
    expect(result.monthTotals.remaining).toBe(0);
  });
});
