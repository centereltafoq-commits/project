import { AttendanceStatus, SessionStatus } from '@edu-center/shared';
import { DrizzleDatabase } from '../database.module';
import {
  attendance,
  paymentAllocations,
  payments,
  studentMonthlyRecords,
} from '../schemas';
import { seedUuid } from './seed-identity.data';
import { EnrollmentSeedSpec, SeededCatalogContext } from './seed-operations.runner';

export interface GroupFinancialAccumulator {
  groupId: string;
  groupCode: string;
  teacherId: string;
  executedSessions: number;
  studentsCount: number;
  grossRevenue: number;
  teacherAmount: number;
  centerAmount: number;
}

export async function seedAttendanceAndStudentPayments(
  db: DrizzleDatabase,
  ctx: SeededCatalogContext,
  enrollmentSpecs: EnrollmentSeedSpec[],
  groupSessionsMap: Map<string, Array<{ id: string; date: string; status: string }>>,
): Promise<Map<string, GroupFinancialAccumulator>> {
  const [yr, mo] = ctx.yearMonth.split('-');
  const d = (day: number) => `${yr}-${mo}-${String(day).padStart(2, '0')}`;

  const accumulators = new Map<string, GroupFinancialAccumulator>();
  for (const g of ctx.groupsList) {
    const completedCnt = (groupSessionsMap.get(g.id) || []).filter(
      (s) => s.status === SessionStatus.COMPLETED,
    ).length;
    accumulators.set(g.id, {
      groupId: g.id,
      groupCode: g.groupCode,
      teacherId: g.teacherId,
      executedSessions: completedCnt,
      studentsCount: 0,
      grossRevenue: 0,
      teacherAmount: 0,
      centerAmount: 0,
    });
  }

  let paySeq = 1;

  for (const spec of enrollmentSpecs) {
    const studentId = ctx.studentIds[spec.studentIdx];
    const grpSessions = (groupSessionsMap.get(spec.group.id) || []).filter(
      (s) => s.status === SessionStatus.COMPLETED,
    );
    const eligible = grpSessions.filter((s) => !spec.isMidMonth || s.date >= spec.startDate);

    let present = 0;
    let absent = 0;
    let excused = 0;

    for (let sIdx = 0; sIdx < eligible.length; sIdx++) {
      const sess = eligible[sIdx];
      let stStatus = AttendanceStatus.PRESENT;
      if (spec.isFullAbsent) {
        stStatus = AttendanceStatus.ABSENT;
      } else if (spec.studentIdx === 4 && sIdx === eligible.length - 1) {
        stStatus = AttendanceStatus.EXCUSED;
      } else if (spec.studentIdx % 5 === 3 && sIdx === 0) {
        stStatus = AttendanceStatus.ABSENT;
      }

      if (stStatus === AttendanceStatus.PRESENT) present++;
      else if (stStatus === AttendanceStatus.ABSENT) absent++;
      else if (stStatus === AttendanceStatus.EXCUSED) excused++;

      await db
        .insert(attendance)
        .values({
          sessionId: sess.id,
          studentId,
          status: stStatus,
          recordedByUserId: ctx.actorUserId,
        })
        .onConflictDoUpdate({
          target: [attendance.sessionId, attendance.studentId],
          set: { status: stStatus },
        });
    }

    const chargeableSessions = spec.isFullAbsent ? 0 : present;
    const totalDue = Number((chargeableSessions * spec.group.sessionPrice).toFixed(2));
    const paidRatio =
      spec.forcedPaidRatio !== undefined
        ? spec.forcedPaidRatio
        : spec.idx % 4 === 0
          ? 0.5
          : spec.idx % 7 === 0
            ? 0
            : 1;
    const totalPaid = Number((totalDue * paidRatio).toFixed(2));
    const remaining = Number((totalDue - totalPaid).toFixed(2));

    const [smr] = await db
      .insert(studentMonthlyRecords)
      .values({
        studentId,
        groupId: spec.group.id,
        yearMonth: ctx.yearMonth,
        totalGroupSessions: grpSessions.length,
        eligibleSessions: eligible.length,
        presentCount: present,
        absentCount: absent,
        excusedCount: excused,
        makeupAttendedCount: 0,
        sessionPriceSnapshot: spec.group.sessionPrice.toFixed(2),
        extraMakeupFees: '0.00',
        totalDue: totalDue.toFixed(2),
        totalPaid: totalPaid.toFixed(2),
        remainingBalance: remaining.toFixed(2),
      })
      .onConflictDoUpdate({
        target: [
          studentMonthlyRecords.studentId,
          studentMonthlyRecords.groupId,
          studentMonthlyRecords.yearMonth,
        ],
        set: {
          presentCount: present,
          absentCount: absent,
          excusedCount: excused,
          makeupAttendedCount: 0,
          totalDue: totalDue.toFixed(2),
          totalPaid: totalPaid.toFixed(2),
          remainingBalance: remaining.toFixed(2),
        },
      })
      .returning({ id: studentMonthlyRecords.id });

    if (totalPaid > 0) {
      const receiptNo = `RCP-${ctx.yearMonth.replace('-', '')}-${String(1000 + paySeq)}`;
      const paymentId = seedUuid('30', paySeq);
      const allocId = seedUuid('31', paySeq);
      paySeq++;
      const methods = ['CASH', 'CASH', 'VODAFONE_CASH', 'INSTAPAY'];
      const method = methods[paySeq % methods.length];

      await db
        .insert(payments)
        .values({
          id: paymentId,
          receiptNumber: receiptNo,
          studentId,
          yearMonth: ctx.yearMonth,
          amount: totalPaid.toFixed(2),
          paymentDate: d(Math.min(25, 5 + (paySeq % 18))),
          paymentMethod: method,
          receivedByUserId: ctx.accountantUserId,
          notes: `تحصيل اشتراك ${spec.group.groupCode}`,
        })
        .onConflictDoUpdate({
          target: payments.receiptNumber,
          set: { amount: totalPaid.toFixed(2), yearMonth: ctx.yearMonth },
        });

      await db
        .insert(paymentAllocations)
        .values({
          id: allocId,
          paymentId,
          studentMonthlyRecordId: smr.id,
          groupId: spec.group.id,
          yearMonth: ctx.yearMonth,
          allocatedAmount: totalPaid.toFixed(2),
        })
        .onConflictDoNothing({ target: paymentAllocations.id });
    }

    const acc = accumulators.get(spec.group.id)!;
    acc.studentsCount += 1;
    acc.grossRevenue = Number((acc.grossRevenue + totalDue).toFixed(2));
  }

  for (const g of ctx.groupsList) {
    const acc = accumulators.get(g.id)!;
    const teacherRatio = g.teacherShare / g.monthlyPrice;
    acc.teacherAmount = Number((acc.grossRevenue * teacherRatio).toFixed(2));
    acc.centerAmount = Number((acc.grossRevenue - acc.teacherAmount).toFixed(2));
  }

  return accumulators;
}
