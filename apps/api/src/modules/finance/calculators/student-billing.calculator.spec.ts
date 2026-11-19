import { describe, expect, it } from 'vitest';
import {
  AttendanceStatus,
  EnrollmentStatus,
  FullMonthAbsencePolicy,
  SessionStatus,
} from '@edu-center/shared';
import { calculateStudentMonthlyBilling } from './student-billing.calculator';

const TEN_SESSIONS = Array.from({ length: 10 }, (_, idx) => ({
  id: `s-${idx + 1}`,
  sessionDate: `2026-10-${String((idx + 1) * 3).padStart(2, '0')}`,
  status: SessionStatus.COMPLETED,
}));

describe('calculateStudentMonthlyBilling', () => {
  it('bills full monthly fee immediately upon active enrollment even with zero sessions or zero attendance', () => {
    const result = calculateStudentMonthlyBilling({
      yearMonth: '2026-11',
      enrollment: {
        startDate: '2026-11-19',
        status: EnrollmentStatus.ACTIVE,
        agreedMonthlyPrice: 100,
        agreedSessionsCount: 4,
      },
      policy: {
        fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
        fullAbsenceFixedFee: 0,
        chargeExcusedAbsence: false,
      },
      sessions: [],
      attendances: [],
    });

    expect(result.presentCount).toBe(0);
    expect(result.eligibleSessions).toBe(0);
    expect(result.totalDue).toBe(100);
    expect(result.remainingBalance).toBe(100);
  });

  it('decouples monthly fee from attendance/absence status while still tracking academic counts accurately', () => {
    const result = calculateStudentMonthlyBilling({
      yearMonth: '2026-10',
      enrollment: {
        startDate: '2026-10-01',
        status: EnrollmentStatus.ACTIVE,
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
        { sessionId: 's-4', status: AttendanceStatus.ABSENT },
        { sessionId: 's-5', status: AttendanceStatus.EXCUSED },
      ],
    });

    expect(result.sessionPriceSnapshot).toBe(18);
    expect(result.presentCount).toBe(3);
    expect(result.absentCount).toBe(1);
    expect(result.excusedCount).toBe(1);
    expect(result.totalDue).toBe(180);
    expect(result.remainingBalance).toBe(180);
  });

  it('removes monthly charge when student exits (CANCELLED or PAUSED) during that same month', () => {
    const cancelledSameMonth = calculateStudentMonthlyBilling({
      yearMonth: '2026-11',
      enrollment: {
        startDate: '2026-11-01',
        endDate: '2026-11-19',
        status: EnrollmentStatus.CANCELLED,
        agreedMonthlyPrice: 100,
        agreedSessionsCount: 4,
      },
      policy: {
        fullMonthAbsencePolicy: FullMonthAbsencePolicy.CHARGE_FULL_SUBSCRIPTION,
        fullAbsenceFixedFee: 50,
        chargeExcusedAbsence: false,
      },
      sessions: [{ id: 's-1', sessionDate: '2026-11-05', status: SessionStatus.COMPLETED }],
      attendances: [{ sessionId: 's-1', status: AttendanceStatus.PRESENT }],
    });

    expect(cancelledSameMonth.presentCount).toBe(1);
    expect(cancelledSameMonth.totalDue).toBe(0);
    expect(cancelledSameMonth.remainingBalance).toBe(0);

    const pausedSameMonth = calculateStudentMonthlyBilling({
      yearMonth: '2026-11',
      enrollment: {
        startDate: '2026-11-01',
        endDate: '2026-11-10',
        status: EnrollmentStatus.PAUSED,
        agreedMonthlyPrice: 100,
        agreedSessionsCount: 4,
      },
      policy: {
        fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
        fullAbsenceFixedFee: 0,
        chargeExcusedAbsence: false,
      },
      sessions: [],
      attendances: [],
    });

    expect(pausedSameMonth.totalDue).toBe(0);
  });

  it('keeps prior month dues intact when student enrolled in month 11 and exited in month 12', () => {
    const enrollment = {
      startDate: '2026-11-01',
      endDate: '2026-12-05',
      status: EnrollmentStatus.CANCELLED,
      agreedMonthlyPrice: 100,
      agreedSessionsCount: 4,
    };
    const policy = {
      fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
      fullAbsenceFixedFee: 0,
      chargeExcusedAbsence: false,
    };

    const month11 = calculateStudentMonthlyBilling({
      yearMonth: '2026-11',
      enrollment,
      policy,
      sessions: [],
      attendances: [],
    });
    expect(month11.totalDue).toBe(100);
    expect(month11.remainingBalance).toBe(100);

    const month12 = calculateStudentMonthlyBilling({
      yearMonth: '2026-12',
      enrollment,
      policy,
      sessions: [],
      attendances: [],
    });
    expect(month12.totalDue).toBe(0);

    const month13 = calculateStudentMonthlyBilling({
      yearMonth: '2027-01',
      enrollment,
      policy,
      sessions: [],
      attendances: [],
    });
    expect(month13.totalDue).toBe(0);
  });

  it('preserves historical immutability when existingRecord.isClosed === true even if group prices rise', () => {
    const result = calculateStudentMonthlyBilling({
      yearMonth: '2026-10',
      enrollment: {
        startDate: '2026-10-01',
        status: EnrollmentStatus.ACTIVE,
        agreedMonthlyPrice: 300,
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
    const threeSessions = [
      { id: 's-1', sessionDate: '2026-10-05', status: SessionStatus.COMPLETED },
      { id: 's-2', sessionDate: '2026-10-12', status: SessionStatus.COMPLETED },
      { id: 's-3', sessionDate: '2026-10-19', status: SessionStatus.COMPLETED },
    ];

    const result = calculateStudentMonthlyBilling({
      yearMonth: '2026-10',
      enrollment: {
        startDate: '2026-10-01',
        status: EnrollmentStatus.ACTIVE,
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

    expect(result.sessionPriceSnapshot).toBe(166.67);
    expect(result.totalDue).toBe(500);
  });

  it('handles overpayments by flooring remainingBalance at 0 without negative balances', () => {
    const result = calculateStudentMonthlyBilling({
      yearMonth: '2026-10',
      enrollment: {
        startDate: '2026-10-01',
        status: EnrollmentStatus.ACTIVE,
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
      currentTotalPaid: 150,
    });

    expect(result.totalDue).toBe(100);
    expect(result.totalPaid).toBe(150);
    expect(result.remainingBalance).toBe(0);
  });
});
