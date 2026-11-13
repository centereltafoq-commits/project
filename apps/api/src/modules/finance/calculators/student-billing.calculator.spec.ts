import { describe, expect, it } from 'vitest';
import {
  AttendanceStatus,
  FullMonthAbsencePolicy,
  SessionStatus,
} from '@edu-center/shared';
import { calculateStudentMonthlyBilling } from './student-billing.calculator';

const TEN_SESSIONS = Array.from({ length: 10 }, (_, idx) => ({
  id: `s-${idx + 1}`,
  sessionDate: `2026-10-${String((idx + 1) * 3).padStart(2, '0')}`, // 03, 06, 09, ..., 30
  status: SessionStatus.COMPLETED,
}));

describe('calculateStudentMonthlyBilling', () => {
  it('bills all executed group sessions independently of individual PRESENT/ABSENT/EXCUSED status while tracking attendance separately', () => {
    const result = calculateStudentMonthlyBilling({
      enrollment: {
        startDate: '2026-10-01',
        agreedMonthlyPrice: 180,
        agreedSessionsCount: 10,
      },
      policy: {
        fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
        fullAbsenceFixedFee: 0,
        chargeExcusedAbsence: false,
      },
      sessions: TEN_SESSIONS,
      attendances: [
        { sessionId: 's-1', status: AttendanceStatus.PRESENT },
        { sessionId: 's-2', status: AttendanceStatus.PRESENT },
        { sessionId: 's-3', status: AttendanceStatus.PRESENT },
        { sessionId: 's-4', status: AttendanceStatus.PRESENT },
        { sessionId: 's-5', status: AttendanceStatus.PRESENT },
        { sessionId: 's-6', status: AttendanceStatus.PRESENT },
        { sessionId: 's-7', status: AttendanceStatus.PRESENT },
        { sessionId: 's-8', status: AttendanceStatus.ABSENT },
        { sessionId: 's-9', status: AttendanceStatus.EXCUSED },
        { sessionId: 's-10', status: AttendanceStatus.ABSENT },
      ],
    });

    expect(result.sessionPriceSnapshot).toBe(18);
    expect(result.presentCount).toBe(7);
    expect(result.absentCount).toBe(2);
    expect(result.excusedCount).toBe(1);
    expect(result.attendedCount).toBe(7);
    expect(result.billableSessionsCount).toBe(10);
    expect(result.totalDue).toBe(180);
    expect(result.remainingBalance).toBe(180);
  });

  it('bills executed group sessions even when individual attendance sheet has not been recorded yet', () => {
    const result = calculateStudentMonthlyBilling({
      enrollment: {
        startDate: '2026-10-01',
        agreedMonthlyPrice: 180,
        agreedSessionsCount: 10,
      },
      policy: {
        fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
        fullAbsenceFixedFee: 0,
        chargeExcusedAbsence: false,
      },
      sessions: TEN_SESSIONS.slice(0, 3),
      attendances: [],
      currentTotalPaid: 40,
    });

    expect(result.presentCount).toBe(0);
    expect(result.eligibleSessions).toBe(3);
    expect(result.billableSessionsCount).toBe(3);
    expect(result.totalDue).toBe(54); // 3 * 18 = 54
    expect(result.remainingBalance).toBe(14);
  });

  it('enforces mid-month enrollment rule: sessions before startDate or after endDate are NEVER charged', () => {
    const result = calculateStudentMonthlyBilling({
      enrollment: {
        startDate: '2026-10-15', // Eligible from s-5 (2026-10-15) onwards
        endDate: '2026-10-27', // Up to s-9 (2026-10-27) -> 5 eligible sessions
        agreedMonthlyPrice: 180,
        agreedSessionsCount: 10,
      },
      policy: {
        fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
        fullAbsenceFixedFee: 0,
        chargeExcusedAbsence: false,
      },
      sessions: TEN_SESSIONS,
      attendances: [
        // Stray pre-enrollment record must be ignored!
        { sessionId: 's-1', status: AttendanceStatus.PRESENT },
        { sessionId: 's-5', status: AttendanceStatus.PRESENT },
        { sessionId: 's-6', status: AttendanceStatus.PRESENT },
        { sessionId: 's-7', status: AttendanceStatus.PRESENT },
        // Post-endDate record must also be ignored!
        { sessionId: 's-10', status: AttendanceStatus.PRESENT },
      ],
    });

    expect(result.totalGroupSessions).toBe(10);
    expect(result.eligibleSessions).toBe(5);
    expect(result.presentCount).toBe(3);
    expect(result.totalDue).toBe(90); // All 5 group sessions within enrollment dates: 5 * 18
  });

  it('bills students for completed group sessions regardless of all ABSENT marks or fullMonthAbsencePolicy', () => {
    const result = calculateStudentMonthlyBilling({
      enrollment: {
        startDate: '2026-10-01',
        agreedMonthlyPrice: 180,
        agreedSessionsCount: 10,
      },
      sessions: TEN_SESSIONS.slice(0, 4),
      attendances: TEN_SESSIONS.slice(0, 4).map((s) => ({
        sessionId: s.id,
        status: AttendanceStatus.ABSENT,
      })),
      policy: {
        fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
        fullAbsenceFixedFee: 50,
        chargeExcusedAbsence: false,
      },
    });
    expect(result.absentCount).toBe(4);
    expect(result.isFullMonthAbsenceApplied).toBe(false);
    expect(result.totalDue).toBe(72); // 4 group sessions * 18 = 72
  });

  it('preserves historical immutability when existingRecord.isClosed === true even if group prices rise', () => {
    const result = calculateStudentMonthlyBilling({
      enrollment: {
        startDate: '2026-10-01',
        agreedMonthlyPrice: 300, // Price later changed from 180 -> 300!
        agreedSessionsCount: 10,
        agreedSessionPrice: 30,
      },
      policy: {
        fullMonthAbsencePolicy: FullMonthAbsencePolicy.CHARGE_FULL_SUBSCRIPTION,
        fullAbsenceFixedFee: 100,
        chargeExcusedAbsence: true,
      },
      sessions: TEN_SESSIONS,
      attendances: TEN_SESSIONS.map((s) => ({
        sessionId: s.id,
        status: AttendanceStatus.PRESENT,
      })),
      currentTotalPaid: 100,
      existingRecord: {
        isClosed: true,
        totalGroupSessions: 10,
        eligibleSessions: 10,
        presentCount: 7,
        absentCount: 3,
        excusedCount: 0,
        sessionPriceSnapshot: 18,
        totalDue: 126,
        totalPaid: 50,
      },
    });

    expect(result.isClosed).toBe(true);
    expect(result.sessionPriceSnapshot).toBe(18);
    expect(result.totalDue).toBe(126);
    expect(result.totalPaid).toBe(100);
    expect(result.remainingBalance).toBe(26);
  });

  it('prevents penny rounding drift on full subscription packages with recurring fractions (e.g. 500 / 3)', () => {
    // 500 / 3 = 166.6666... In floating math 3 * 166.67 = 500.01
    // Our fix guarantees exact agreed monthly price 500.00!
    const threeSessions = [
      { id: 's-1', sessionDate: '2026-10-05', status: SessionStatus.COMPLETED },
      { id: 's-2', sessionDate: '2026-10-12', status: SessionStatus.COMPLETED },
      { id: 's-3', sessionDate: '2026-10-19', status: SessionStatus.COMPLETED },
    ];

    const result = calculateStudentMonthlyBilling({
      enrollment: {
        startDate: '2026-10-01',
        agreedMonthlyPrice: 500,
        agreedSessionsCount: 3,
      },
      policy: {
        fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
        fullAbsenceFixedFee: 0,
        chargeExcusedAbsence: false,
      },
      sessions: threeSessions,
      attendances: [
        { sessionId: 's-1', status: AttendanceStatus.PRESENT },
        { sessionId: 's-2', status: AttendanceStatus.PRESENT },
        { sessionId: 's-3', status: AttendanceStatus.PRESENT },
      ],
    });

    expect(result.billableSessionsCount).toBe(3);
    expect(result.sessionPriceSnapshot).toBe(166.67);
    expect(result.totalDue).toBe(500); // Exactly 500, NOT 500.01!
  });

  it('handles overpayments by flooring remainingBalance at 0 without negative balances', () => {
    const result = calculateStudentMonthlyBilling({
      enrollment: {
        startDate: '2026-10-01',
        agreedMonthlyPrice: 100,
        agreedSessionsCount: 2,
        agreedSessionPrice: 50,
      },
      policy: {
        fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
        fullAbsenceFixedFee: 0,
        chargeExcusedAbsence: false,
      },
      sessions: [
        { id: 's-1', sessionDate: '2026-10-05', status: SessionStatus.COMPLETED },
      ],
      attendances: [
        { sessionId: 's-1', status: AttendanceStatus.PRESENT },
      ],
      currentTotalPaid: 150, // 50 EGP overpaid
    });

    expect(result.totalDue).toBe(50);
    expect(result.totalPaid).toBe(150);
    expect(result.remainingBalance).toBe(0);
  });
});
