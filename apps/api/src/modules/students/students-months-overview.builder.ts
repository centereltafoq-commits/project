import { computeStudentMonthlyBreakdown } from './students-finance.calculator';
import { StudentsProfileRepository } from './students-profile.repository';

export type StudentMonthPaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'NO_DUES';

export interface StudentMonthOverviewItem {
  yearMonth: string;
  paymentStatus: StudentMonthPaymentStatus;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  totalDue: number;
  totalPaid: number;
  remaining: number;
  groupsCount: number;
  paymentsCount: number;
  isClosed: boolean;
}

const YEAR_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export function classifyStudentMonthPaymentStatus(
  totalDue: number,
  totalPaid: number,
  remaining: number,
): StudentMonthPaymentStatus {
  if (totalDue <= 0.009) {
    return 'NO_DUES';
  }
  if (remaining <= 0.009) {
    return 'PAID';
  }
  if (totalPaid > 0.009) {
    return 'PARTIAL';
  }
  return 'UNPAID';
}

function enumerateRecentYearMonths(
  startYm: string,
  endYm: string,
  maxMonths = 24,
): string[] {
  if (!YEAR_MONTH_REGEX.test(startYm) || !YEAR_MONTH_REGEX.test(endYm)) {
    return [];
  }
  if (startYm > endYm) {
    return [];
  }

  const [endYear, endMonth] = endYm.split('-').map(Number);
  const result: string[] = [];
  let y = endYear;
  let m = endMonth;

  for (let i = 0; i < maxMonths; i++) {
    const ym = `${y}-${String(m).padStart(2, '0')}`;
    if (ym < startYm) break;
    result.push(ym);
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
  }

  return result;
}

export function buildStudentMonthsOverview(
  requestedYearMonth: string,
  currentYearMonth: string,
  bundle: Awaited<ReturnType<StudentsProfileRepository['fetchProfileBundle']>>,
): StudentMonthOverviewItem[] {
  const yearMonthsSet = new Set<string>();

  if (YEAR_MONTH_REGEX.test(requestedYearMonth)) {
    yearMonthsSet.add(requestedYearMonth);
  }
  if (YEAR_MONTH_REGEX.test(currentYearMonth)) {
    yearMonthsSet.add(currentYearMonth);
  }

  const allMonthlyRecords = bundle.allMonthlyRecords ?? bundle.monthlyRecords ?? [];
  const allStudentAttendance = bundle.allStudentAttendance ?? bundle.monthAttendance ?? [];
  const allPaymentAllocations = bundle.allPaymentAllocations ?? [];
  const allGroupSessions = bundle.allGroupSessions ?? [];
  const studentPayments = bundle.studentPayments ?? [];
  const studentEnrollments = bundle.studentEnrollments ?? [];

  for (const rec of allMonthlyRecords) {
    if (rec.yearMonth && YEAR_MONTH_REGEX.test(rec.yearMonth)) {
      yearMonthsSet.add(rec.yearMonth);
    }
  }

  for (const pay of studentPayments) {
    if (pay.yearMonth && YEAR_MONTH_REGEX.test(pay.yearMonth)) {
      yearMonthsSet.add(pay.yearMonth);
    }
  }

  for (const att of allStudentAttendance) {
    if (att.yearMonth && YEAR_MONTH_REGEX.test(att.yearMonth)) {
      yearMonthsSet.add(att.yearMonth);
    }
  }

  const maxBoundYm =
    requestedYearMonth > currentYearMonth ? requestedYearMonth : currentYearMonth;

  for (const enr of studentEnrollments) {
    const startYm = enr.startDate ? enr.startDate.slice(0, 7) : '';
    const rawEndYm = enr.endDate ? enr.endDate.slice(0, 7) : maxBoundYm;
    const endYm = rawEndYm < maxBoundYm ? rawEndYm : maxBoundYm;

    for (const ym of enumerateRecentYearMonths(startYm, endYm, 24)) {
      yearMonthsSet.add(ym);
    }
  }

  for (const sess of allGroupSessions) {
    if (!sess.yearMonth || !YEAR_MONTH_REGEX.test(sess.yearMonth)) continue;
    const isEnrolledInMonth = studentEnrollments.some((enr) => {
      if (enr.groupId !== sess.groupId) return false;
      const startYm = enr.startDate ? enr.startDate.slice(0, 7) : '';
      const endYm = enr.endDate ? enr.endDate.slice(0, 7) : '9999-12';
      return startYm <= sess.yearMonth && endYm >= sess.yearMonth;
    });
    if (isEnrolledInMonth) {
      yearMonthsSet.add(sess.yearMonth);
    }
  }

  const sortedYearMonths = Array.from(yearMonthsSet).sort((a, b) => b.localeCompare(a));

  return sortedYearMonths.map((ym) => {
    const monthlyRecordsForYm = allMonthlyRecords.filter((r) => r.yearMonth === ym);
    const monthAttendanceForYm = allStudentAttendance.filter((a) => a.yearMonth === ym);
    const monthAllocationsForYm = allPaymentAllocations.filter((a) => a.yearMonth === ym);
    const groupSessionsForYm = allGroupSessions.filter((s) => s.yearMonth === ym);

    const computed = computeStudentMonthlyBreakdown(ym, {
      studentEnrollments,
      monthlyRecords: monthlyRecordsForYm,
      monthAttendance: monthAttendanceForYm,
      studentPayments,
      monthAllocations: monthAllocationsForYm,
      groupSessionsInMonth: groupSessionsForYm,
    });

    const {
      totalSessions,
      presentCount,
      absentCount,
      excusedCount,
      totalDue,
      totalPaid,
      remaining,
    } = computed.monthTotals;

    const paymentStatus = classifyStudentMonthPaymentStatus(totalDue, totalPaid, remaining);
    const paymentsCount = studentPayments.filter((p) => p.yearMonth === ym).length;
    const isClosed =
      computed.breakdown.length > 0 && computed.breakdown.every((g) => g.isClosed);

    return {
      yearMonth: ym,
      paymentStatus,
      totalSessions,
      presentCount,
      absentCount,
      excusedCount,
      totalDue,
      totalPaid,
      remaining,
      groupsCount: computed.breakdown.length,
      paymentsCount,
      isClosed,
    };
  });
}
