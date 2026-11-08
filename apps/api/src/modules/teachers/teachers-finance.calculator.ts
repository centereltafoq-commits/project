import { GroupRevenueSplitMethod, SessionStatus } from '@edu-center/shared';
import { TeachersProfileRepository } from './teachers-profile.repository';
import { calculateGroupRevenueSplit } from '../finance/calculators/revenue-split.calculator';
import { roundMoney } from '../finance/utils/money.util';

export interface TeacherGroupMonthlyItem {
  groupId: string;
  groupName: string;
  executedSessionsCount: number;
  studentsCount: number;
  grossRevenue: number;
  teacherShare: number;
  centerShare: number;
  revenueSplitMethod: string;
  isLocked: boolean;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeTeacherMonthlySummary(
  yearMonth: string,
  bundle: Awaited<ReturnType<TeachersProfileRepository['fetchProfileBundle']>>,
) {
  const storedByGroup = new Map(bundle.storedDues.map((d) => [d.groupId, d]));
  const presentByGroup = new Map(
    bundle.monthAttendanceCounts.map((a) => [a.groupId, Number(a.presentEntries || 0)]),
  );

  const groupsBreakdown: TeacherGroupMonthlyItem[] = [];

  for (const grp of bundle.assignedGroups) {
    const grpSessions = bundle.monthSessions.filter((s) => s.groupId === grp.id);
    const executedSessionsCount = grpSessions.filter(
      (s) => s.status === SessionStatus.COMPLETED,
    ).length;

    const stored = storedByGroup.get(grp.id);
    if (stored && (stored.isLocked || stored.executedSessionsCount === executedSessionsCount)) {
      groupsBreakdown.push({
        groupId: grp.id,
        groupName: stored.groupName,
        executedSessionsCount: stored.executedSessionsCount,
        studentsCount: stored.studentsCount,
        grossRevenue: Number(stored.grossGroupRevenue),
        teacherShare: Number(stored.teacherAmount),
        centerShare: Number(stored.centerAmount),
        revenueSplitMethod: grp.revenueSplitMethod || GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
        isLocked: stored.isLocked,
      });
      continue;
    }

    if (!grp.isActive) continue;
    const studentsCount = Number(grp.activeStudentsCount || 0);
    const monthlySessionsCount = Math.max(1, Number(grp.monthlySessionsCount || 1));
    const sessionPrice = Number(grp.calculatedSessionPrice || 0);
    const monthlyPrice = Number(grp.monthlyPrice || 0);
    const method = grp.revenueSplitMethod || GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO;
    const teacherSharePerStudent = Number(grp.teacherSharePerStudent || 0);
    const centerSharePerStudent = Number(grp.centerSharePerStudent || 0);
    const teacherPct = Number(grp.teacherPercentage || 0);

    let grossRevenue = 0;
    if (executedSessionsCount > 0) {
      const presentEntries = presentByGroup.get(grp.id) ?? 0;
      if (presentEntries > 0 && sessionPrice > 0) {
        grossRevenue = roundMoney(presentEntries * sessionPrice);
      } else if (studentsCount > 0 && sessionPrice > 0) {
        grossRevenue = roundMoney(studentsCount * executedSessionsCount * sessionPrice);
      } else if (studentsCount > 0 && monthlyPrice > 0) {
        const ratio = executedSessionsCount / monthlySessionsCount;
        grossRevenue = roundMoney(studentsCount * monthlyPrice * ratio);
      }
    }

    const split = calculateGroupRevenueSplit({
      policy: {
        revenueSplitMethod: method,
        monthlyPrice,
        teacherSharePerStudent,
        centerSharePerStudent,
        teacherPercentage: teacherPct,
      },
      grossGroupRevenue: grossRevenue,
      billedStudentsCount: studentsCount,
      executedSessionsCount,
    });

    const teacherShare = split.teacherAmount;
    const centerShare = split.centerAmount;

    groupsBreakdown.push({
      groupId: grp.id,
      groupName: grp.name,
      executedSessionsCount,
      studentsCount,
      grossRevenue,
      teacherShare,
      centerShare,
      revenueSplitMethod: method,
      isLocked: false,
    });
  }

  const monthPayoutsTotal = round2(
    bundle.payouts
      .filter((p) => p.yearMonth === yearMonth)
      .reduce((sum, p) => sum + Number(p.amount || 0), 0),
  );

  const liveTotalDues = round2(groupsBreakdown.reduce((s, g) => s + g.teacherShare, 0));
  const executedSessionsTotal = groupsBreakdown.reduce((s, g) => s + g.executedSessionsCount, 0);

  const totalDues = bundle.storedMonthlyRecord?.isClosed
    ? Number(bundle.storedMonthlyRecord.totalDues)
    : liveTotalDues;
  const totalPayouts = bundle.storedMonthlyRecord?.isClosed
    ? Number(bundle.storedMonthlyRecord.totalPaidOut)
    : monthPayoutsTotal;
  const remainingBalance = Math.max(0, round2(totalDues - totalPayouts));

  return {
    groups: groupsBreakdown,
    totals: {
      groupsCount: groupsBreakdown.length,
      executedSessionsCount: executedSessionsTotal,
      totalDues,
      totalPayouts,
      remainingBalance,
      isClosed: bundle.storedMonthlyRecord?.isClosed ?? false,
    },
  };
}
