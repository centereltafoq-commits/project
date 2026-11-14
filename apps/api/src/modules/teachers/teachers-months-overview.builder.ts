import { TeachersProfileRepository } from './teachers-profile.repository';
import { computeTeacherMonthlySummary } from './teachers-finance.calculator';

export type TeacherPayoutStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'NO_DUES';

export interface TeacherMonthOverviewItem {
  yearMonth: string;
  payoutStatus: TeacherPayoutStatus;
  groupsCount: number;
  executedSessionsCount: number;
  totalDues: number;
  totalPayouts: number;
  remainingBalance: number;
  payoutsCount: number;
  isClosed: boolean;
}

export interface TeacherMonthSessionItem {
  id: string;
  groupId: string;
  groupName: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: string;
  topic: string | null;
  presentCount: number;
}

const YEAR_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

function toMonthIndex(yearMonth: string): number | null {
  if (!YEAR_MONTH_REGEX.test(yearMonth)) return null;
  const [y, m] = yearMonth.split('-').map(Number);
  return y! * 12 + (m! - 1);
}

function fromMonthIndex(index: number): string {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function classifyTeacherPayoutStatus(
  totalDues: number,
  totalPayouts: number,
  remainingBalance: number,
): TeacherPayoutStatus {
  if (totalDues <= 0.009) {
    return 'NO_DUES';
  }
  if (remainingBalance <= 0.009) {
    return 'PAID';
  }
  if (totalPayouts > 0.009) {
    return 'PARTIAL';
  }
  return 'UNPAID';
}

export function collectTeacherYearMonths(params: {
  requestedYearMonth: string;
  currentYearMonth?: string;
  contractDate?: string | null;
  bundle: Partial<Awaited<ReturnType<TeachersProfileRepository['fetchProfileBundle']>>>;
}): string[] {
  const currentYm = params.currentYearMonth || new Date().toISOString().slice(0, 7);
  const months = new Set<string>();

  const addIfValid = (ym?: string | null) => {
    if (ym && YEAR_MONTH_REGEX.test(ym)) {
      months.add(ym);
    }
  };

  addIfValid(params.requestedYearMonth);
  addIfValid(currentYm);

  for (const r of params.bundle.allStoredMonthlyRecords ?? []) {
    addIfValid(r.yearMonth);
  }
  for (const d of params.bundle.allStoredDues ?? []) {
    addIfValid((d as { yearMonth?: string }).yearMonth);
  }
  for (const p of params.bundle.payouts ?? []) {
    addIfValid(p.yearMonth);
  }
  for (const s of params.bundle.allGroupSessions ?? []) {
    addIfValid(s.yearMonth);
  }

  const currentIdx = toMonthIndex(currentYm);
  const contractYm = params.contractDate ? String(params.contractDate).slice(0, 7) : null;
  const contractIdx = contractYm ? toMonthIndex(contractYm) : null;

  if (currentIdx !== null && contractIdx !== null && contractIdx <= currentIdx) {
    const startIdx = Math.max(contractIdx, currentIdx - 11);
    for (let idx = startIdx; idx <= currentIdx; idx++) {
      months.add(fromMonthIndex(idx));
    }
  }

  return Array.from(months).sort((a, b) => b.localeCompare(a));
}

export function buildTeacherMonthsOverview(params: {
  requestedYearMonth: string;
  currentYearMonth?: string;
  contractDate?: string | null;
  bundle: Awaited<ReturnType<TeachersProfileRepository['fetchProfileBundle']>>;
}): TeacherMonthOverviewItem[] {
  const { bundle, requestedYearMonth } = params;
  const yearMonths = collectTeacherYearMonths(params);

  return yearMonths.map((ym) => {
    const storedDues = bundle.allStoredDues
      ? bundle.allStoredDues.filter((d) => d.yearMonth === ym)
      : ym === requestedYearMonth
        ? bundle.storedDues ?? []
        : [];

    const storedMonthlyRecord = bundle.allStoredMonthlyRecords
      ? (bundle.allStoredMonthlyRecords.find((r) => r.yearMonth === ym) ?? null)
      : ym === requestedYearMonth
        ? bundle.storedMonthlyRecord ?? null
        : null;

    const monthSessions = bundle.allGroupSessions
      ? bundle.allGroupSessions.filter((s) => s.yearMonth === ym)
      : ym === requestedYearMonth
        ? bundle.monthSessions ?? []
        : [];

    let monthAttendanceCounts: Array<{ groupId: string; presentEntries: number }> = [];
    if (bundle.allAttendanceCountsBySession) {
      const byGroup = new Map<string, number>();
      for (const row of bundle.allAttendanceCountsBySession) {
        if (row.yearMonth !== ym) continue;
        byGroup.set(row.groupId, (byGroup.get(row.groupId) ?? 0) + Number(row.presentEntries || 0));
      }
      monthAttendanceCounts = Array.from(byGroup.entries()).map(([groupId, presentEntries]) => ({
        groupId,
        presentEntries,
      }));
    } else if (ym === requestedYearMonth) {
      monthAttendanceCounts = bundle.monthAttendanceCounts ?? [];
    }

    const summary = computeTeacherMonthlySummary(ym, {
      ...bundle,
      storedDues,
      storedMonthlyRecord,
      monthSessions,
      monthAttendanceCounts,
    });

    const payoutsCount = (bundle.payouts ?? []).filter((p) => p.yearMonth === ym).length;
    const {
      groupsCount,
      executedSessionsCount,
      totalDues,
      totalPayouts,
      remainingBalance,
      isClosed,
    } = summary.totals;

    return {
      yearMonth: ym,
      payoutStatus: classifyTeacherPayoutStatus(totalDues, totalPayouts, remainingBalance),
      groupsCount,
      executedSessionsCount,
      totalDues,
      totalPayouts,
      remainingBalance,
      payoutsCount,
      isClosed,
    };
  });
}

export function buildTeacherMonthSessions(
  selectedYearMonth: string,
  bundle: Partial<Awaited<ReturnType<TeachersProfileRepository['fetchProfileBundle']>>>,
): TeacherMonthSessionItem[] {
  const presentBySession = new Map<string, number>();
  for (const row of bundle.allAttendanceCountsBySession ?? []) {
    presentBySession.set(row.sessionId, Number(row.presentEntries || 0));
  }

  const groupNameById = new Map<string, string>();
  for (const grp of bundle.assignedGroups ?? []) {
    groupNameById.set(grp.id, grp.name);
  }

  const rawSessions = bundle.allGroupSessions
    ? bundle.allGroupSessions.filter((s) => s.yearMonth === selectedYearMonth)
    : [];

  return rawSessions.map((s) => ({
    id: s.id,
    groupId: s.groupId,
    groupName: s.groupName || groupNameById.get(s.groupId) || '—',
    sessionDate: s.sessionDate,
    startTime: s.startTime,
    endTime: s.endTime,
    status: s.status,
    topic: s.topic ?? null,
    presentCount: presentBySession.get(s.id) ?? 0,
  }));
}
