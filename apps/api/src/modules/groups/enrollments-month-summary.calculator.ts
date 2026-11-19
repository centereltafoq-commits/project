import { FullMonthAbsencePolicy, SessionStatus } from '@edu-center/shared';
import {
  calculateStudentMonthlyBilling,
  ExistingStudentMonthlySnapshot,
  StudentBillingPolicyInput,
} from '../finance/calculators/student-billing.calculator';

export type EnrollmentMonthPaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'NO_DUES';

export interface EnrollmentMonthSummary {
  yearMonth: string;
  paymentStatus: EnrollmentMonthPaymentStatus | null;
  totalDue: number;
  totalPaid: number;
  remaining: number;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  isClosed: boolean;
}

export interface GroupMonthActivityBundle {
  policy: StudentBillingPolicyInput | null;
  monthSessions: Array<{ id: string; sessionDate: string; status: string }>;
  sessionIdsWithAttendance: Set<string>;
  attendanceRows: Array<{ sessionId: string; studentId: string; status: string }>;
  storedRecords: Array<{
    studentId: string;
    isClosed: boolean;
    totalGroupSessions: number;
    eligibleSessions: number;
    presentCount: number;
    absentCount: number;
    excusedCount: number;
    sessionPriceSnapshot: string;
    totalDue: string;
    totalPaid: string;
  }>;
  allocatedByStudent: Map<string, number>;
}

export interface EnrollmentMonthBillingInput {
  studentId: string;
  startDate: string;
  endDate: string | null;
  status?: string;
  agreedMonthlyPrice: string;
  agreedSessionsCount: number;
  agreedSessionPrice: string;
}

export function getDefaultYearMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function resolvePaymentStatus(
  totalDue: number,
  totalPaid: number,
  remaining: number,
): EnrollmentMonthPaymentStatus {
  if (totalDue <= 0 && totalPaid <= 0) return 'NO_DUES';
  if (remaining <= 0) return 'PAID';
  if (totalPaid > 0) return 'PARTIAL';
  return 'UNPAID';
}

/**
 * Computes monthly attendance counts and payment status for paginated group enrollments
 * using the canonical `calculateStudentMonthlyBilling` engine (100% aligned with Student Profile).
 */
export function buildEnrollmentMonthSummary(
  row: EnrollmentMonthBillingInput,
  yearMonth: string,
  bundle: GroupMonthActivityBundle,
  canViewFinance: boolean,
): EnrollmentMonthSummary {
  const policy: StudentBillingPolicyInput = bundle.policy ?? {
    fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
    fullAbsenceFixedFee: 0,
    chargeExcusedAbsence: false,
  };

  const executedSessions = bundle.monthSessions.filter(
    (s) =>
      s.status !== SessionStatus.CANCELLED &&
      (s.status === SessionStatus.COMPLETED || bundle.sessionIdsWithAttendance.has(s.id)),
  );

  const stored = bundle.storedRecords.find((r) => r.studentId === row.studentId);
  const existingRecord: ExistingStudentMonthlySnapshot | null = stored
    ? {
        isClosed: stored.isClosed,
        totalGroupSessions: stored.totalGroupSessions,
        eligibleSessions: stored.eligibleSessions,
        presentCount: stored.presentCount,
        absentCount: stored.absentCount,
        excusedCount: stored.excusedCount,
        sessionPriceSnapshot: Number(stored.sessionPriceSnapshot || 0),
        totalDue: Number(stored.totalDue || 0),
        totalPaid: Number(stored.totalPaid || 0),
      }
    : null;

  const currentTotalPaid = Math.max(
    bundle.allocatedByStudent.get(row.studentId) ?? 0,
    stored ? Number(stored.totalPaid || 0) : 0,
  );

  const studentAttendances = bundle.attendanceRows.filter((a) => a.studentId === row.studentId);

  const billing = calculateStudentMonthlyBilling({
    yearMonth,
    enrollment: {
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
      agreedMonthlyPrice: Number(row.agreedMonthlyPrice || 0),
      agreedSessionsCount: Number(row.agreedSessionsCount || 0),
      agreedSessionPrice: Number(row.agreedSessionPrice || 0),
    },
    policy,
    sessions: executedSessions,
    attendances: studentAttendances,
    currentTotalPaid,
    existingRecord,
  });

  return {
    yearMonth,
    paymentStatus: canViewFinance
      ? resolvePaymentStatus(billing.totalDue, billing.totalPaid, billing.remainingBalance)
      : null,
    totalDue: canViewFinance ? billing.totalDue : 0,
    totalPaid: canViewFinance ? billing.totalPaid : 0,
    remaining: canViewFinance ? billing.remainingBalance : 0,
    totalSessions: billing.eligibleSessions,
    presentCount: billing.presentCount,
    absentCount: billing.absentCount,
    excusedCount: billing.excusedCount,
    isClosed: billing.isClosed,
  };
}
