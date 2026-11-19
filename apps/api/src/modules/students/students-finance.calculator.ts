import {
  FullMonthAbsencePolicy,
  SessionStatus,
} from '@edu-center/shared';
import { calculateStudentMonthlyBilling } from '../finance/calculators/student-billing.calculator';
import { StudentsProfileRepository } from './students-profile.repository';

export interface StudentGroupMonthlyBreakdown {
  groupId: string;
  groupName: string;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  sessionPrice: number;
  totalDue: number;
  totalPaid: number;
  remaining: number;
  isClosed: boolean;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export type StudentMonthlySliceBundle = Pick<
  Awaited<ReturnType<StudentsProfileRepository['fetchProfileBundle']>>,
  | 'studentEnrollments'
  | 'monthlyRecords'
  | 'monthAttendance'
  | 'studentPayments'
  | 'monthAllocations'
  | 'groupSessionsInMonth'
>;

export function computeStudentMonthlyBreakdown(
  yearMonth: string,
  bundle: StudentMonthlySliceBundle,
) {
  const [yearNum, monthNum] = yearMonth.split('-').map(Number);
  const monthStart = `${yearMonth}-01`;
  const lastDay = new Date(yearNum, monthNum, 0).getDate();
  const monthEnd = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

  const storedByGroup = new Map(bundle.monthlyRecords.map((r) => [r.groupId, r]));
  const allocatedByGroup = new Map<string, number>();
  const allocatedByPaymentId = new Map<string, number>();
  for (const alloc of bundle.monthAllocations) {
    allocatedByPaymentId.set(
      alloc.paymentId,
      round2((allocatedByPaymentId.get(alloc.paymentId) ?? 0) + Number(alloc.allocatedAmount || 0)),
    );
    allocatedByGroup.set(
      alloc.groupId,
      round2((allocatedByGroup.get(alloc.groupId) ?? 0) + Number(alloc.allocatedAmount || 0)),
    );
  }

  const relevantEnrollments = bundle.studentEnrollments.filter(
    (e) =>
      storedByGroup.has(e.groupId) ||
      (e.startDate <= monthEnd && (!e.endDate || e.endDate >= monthStart)),
  );

  const uniqueGroups = new Map<string, (typeof bundle.studentEnrollments)[number]>();
  for (const enr of relevantEnrollments) {
    if (!uniqueGroups.has(enr.groupId)) uniqueGroups.set(enr.groupId, enr);
  }

  const sessionIdsWithAttendance = new Set(bundle.monthAttendance.map((a) => a.sessionId));
  const breakdown: StudentGroupMonthlyBreakdown[] = [];

  for (const [groupId, enr] of uniqueGroups.entries()) {
    const stored = storedByGroup.get(groupId);
    if (stored?.isClosed) {
      breakdown.push({
        groupId,
        groupName: stored.groupName,
        totalSessions: stored.eligibleSessions,
        presentCount: stored.presentCount,
        absentCount: stored.absentCount,
        excusedCount: stored.excusedCount,
        sessionPrice: Number(stored.sessionPriceSnapshot),
        totalDue: Number(stored.totalDue),
        totalPaid: Number(stored.totalPaid),
        remaining: Number(stored.remainingBalance),
        isClosed: true,
      });
      continue;
    }

    const executedGroupSessions = bundle.groupSessionsInMonth.filter(
      (s) =>
        s.groupId === groupId &&
        (s.status as string) !== SessionStatus.CANCELLED &&
        ((s.status as string) === SessionStatus.COMPLETED || sessionIdsWithAttendance.has(s.id)),
    );
    const groupAtt = bundle.monthAttendance.filter((a) => a.groupId === groupId);
    const currentPaid = Math.max(
      allocatedByGroup.get(groupId) ?? 0,
      stored ? Number(stored.totalPaid || 0) : 0,
    );

    const calc = calculateStudentMonthlyBilling({
      enrollment: {
        startDate: enr.startDate,
        endDate: enr.endDate,
        agreedMonthlyPrice: Number(enr.agreedMonthlyPrice || 0),
        agreedSessionsCount: Number(enr.agreedSessionsCount || 0),
        agreedSessionPrice: Number(enr.agreedSessionPrice || 0),
      },
      policy: {
        fullMonthAbsencePolicy:
          enr.fullMonthAbsencePolicy ?? FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
        fullAbsenceFixedFee: Number(enr.fullAbsenceFixedFee || 0),
        chargeExcusedAbsence: Boolean(enr.chargeExcusedAbsence),
      },
      sessions: executedGroupSessions,
      attendances: groupAtt.map((a) => ({ sessionId: a.sessionId, status: a.status })),
      currentTotalPaid: currentPaid,
    });

    breakdown.push({
      groupId,
      groupName: stored?.groupName ?? enr.groupName,
      totalSessions: calc.eligibleSessions,
      presentCount: calc.presentCount,
      absentCount: calc.absentCount,
      excusedCount: calc.excusedCount,
      sessionPrice: calc.sessionPriceSnapshot,
      totalDue: calc.totalDue,
      totalPaid: calc.totalPaid,
      remaining: calc.remainingBalance,
      isClosed: false,
    });
  }

  const unallocatedMonthPaid = bundle.studentPayments
    .filter((p) => p.yearMonth === yearMonth)
    .reduce((sum, p) => {
      const paymentAmount = Number(p.amount || 0);
      const allocatedForPayment = allocatedByPaymentId.get(p.id) ?? 0;
      const unallocated = Math.max(0, round2(paymentAmount - allocatedForPayment));
      return round2(sum + unallocated);
    }, 0);

  const totalSessions = breakdown.reduce((s, g) => s + g.totalSessions, 0);
  const presentCount = breakdown.reduce((s, g) => s + g.presentCount, 0);
  const absentCount = breakdown.reduce((s, g) => s + g.absentCount, 0);
  const excusedCount = breakdown.reduce((s, g) => s + g.excusedCount, 0);
  const totalDue = round2(breakdown.reduce((s, g) => s + g.totalDue, 0));
  const totalPaid = round2(breakdown.reduce((s, g) => s + g.totalPaid, 0) + unallocatedMonthPaid);
  const remaining = round2(Math.max(0, totalDue - totalPaid));

  return {
    breakdown,
    monthTotals: {
      totalSessions,
      presentCount,
      absentCount,
      excusedCount,
      totalDue,
      totalPaid,
      remaining,
    },
  };
}
