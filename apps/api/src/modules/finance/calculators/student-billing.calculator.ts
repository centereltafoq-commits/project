import {
  AttendanceStatus,
  FullMonthAbsencePolicy,
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

export interface ExistingStudentMonthlySnapshot {
  isClosed: boolean;
  totalGroupSessions: number;
  eligibleSessions: number;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  sessionPriceSnapshot: number;
  totalDue: number;
  totalPaid: number;
}

export interface CalculateStudentBillingParams {
  enrollment: StudentBillingEnrollmentInput;
  policy: StudentBillingPolicyInput;
  sessions: GroupSessionBillingInput[];
  attendances: StudentAttendanceBillingInput[];
  currentTotalPaid?: number;
  existingRecord?: ExistingStudentMonthlySnapshot | null;
}

export interface StudentMonthlyBillingResult {
  totalGroupSessions: number;
  eligibleSessions: number;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  attendedCount: number;
  billableSessionsCount: number;
  sessionPriceSnapshot: number;
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
    currentTotalPaid,
    existingRecord,
  } = params;

  // Historical Immutability Rule: NEVER overwrite closed month snapshots or totalDue
  if (existingRecord?.isClosed) {
    const lockedSessionPrice = roundMoney(existingRecord.sessionPriceSnapshot);
    const lockedTotalDue = roundMoney(existingRecord.totalDue);
    const totalPaid = roundMoney(currentTotalPaid ?? existingRecord.totalPaid);
    const attendedCount = existingRecord.presentCount;
    const isFullMonthAbsence = attendedCount === 0 && lockedTotalDue > 0;

    return {
      totalGroupSessions: existingRecord.totalGroupSessions,
      eligibleSessions: existingRecord.eligibleSessions,
      presentCount: existingRecord.presentCount,
      absentCount: existingRecord.absentCount,
      excusedCount: existingRecord.excusedCount,
      attendedCount,
      billableSessionsCount:
        attendedCount + (policy.chargeExcusedAbsence ? existingRecord.excusedCount : 0),
      sessionPriceSnapshot: lockedSessionPrice,
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

  for (const session of eligibleSessionList) {
    const status = attendanceMap.get(session.id);
    if (status === AttendanceStatus.PRESENT) presentCount += 1;
    else if (status === AttendanceStatus.EXCUSED) excusedCount += 1;
    else if (status === AttendanceStatus.ABSENT) absentCount += 1;
  }

  const sessionPriceSnapshot =
    enrollment.agreedSessionPrice !== undefined && enrollment.agreedSessionPrice > 0
      ? roundMoney(enrollment.agreedSessionPrice)
      : enrollment.agreedSessionsCount > 0
        ? roundMoney(enrollment.agreedMonthlyPrice / enrollment.agreedSessionsCount)
        : 0;

  // Academic attendance metrics stay independent from financial billing
  const attendedCount = presentCount;

  // Group-level billing rule: every executed group session within enrollment window bills the student
  const billableSessionsCount = eligibleSessions;

  let baseDue = 0;
  const isFullMonthAbsenceApplied = false;

  if (billableSessionsCount === 0) {
    baseDue = 0;
  } else if (
    billableSessionsCount === enrollment.agreedSessionsCount &&
    enrollment.agreedMonthlyPrice > 0 &&
    (enrollment.agreedSessionPrice === undefined || enrollment.agreedSessionPrice <= 0)
  ) {
    baseDue = roundMoney(enrollment.agreedMonthlyPrice);
  } else {
    baseDue = roundMoney(billableSessionsCount * sessionPriceSnapshot);
  }

  const totalDue = roundMoney(baseDue);
  const totalPaid = roundMoney(currentTotalPaid ?? existingRecord?.totalPaid ?? 0);
  const remainingBalance = roundMoney(Math.max(0, totalDue - totalPaid));

  return {
    totalGroupSessions,
    eligibleSessions,
    presentCount,
    absentCount,
    excusedCount,
    attendedCount,
    billableSessionsCount,
    sessionPriceSnapshot,
    totalDue,
    totalPaid,
    remainingBalance,
    isFullMonthAbsenceApplied,
    isClosed: false,
  };
}
