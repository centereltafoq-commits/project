import {
  AttendanceStatus,
  FullMonthAbsencePolicy,
  MakeupStatus,
  SessionStatus,
} from '@edu-center/shared';
import { roundMoney } from '../utils/money.util';

export interface StudentBillingEnrollmentInput {
  startDate: string; // YYYY-MM-DD
  endDate?: string | null; // YYYY-MM-DD
  agreedMonthlyPrice: number;
  agreedSessionsCount: number;
  agreedSessionPrice?: number;
}

export interface StudentBillingPolicyInput {
  fullMonthAbsencePolicy: FullMonthAbsencePolicy | string;
  fullAbsenceFixedFee: number;
  chargeExcusedAbsence: boolean;
}

export interface GroupSessionBillingInput {
  id: string;
  sessionDate: string; // YYYY-MM-DD
  status?: SessionStatus | string;
}

export interface StudentAttendanceBillingInput {
  sessionId: string;
  status: AttendanceStatus | string;
}

export interface StudentMakeupBillingInput {
  isFree: boolean;
  extraFee: number;
  status?: MakeupStatus | string;
}

export interface ExistingStudentMonthlySnapshot {
  isClosed: boolean;
  totalGroupSessions: number;
  eligibleSessions: number;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  makeupAttendedCount: number;
  sessionPriceSnapshot: number;
  extraMakeupFees: number;
  totalDue: number;
  totalPaid: number;
}

export interface CalculateStudentBillingParams {
  enrollment: StudentBillingEnrollmentInput;
  policy: StudentBillingPolicyInput;
  sessions: GroupSessionBillingInput[];
  attendances: StudentAttendanceBillingInput[];
  makeups?: StudentMakeupBillingInput[];
  extraMakeupFees?: number;
  currentTotalPaid?: number;
  existingRecord?: ExistingStudentMonthlySnapshot | null;
}

export interface StudentMonthlyBillingResult {
  totalGroupSessions: number;
  eligibleSessions: number;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  makeupAttendedCount: number;
  attendedCount: number;
  billableSessionsCount: number;
  sessionPriceSnapshot: number;
  extraMakeupFees: number;
  totalDue: number;
  totalPaid: number;
  remainingBalance: number;
  isFullMonthAbsenceApplied: boolean;
  isClosed: boolean;
}

export function calculateStudentMonthlyBilling(
  params: CalculateStudentBillingParams,
): StudentMonthlyBillingResult {
  const {
    enrollment,
    policy,
    sessions,
    attendances,
    makeups = [],
    extraMakeupFees = 0,
    currentTotalPaid,
    existingRecord,
  } = params;

  // Historical Immutability Rule: NEVER overwrite closed month snapshots or totalDue
  if (existingRecord?.isClosed) {
    const lockedSessionPrice = roundMoney(existingRecord.sessionPriceSnapshot);
    const lockedExtraFees = roundMoney(existingRecord.extraMakeupFees);
    const lockedTotalDue = roundMoney(existingRecord.totalDue);
    const totalPaid = roundMoney(currentTotalPaid ?? existingRecord.totalPaid);
    const attendedCount = existingRecord.presentCount + existingRecord.makeupAttendedCount;
    const isFullMonthAbsence = attendedCount === 0 && lockedTotalDue > 0;

    return {
      totalGroupSessions: existingRecord.totalGroupSessions,
      eligibleSessions: existingRecord.eligibleSessions,
      presentCount: existingRecord.presentCount,
      absentCount: existingRecord.absentCount,
      excusedCount: existingRecord.excusedCount,
      makeupAttendedCount: existingRecord.makeupAttendedCount,
      attendedCount,
      billableSessionsCount:
        attendedCount + (policy.chargeExcusedAbsence ? existingRecord.excusedCount : 0),
      sessionPriceSnapshot: lockedSessionPrice,
      extraMakeupFees: lockedExtraFees,
      totalDue: lockedTotalDue,
      totalPaid,
      remainingBalance: roundMoney(Math.max(0, lockedTotalDue - totalPaid)),
      isFullMonthAbsenceApplied: isFullMonthAbsence,
      isClosed: true,
    };
  }

  const activeSessions = sessions.filter((s) => s.status !== SessionStatus.CANCELLED);
  const totalGroupSessions = activeSessions.length;

  // Mid-month rule: only sessions on/after enrollment.startDate (and <= endDate if set)
  const eligibleSessionList = activeSessions.filter(
    (s) =>
      s.sessionDate >= enrollment.startDate &&
      (!enrollment.endDate || s.sessionDate <= enrollment.endDate),
  );
  const eligibleSessions = eligibleSessionList.length;

  const attendanceMap = new Map<string, string>();
  for (const record of attendances) {
    attendanceMap.set(record.sessionId, record.status);
  }

  let presentCount = 0;
  let absentCount = 0;
  let excusedCount = 0;
  let makeupAttendedCount = 0;

  for (const session of eligibleSessionList) {
    const status = attendanceMap.get(session.id);
    if (status === AttendanceStatus.PRESENT) presentCount += 1;
    else if (status === AttendanceStatus.MAKEUP_ATTENDED) makeupAttendedCount += 1;
    else if (status === AttendanceStatus.EXCUSED) excusedCount += 1;
    else if (status === AttendanceStatus.ABSENT) absentCount += 1;
  }

  const sessionPriceSnapshot =
    enrollment.agreedSessionPrice !== undefined && enrollment.agreedSessionPrice > 0
      ? roundMoney(enrollment.agreedSessionPrice)
      : enrollment.agreedSessionsCount > 0
        ? roundMoney(enrollment.agreedMonthlyPrice / enrollment.agreedSessionsCount)
        : 0;

  const completedMakeupsCount = makeups.filter(
    (m) => m.status === MakeupStatus.COMPLETED,
  ).length;
  const effectiveMakeupAttendedCount = Math.max(makeupAttendedCount, completedMakeupsCount);
  const attendedCount = presentCount + effectiveMakeupAttendedCount;
  const billableSessionsCount =
    attendedCount + (policy.chargeExcusedAbsence ? excusedCount : 0);

  const computedMakeupFees = makeups
    .filter((m) => !m.isFree && m.status !== MakeupStatus.CANCELLED)
    .reduce((sum, m) => sum + roundMoney(m.extraFee), 0);
  const totalExtraMakeupFees = roundMoney(extraMakeupFees + computedMakeupFees);

  let baseDue = 0;
  let isFullMonthAbsenceApplied = false;

  if (
    eligibleSessions > 0 &&
    attendedCount === 0 &&
    (!policy.chargeExcusedAbsence || excusedCount === 0)
  ) {
    isFullMonthAbsenceApplied = true;
    switch (policy.fullMonthAbsencePolicy) {
      case FullMonthAbsencePolicy.CHARGE_FULL_SUBSCRIPTION:
        baseDue =
          enrollment.agreedMonthlyPrice > 0
            ? roundMoney(enrollment.agreedMonthlyPrice)
            : roundMoney(enrollment.agreedSessionsCount * sessionPriceSnapshot);
        break;
      case FullMonthAbsencePolicy.CHARGE_FIXED_RESERVATION_FEE:
        baseDue = roundMoney(policy.fullAbsenceFixedFee);
        break;
      case FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE:
      default:
        baseDue = 0;
        break;
    }
  } else if (
    billableSessionsCount === enrollment.agreedSessionsCount &&
    enrollment.agreedMonthlyPrice > 0 &&
    (enrollment.agreedSessionPrice === undefined || enrollment.agreedSessionPrice <= 0)
  ) {
    baseDue = roundMoney(enrollment.agreedMonthlyPrice);
  } else {
    baseDue = roundMoney(billableSessionsCount * sessionPriceSnapshot);
  }

  const totalDue = roundMoney(baseDue + totalExtraMakeupFees);
  const totalPaid = roundMoney(currentTotalPaid ?? existingRecord?.totalPaid ?? 0);
  const remainingBalance = roundMoney(Math.max(0, totalDue - totalPaid));

  return {
    totalGroupSessions,
    eligibleSessions,
    presentCount,
    absentCount,
    excusedCount,
    makeupAttendedCount: effectiveMakeupAttendedCount,
    attendedCount,
    billableSessionsCount,
    sessionPriceSnapshot,
    extraMakeupFees: totalExtraMakeupFees,
    totalDue,
    totalPaid,
    remainingBalance,
    isFullMonthAbsenceApplied,
    isClosed: false,
  };
}
