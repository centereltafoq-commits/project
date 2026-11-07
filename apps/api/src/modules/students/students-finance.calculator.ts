import {
  AttendanceStatus,
  FullMonthAbsencePolicy,
  MakeupStatus,
} from '@edu-center/shared';
import { StudentsProfileRepository } from './students-profile.repository';

export interface StudentGroupMonthlyBreakdown {
  groupId: string;
  groupName: string;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  makeupCount: number;
  sessionPrice: number;
  totalDue: number;
  totalPaid: number;
  remaining: number;
  isClosed: boolean;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeStudentMonthlyBreakdown(
  yearMonth: string,
  bundle: Awaited<ReturnType<StudentsProfileRepository['fetchProfileBundle']>>,
) {
  const [yearNum, monthNum] = yearMonth.split('-').map(Number);
  const monthStart = `${yearMonth}-01`;
  const lastDay = new Date(yearNum, monthNum, 0).getDate();
  const monthEnd = `${yearMonth}-${String(lastDay).padStart(2, '0')}`;

  const storedByGroup = new Map(bundle.monthlyRecords.map((r) => [r.groupId, r]));
  const allocatedByGroup = new Map<string, number>();
  const allocatedPaymentIds = new Set<string>();
  for (const alloc of bundle.monthAllocations) {
    allocatedPaymentIds.add(alloc.paymentId);
    allocatedByGroup.set(
      alloc.groupId,
      (allocatedByGroup.get(alloc.groupId) ?? 0) + Number(alloc.allocatedAmount || 0),
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

  const breakdown: StudentGroupMonthlyBreakdown[] = [];

  for (const [groupId, enr] of uniqueGroups.entries()) {
    const stored = storedByGroup.get(groupId);
    if (stored) {
      breakdown.push({
        groupId,
        groupName: stored.groupName,
        totalSessions: stored.eligibleSessions || stored.totalGroupSessions,
        presentCount: stored.presentCount,
        absentCount: stored.absentCount,
        excusedCount: stored.excusedCount,
        makeupCount: stored.makeupAttendedCount,
        sessionPrice: Number(stored.sessionPriceSnapshot),
        totalDue: Number(stored.totalDue),
        totalPaid: Number(stored.totalPaid),
        remaining: Number(stored.remainingBalance),
        isClosed: stored.isClosed,
      });
      continue;
    }

    const eligibleSessions = bundle.groupSessionsInMonth.filter(
      (s) =>
        s.groupId === groupId &&
        s.sessionDate >= enr.startDate &&
        (!enr.endDate || s.sessionDate <= enr.endDate),
    );
    const groupAtt = bundle.monthAttendance.filter((a) => a.groupId === groupId);
    const presentCount = groupAtt.filter((a) => a.status === AttendanceStatus.PRESENT).length;
    const absentCount = groupAtt.filter((a) => a.status === AttendanceStatus.ABSENT).length;
    const excusedCount = groupAtt.filter((a) => a.status === AttendanceStatus.EXCUSED).length;
    const attMakeupCount = groupAtt.filter(
      (a) => a.status === AttendanceStatus.MAKEUP_ATTENDED,
    ).length;

    const groupMakeups = bundle.studentMakeups.filter(
      (m) => m.groupId === groupId && m.sessionYearMonth === yearMonth,
    );
    const completedMakeups = groupMakeups.filter((m) => m.status === MakeupStatus.COMPLETED).length;
    const makeupCount = Math.max(attMakeupCount, completedMakeups);
    const extraMakeupFees = groupMakeups
      .filter((m) => !m.isFree && m.status !== MakeupStatus.CANCELLED)
      .reduce((sum, m) => sum + Number(m.extraFee || 0), 0);

    const totalSessions = eligibleSessions.length;
    const sessionPrice = Number(enr.agreedSessionPrice || 0);
    let baseDue = 0;

    if (totalSessions > 0) {
      const isFullMonthAbsent =
        presentCount === 0 && makeupCount === 0 && absentCount >= totalSessions;
      if (isFullMonthAbsent) {
        if (enr.fullMonthAbsencePolicy === FullMonthAbsencePolicy.CHARGE_FIXED_RESERVATION_FEE) {
          baseDue = Number(enr.fullAbsenceFixedFee || 0);
        } else if (
          enr.fullMonthAbsencePolicy === FullMonthAbsencePolicy.CHARGE_FULL_SUBSCRIPTION
        ) {
          baseDue = totalSessions * sessionPrice;
        } else {
          baseDue = 0;
        }
      } else {
        const deductedExcused = enr.chargeExcusedAbsence ? 0 : excusedCount;
        const chargeableSessions = Math.max(0, totalSessions - deductedExcused);
        baseDue = chargeableSessions * sessionPrice;
      }
    }

    const totalDue = round2(baseDue + extraMakeupFees);
    const totalPaid = round2(allocatedByGroup.get(groupId) ?? 0);
    const remaining = round2(totalDue - totalPaid);

    breakdown.push({
      groupId,
      groupName: enr.groupName,
      totalSessions,
      presentCount,
      absentCount,
      excusedCount,
      makeupCount,
      sessionPrice,
      totalDue,
      totalPaid,
      remaining,
      isClosed: false,
    });
  }

  const unallocatedMonthPaid = bundle.studentPayments
    .filter((p) => p.yearMonth === yearMonth && !allocatedPaymentIds.has(p.id))
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const totalSessions = breakdown.reduce((s, g) => s + g.totalSessions, 0);
  const presentCount = breakdown.reduce((s, g) => s + g.presentCount, 0);
  const absentCount = breakdown.reduce((s, g) => s + g.absentCount, 0);
  const excusedCount = breakdown.reduce((s, g) => s + g.excusedCount, 0);
  const makeupCount = breakdown.reduce((s, g) => s + g.makeupCount, 0);
  const totalDue = round2(breakdown.reduce((s, g) => s + g.totalDue, 0));
  const totalPaid = round2(breakdown.reduce((s, g) => s + g.totalPaid, 0) + unallocatedMonthPaid);
  const remaining = round2(totalDue - totalPaid);

  return {
    breakdown,
    monthTotals: {
      totalSessions,
      presentCount,
      absentCount,
      excusedCount,
      makeupCount,
      totalDue,
      totalPaid,
      remaining,
    },
  };
}
