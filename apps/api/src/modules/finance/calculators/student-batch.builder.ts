import {
  AttendanceStatus,
  FullMonthAbsencePolicy,
  SessionStatus,
} from '@edu-center/shared';
import { calculateStudentMonthlyBilling } from './student-billing.calculator';
import { MonthlySettlementSnapshot } from '../repositories/monthly-settlement-read.repository';
import { NewStudentMonthlyRow } from '../repositories/monthly-settlement-write.repository';
import { parseMoney, roundMoney, toMoneyString } from '../utils/money.util';

export interface StudentBatchBuildResult {
  studentRows: NewStudentMonthlyRow[];
  executedSessionsByGroup: Map<string, MonthlySettlementSnapshot['monthSessions']>;
  groupAttendancesCount: Map<string, number>;
  groupRevenueMap: Map<string, number>;
  groupBilledStudentsMap: Map<string, number>;
  groupEnrolledStudentsMap: Map<string, number>;
}

export function buildStudentSettlementBatch(
  yearMonth: string,
  snap: MonthlySettlementSnapshot,
): StudentBatchBuildResult {
  const policyByGroup = new Map(snap.allPolicies.map((p) => [p.groupId, p]));
  const sessionIdsWithAttendance = new Set(
    snap.sessionAttendances.map((a) => a.sessionId),
  );
  const sessionById = new Map(snap.monthSessions.map((s) => [s.id, s]));

  const executedSessionsByGroup = new Map<
    string,
    MonthlySettlementSnapshot['monthSessions']
  >();
  for (const s of snap.monthSessions) {
    if (s.status === SessionStatus.CANCELLED) continue;
    if (s.status === SessionStatus.COMPLETED || sessionIdsWithAttendance.has(s.id)) {
      const list = executedSessionsByGroup.get(s.groupId) ?? [];
      list.push(s);
      executedSessionsByGroup.set(s.groupId, list);
    }
  }

  const attendancesByStudent = new Map<
    string,
    MonthlySettlementSnapshot['sessionAttendances']
  >();
  const groupAttendancesCount = new Map<string, number>();
  for (const att of snap.sessionAttendances) {
    const list = attendancesByStudent.get(att.studentId) ?? [];
    list.push(att);
    attendancesByStudent.set(att.studentId, list);

    if (
      att.status === AttendanceStatus.PRESENT ||
      att.status === AttendanceStatus.MAKEUP_ATTENDED
    ) {
      const sess = sessionById.get(att.sessionId);
      if (sess && sess.status !== SessionStatus.CANCELLED) {
        groupAttendancesCount.set(
          sess.groupId,
          (groupAttendancesCount.get(sess.groupId) ?? 0) + 1,
        );
      }
    }
  }

  const makeupsByStudentGroup = new Map<
    string,
    MonthlySettlementSnapshot['sessionMakeups']
  >();
  for (const mk of snap.sessionMakeups) {
    const origSess = sessionById.get(mk.originalSessionId);
    if (!origSess) continue;
    const key = `${mk.studentId}:${origSess.groupId}`;
    const list = makeupsByStudentGroup.get(key) ?? [];
    list.push(mk);
    makeupsByStudentGroup.set(key, list);
  }

  const paidByStudentGroup = new Map(
    snap.allocationsAgg.map((a) => [`${a.studentId}:${a.groupId}`, parseMoney(a.paidSum)]),
  );
  const existingStudentMap = new Map(
    snap.existingStudentRecords.map((r) => [`${r.studentId}:${r.groupId}`, r]),
  );

  const uniqueEnrollments = new Map<
    string,
    MonthlySettlementSnapshot['monthEnrollments'][number]
  >();
  for (const enr of snap.monthEnrollments) {
    uniqueEnrollments.set(`${enr.studentId}:${enr.groupId}`, enr);
  }

  const studentRows: NewStudentMonthlyRow[] = [];
  const groupRevenueMap = new Map<string, number>();
  const groupBilledStudentsMap = new Map<string, number>();
  const groupEnrolledStudentsMap = new Map<string, number>();

  for (const [key, enr] of uniqueEnrollments) {
    groupEnrolledStudentsMap.set(
      enr.groupId,
      (groupEnrolledStudentsMap.get(enr.groupId) ?? 0) + 1,
    );
    const existing = existingStudentMap.get(key);
    const policy = policyByGroup.get(enr.groupId);
    const currentPaid = Math.max(
      paidByStudentGroup.get(key) ?? 0,
      existing ? parseMoney(existing.totalPaid) : 0,
    );

    const calc = calculateStudentMonthlyBilling({
      enrollment: {
        startDate: enr.startDate,
        endDate: enr.endDate,
        agreedMonthlyPrice: parseMoney(enr.agreedMonthlyPrice),
        agreedSessionsCount: enr.agreedSessionsCount,
        agreedSessionPrice: parseMoney(enr.agreedSessionPrice),
      },
      policy: {
        fullMonthAbsencePolicy:
          policy?.fullMonthAbsencePolicy ?? FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
        fullAbsenceFixedFee: parseMoney(policy?.fullAbsenceFixedFee),
        chargeExcusedAbsence: policy?.chargeExcusedAbsence ?? false,
      },
      sessions: executedSessionsByGroup.get(enr.groupId) ?? [],
      attendances: attendancesByStudent.get(enr.studentId) ?? [],
      makeups: (makeupsByStudentGroup.get(key) ?? []).map((m) => ({
        isFree: m.isFree,
        extraFee: parseMoney(m.extraFee),
        status: m.status,
      })),
      currentTotalPaid: currentPaid,
      existingRecord: existing
        ? {
            isClosed: existing.isClosed,
            totalGroupSessions: existing.totalGroupSessions,
            eligibleSessions: existing.eligibleSessions,
            presentCount: existing.presentCount,
            absentCount: existing.absentCount,
            excusedCount: existing.excusedCount,
            makeupAttendedCount: existing.makeupAttendedCount,
            sessionPriceSnapshot: parseMoney(existing.sessionPriceSnapshot),
            extraMakeupFees: parseMoney(existing.extraMakeupFees),
            totalDue: parseMoney(existing.totalDue),
            totalPaid: parseMoney(existing.totalPaid),
          }
        : null,
    });

    groupRevenueMap.set(
      enr.groupId,
      roundMoney((groupRevenueMap.get(enr.groupId) ?? 0) + calc.totalDue),
    );
    if (calc.totalDue > 0 || calc.attendedCount > 0) {
      groupBilledStudentsMap.set(
        enr.groupId,
        (groupBilledStudentsMap.get(enr.groupId) ?? 0) + 1,
      );
    }

    if (!calc.isClosed) {
      studentRows.push({
        studentId: enr.studentId,
        groupId: enr.groupId,
        yearMonth,
        totalGroupSessions: calc.totalGroupSessions,
        eligibleSessions: calc.eligibleSessions,
        presentCount: calc.presentCount,
        absentCount: calc.absentCount,
        excusedCount: calc.excusedCount,
        makeupAttendedCount: calc.makeupAttendedCount,
        sessionPriceSnapshot: toMoneyString(calc.sessionPriceSnapshot),
        extraMakeupFees: toMoneyString(calc.extraMakeupFees),
        totalDue: toMoneyString(calc.totalDue),
        totalPaid: toMoneyString(calc.totalPaid),
        remainingBalance: toMoneyString(calc.remainingBalance),
        isClosed: false,
      });
    }
  }

  return {
    studentRows,
    executedSessionsByGroup,
    groupAttendancesCount,
    groupRevenueMap,
    groupBilledStudentsMap,
    groupEnrolledStudentsMap,
  };
}
