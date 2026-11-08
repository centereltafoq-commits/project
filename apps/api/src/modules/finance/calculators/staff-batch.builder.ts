import {
  AssistantCalculationMethod,
  GroupRevenueSplitMethod,
} from '@edu-center/shared';
import { calculateAssistantDues } from './assistant-dues.calculator';
import { calculateGroupRevenueSplit } from './revenue-split.calculator';
import { StudentBatchBuildResult } from './student-batch.builder';
import { MonthlySettlementSnapshot } from '../repositories/monthly-settlement-read.repository';
import {
  NewAssistantDueRow,
  NewAssistantMonthlyRow,
  NewTeacherDueRow,
  NewTeacherMonthlyRow,
} from '../repositories/monthly-settlement-write.repository';
import { parseMoney, roundMoney, toMoneyString } from '../utils/money.util';

export function computeSessionsHours(
  sessionsList: MonthlySettlementSnapshot['monthSessions'],
): number {
  let totalMinutes = 0;
  for (const s of sessionsList) {
    if (s.startTime && s.endTime) {
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);
      if (!isNaN(sh) && !isNaN(sm) && !isNaN(eh) && !isNaN(em)) {
        const diff = eh * 60 + em - (sh * 60 + sm);
        if (diff > 0) {
          totalMinutes += diff;
          continue;
        }
      }
    }
    totalMinutes += 120; // Default 2 hours if invalid/missing
  }
  return roundMoney(totalMinutes / 60);
}

export function buildStaffSettlementBatch(
  yearMonth: string,
  snap: MonthlySettlementSnapshot,
  studentBatch: StudentBatchBuildResult,
) {
  const policyByGroup = new Map(snap.allPolicies.map((p) => [p.groupId, p]));
  const existingTeacherDueMap = new Map(
    snap.existingTeacherDues.map((d) => [`${d.teacherId}:${d.groupId}`, d]),
  );
  const existingTeacherMonthlyMap = new Map(
    snap.existingTeacherRecords.map((r) => [r.teacherId, r]),
  );
  const teacherPayoutMap = new Map(
    snap.teacherPayoutsAgg.map((p) => [p.teacherId, parseMoney(p.paidSum)]),
  );

  const teacherDueRows: NewTeacherDueRow[] = [];
  const teacherAgg = new Map<
    string,
    { groupsCount: number; executedSessionsCount: number; totalDues: number }
  >();

  const groupById = new Map(snap.allGroups.map((g) => [g.id, g]));

  for (const grp of snap.allGroups) {
    const execCount = (studentBatch.executedSessionsByGroup.get(grp.id) ?? []).length;
    const enrolledCount = studentBatch.groupEnrolledStudentsMap.get(grp.id) ?? 0;
    const existingDue = existingTeacherDueMap.get(`${grp.primaryTeacherId}:${grp.id}`);
    if (!grp.isActive && execCount === 0 && enrolledCount === 0 && !existingDue?.isLocked) {
      continue;
    }

    const policy = policyByGroup.get(grp.id);
    const split = calculateGroupRevenueSplit({
      policy: {
        revenueSplitMethod:
          policy?.revenueSplitMethod ?? GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
        monthlyPrice: parseMoney(grp.monthlyPrice),
        teacherSharePerStudent: parseMoney(policy?.teacherSharePerStudent),
        centerSharePerStudent: parseMoney(policy?.centerSharePerStudent),
        teacherPercentage: parseMoney(policy?.teacherPercentage),
      },
      grossGroupRevenue: studentBatch.groupRevenueMap.get(grp.id) ?? 0,
      billedStudentsCount: studentBatch.groupBilledStudentsMap.get(grp.id) ?? 0,
      executedSessionsCount: execCount,
      existingDue: existingDue
        ? {
            isLocked: existingDue.isLocked,
            executedSessionsCount: existingDue.executedSessionsCount,
            studentsCount: existingDue.studentsCount,
            grossGroupRevenue: parseMoney(existingDue.grossGroupRevenue),
            teacherAmount: parseMoney(existingDue.teacherAmount),
            centerAmount: parseMoney(existingDue.centerAmount),
            calculationBreakdown: existingDue.calculationBreakdown,
          }
        : null,
    });

    if (!split.isLocked) {
      teacherDueRows.push({
        teacherId: grp.primaryTeacherId,
        groupId: grp.id,
        yearMonth,
        executedSessionsCount: split.executedSessionsCount,
        studentsCount: split.studentsCount,
        grossGroupRevenue: toMoneyString(split.grossGroupRevenue),
        teacherAmount: toMoneyString(split.teacherAmount),
        centerAmount: toMoneyString(split.centerAmount),
        calculationBreakdown: split.calculationBreakdown,
        isLocked: false,
      });
    }

    const prev = teacherAgg.get(grp.primaryTeacherId) ?? {
      groupsCount: 0,
      executedSessionsCount: 0,
      totalDues: 0,
    };
    teacherAgg.set(grp.primaryTeacherId, {
      groupsCount: prev.groupsCount + 1,
      executedSessionsCount: prev.executedSessionsCount + split.executedSessionsCount,
      totalDues: roundMoney(prev.totalDues + split.teacherAmount),
    });
  }

  for (const lockedDue of snap.existingTeacherDues) {
    if (!lockedDue.isLocked) continue;
    const grp = groupById.get(lockedDue.groupId);
    if (grp && grp.primaryTeacherId === lockedDue.teacherId) continue;

    const prev = teacherAgg.get(lockedDue.teacherId) ?? {
      groupsCount: 0,
      executedSessionsCount: 0,
      totalDues: 0,
    };
    teacherAgg.set(lockedDue.teacherId, {
      groupsCount: prev.groupsCount + 1,
      executedSessionsCount: prev.executedSessionsCount + lockedDue.executedSessionsCount,
      totalDues: roundMoney(prev.totalDues + parseMoney(lockedDue.teacherAmount)),
    });
  }

  for (const rec of snap.existingTeacherRecords) {
    if (!rec.isClosed && !teacherAgg.has(rec.teacherId)) {
      teacherAgg.set(rec.teacherId, {
        groupsCount: 0,
        executedSessionsCount: 0,
        totalDues: 0,
      });
    }
  }
  for (const [teacherId] of teacherPayoutMap) {
    if (!teacherAgg.has(teacherId)) {
      teacherAgg.set(teacherId, {
        groupsCount: 0,
        executedSessionsCount: 0,
        totalDues: 0,
      });
    }
  }

  const teacherMonthlyRows: NewTeacherMonthlyRow[] = [];
  for (const [teacherId, agg] of teacherAgg) {
    if (existingTeacherMonthlyMap.get(teacherId)?.isClosed) continue;
    const paidOut = teacherPayoutMap.get(teacherId) ?? 0;
    teacherMonthlyRows.push({
      teacherId,
      yearMonth,
      groupsCount: agg.groupsCount,
      executedSessionsCount: agg.executedSessionsCount,
      totalDues: toMoneyString(agg.totalDues),
      totalPaidOut: toMoneyString(paidOut),
      remainingBalance: toMoneyString(Math.max(0, roundMoney(agg.totalDues - paidOut))),
      isClosed: false,
    });
  }

  const existingAssistantMonthlyMap = new Map(
    snap.existingAssistantRecords.map((r) => [r.assistantId, r]),
  );
  const assistantPayoutMap = new Map(
    snap.assistantPayoutsAgg.map((p) => [p.assistantId, parseMoney(p.paidSum)]),
  );
  const linksByAssistant = new Map<string, typeof snap.allGroupAssistants>();
  for (const ga of snap.allGroupAssistants) {
    const list = linksByAssistant.get(ga.assistantId) ?? [];
    list.push(ga);
    linksByAssistant.set(ga.assistantId, list);
  }

  const openAssistantIdsToRefreshDues: string[] = [];
  const assistantDueRows: NewAssistantDueRow[] = [];
  const assistantMonthlyRows: NewAssistantMonthlyRow[] = [];

  for (const asst of snap.activeAssistants) {
    if (existingAssistantMonthlyMap.get(asst.id)?.isClosed) continue;
    openAssistantIdsToRefreshDues.push(asst.id);

    const lockedDuesSum = snap.existingAssistantDues
      .filter((d) => d.assistantId === asst.id && d.isLocked)
      .reduce((acc, d) => roundMoney(acc + parseMoney(d.amount)), 0);

    const links = linksByAssistant.get(asst.id) ?? [];
    const isBaseMonthlyFlat =
      asst.calculationMethod === AssistantCalculationMethod.FIXED_MONTHLY ||
      asst.calculationMethod === AssistantCalculationMethod.CUSTOM_AGREEMENT;

    let openDuesSum = 0;
    const breakdownNotes: string[] = [];
    const nonOverriddenLinks = links.filter(
      (l) => !l.overrideCalculationMethod && l.overrideRateValue === null,
    );
    const overriddenLinks = links.filter(
      (l) => Boolean(l.overrideCalculationMethod) || l.overrideRateValue !== null,
    );

    if (isBaseMonthlyFlat && (links.length === 0 || nonOverriddenLinks.length > 0)) {
      const calc = calculateAssistantDues({
        assistant: {
          calculationMethod: asst.calculationMethod,
          rateValue: parseMoney(asst.rateValue),
          customFormulaNote: asst.customFormulaNote,
        },
        metrics: {
          executedSessionsRevenue: 0,
          executedSessionsCount: 0,
          enrolledStudentsCount: 0,
          totalAttendancesCount: 0,
        },
      });
      openDuesSum = roundMoney(openDuesSum + calc.amount);
      breakdownNotes.push(calc.calculationBreakdown);
      assistantDueRows.push({
        assistantId: asst.id,
        groupId: null,
        yearMonth,
        calculationMethod: calc.calculationMethod,
        sessionsCount: 0,
        studentsCount: 0,
        amount: toMoneyString(calc.amount),
        calculationBreakdown: calc.calculationBreakdown,
        isLocked: false,
      });
    }

    for (const link of isBaseMonthlyFlat ? overriddenLinks : links) {
      const groupSessions = studentBatch.executedSessionsByGroup.get(link.groupId) ?? [];
      const calc = calculateAssistantDues({
        assistant: {
          calculationMethod: asst.calculationMethod,
          rateValue: parseMoney(asst.rateValue),
          customFormulaNote: asst.customFormulaNote,
        },
        groupOverride: {
          overrideCalculationMethod: link.overrideCalculationMethod,
          overrideRateValue:
            link.overrideRateValue !== null ? parseMoney(link.overrideRateValue) : null,
        },
        metrics: {
          executedSessionsRevenue: studentBatch.groupRevenueMap.get(link.groupId) ?? 0,
          executedSessionsCount: groupSessions.length,
          executedHoursCount: computeSessionsHours(groupSessions),
          enrolledStudentsCount:
            studentBatch.groupEnrolledStudentsMap.get(link.groupId) ?? 0,
          totalAttendancesCount:
            studentBatch.groupAttendancesCount.get(link.groupId) ?? 0,
        },
      });
      openDuesSum = roundMoney(openDuesSum + calc.amount);
      breakdownNotes.push(calc.calculationBreakdown);
      assistantDueRows.push({
        assistantId: asst.id,
        groupId: link.groupId,
        yearMonth,
        calculationMethod: calc.calculationMethod,
        sessionsCount: calc.sessionsCount,
        studentsCount: calc.studentsCount,
        amount: toMoneyString(calc.amount),
        calculationBreakdown: calc.calculationBreakdown,
        isLocked: false,
      });
    }

    const totalDues = roundMoney(lockedDuesSum + openDuesSum);
    const paidOut = assistantPayoutMap.get(asst.id) ?? 0;
    assistantMonthlyRows.push({
      assistantId: asst.id,
      yearMonth,
      calculationMethodSnapshot: asst.calculationMethod,
      totalDues: toMoneyString(totalDues),
      totalPaidOut: toMoneyString(paidOut),
      remainingBalance: toMoneyString(Math.max(0, roundMoney(totalDues - paidOut))),
      detailsNote: breakdownNotes.join(' | ') || asst.customFormulaNote || null,
      isClosed: false,
    });
  }

  return {
    teacherDueRows,
    teacherMonthlyRows,
    openAssistantIdsToRefreshDues,
    assistantDueRows,
    assistantMonthlyRows,
  };
}
