import { AssistantCalculationMethod } from '@edu-center/shared';
import { AssistantsProfileRepository } from './assistants-profile.repository';

export type AssistantPayoutStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'NO_DUES';

export interface AssistantMonthOverviewItem {
  yearMonth: string;
  payoutStatus: AssistantPayoutStatus;
  groupsCount: number;
  executedSessionsCount: number;
  totalDues: number;
  totalPayouts: number;
  remainingBalance: number;
  payoutsCount: number;
  isClosed: boolean;
}

export interface AssistantMonthlyBreakdownResult {
  groupDues: Array<{
    groupId: string;
    groupName: string;
    calculationMethod: string;
    rateValue: number;
    sessionsCount: number;
    studentsCount: number;
    amount: number;
    isLocked: boolean;
  }>;
  baseGlobalDue: number;
  totalDues: number;
  totalPayouts: number;
  remainingBalance: number;
  isClosed: boolean;
}

type AssistantBundle = Awaited<ReturnType<AssistantsProfileRepository['fetchProfileBundle']>>;

interface AssistantRateInput {
  calculationMethod: AssistantCalculationMethod | string;
  rateValue: string | number;
  createdAt?: Date | string | null;
}

const YEAR_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

function round2(value: number): number {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

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

export function classifyAssistantPayoutStatus(
  totalDues: number,
  totalPayouts: number,
  remainingBalance: number,
): AssistantPayoutStatus {
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

export function computeAssistantMonthlyBreakdown(params: {
  yearMonth: string;
  assistant: AssistantRateInput;
  linkedGroups: AssistantBundle['linkedGroups'];
  storedDues: AssistantBundle['storedDues'];
  storedMonthlyRecord: AssistantBundle['storedMonthlyRecord'];
  payouts: AssistantBundle['payouts'];
  sessionCounts: Array<{ groupId: string; executedCount: number; executedMinutes?: number }>;
  attendanceCounts: Array<{ groupId: string; presentEntries: number }>;
}): AssistantMonthlyBreakdownResult {
  const {
    yearMonth,
    assistant,
    linkedGroups,
    storedDues,
    storedMonthlyRecord,
    payouts,
    sessionCounts,
    attendanceCounts,
  } = params;

  const execByGroup = new Map(sessionCounts.map((s) => [s.groupId, Number(s.executedCount || 0)]));
  const hoursByGroup = new Map(
    sessionCounts.map((s) => [s.groupId, round2(Number(s.executedMinutes || 0) / 60)]),
  );
  const presentByGroup = new Map(
    attendanceCounts.map((a) => [a.groupId, Number(a.presentEntries || 0)]),
  );
  const storedByGroup = new Map(storedDues.filter((d) => d.groupId).map((d) => [d.groupId!, d]));

  const groupDues = linkedGroups.map((grp) => {
    const sessionsCount = execByGroup.get(grp.groupId) ?? 0;
    const stored = storedByGroup.get(grp.groupId);
    if (stored && (stored.isLocked || stored.sessionsCount === sessionsCount)) {
      return {
        groupId: grp.groupId,
        groupName: grp.groupName,
        calculationMethod: stored.calculationMethod,
        rateValue: Number(grp.overrideRateValue ?? assistant.rateValue),
        sessionsCount: stored.sessionsCount,
        studentsCount: stored.studentsCount,
        amount: Number(stored.amount),
        isLocked: stored.isLocked,
      };
    }

    const method = (grp.overrideCalculationMethod ||
      assistant.calculationMethod) as AssistantCalculationMethod;
    const rate = Number(grp.overrideRateValue ?? assistant.rateValue ?? 0);
    const hoursCount = hoursByGroup.get(grp.groupId) ?? sessionsCount * 2;
    const studentsCount = Number(grp.activeStudentsCount || 0);
    const presentEntries = presentByGroup.get(grp.groupId) ?? 0;
    const sessionPrice = Number(grp.calculatedSessionPrice || 0);

    let amount = 0;
    if (method === AssistantCalculationMethod.FIXED_PER_STUDENT) {
      amount = studentsCount * rate;
    } else if (method === AssistantCalculationMethod.PER_ATTENDING_STUDENT) {
      amount = presentEntries * rate;
    } else if (method === AssistantCalculationMethod.FIXED_PER_SESSION) {
      amount = sessionsCount * rate;
    } else if (method === AssistantCalculationMethod.HOURLY) {
      amount = (hoursCount > 0 ? hoursCount : sessionsCount * 2) * rate;
    } else if (method === AssistantCalculationMethod.SESSION_COMMISSION_PERCENT) {
      const clampedRate = Math.min(100, Math.max(0, rate));
      const rev =
        presentEntries > 0
          ? presentEntries * sessionPrice
          : studentsCount * sessionsCount * sessionPrice;
      amount = (rev * clampedRate) / 100;
    } else if (method === AssistantCalculationMethod.FIXED_MONTHLY) {
      amount = grp.overrideRateValue !== null ? rate : 0;
    } else {
      amount = grp.overrideRateValue !== null ? rate : 0;
    }

    return {
      groupId: grp.groupId,
      groupName: grp.groupName,
      calculationMethod: method,
      rateValue: rate,
      sessionsCount,
      studentsCount,
      amount: round2(amount),
      isLocked: false,
    };
  });

  const globalStoredDue = storedDues.find((d) => !d.groupId);
  const hasNonOverriddenOrNoLinks =
    linkedGroups.length === 0 ||
    linkedGroups.some((g) => !g.overrideCalculationMethod && g.overrideRateValue === null);

  const baseGlobalDue = globalStoredDue
    ? Number(globalStoredDue.amount)
    : (assistant.calculationMethod === AssistantCalculationMethod.FIXED_MONTHLY ||
          assistant.calculationMethod === AssistantCalculationMethod.CUSTOM_AGREEMENT) &&
        hasNonOverriddenOrNoLinks
      ? Number(assistant.rateValue || 0)
      : 0;

  const liveTotalDues = round2(groupDues.reduce((s, d) => s + d.amount, 0) + baseGlobalDue);
  const monthPayoutsTotal = round2(
    payouts
      .filter((p) => p.yearMonth === yearMonth)
      .reduce((s, p) => s + Number(p.amount || 0), 0),
  );

  const totalDues = storedMonthlyRecord?.isClosed
    ? Number(storedMonthlyRecord.totalDues)
    : liveTotalDues;
  const totalPayouts = storedMonthlyRecord?.isClosed
    ? Number(storedMonthlyRecord.totalPaidOut)
    : monthPayoutsTotal;
  const remainingBalance = Math.max(0, round2(totalDues - totalPayouts));

  return {
    groupDues,
    baseGlobalDue,
    totalDues,
    totalPayouts,
    remainingBalance,
    isClosed: storedMonthlyRecord?.isClosed ?? false,
  };
}

function toCreatedYearMonth(createdAt?: Date | string | null): string | null {
  if (!createdAt) return null;
  const iso = createdAt instanceof Date ? createdAt.toISOString() : String(createdAt);
  const ym = iso.slice(0, 7);
  return YEAR_MONTH_REGEX.test(ym) ? ym : null;
}

export function collectAssistantYearMonths(params: {
  requestedYearMonth: string;
  currentYearMonth?: string;
  createdAt?: Date | string | null;
  bundle: Partial<AssistantBundle>;
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
    addIfValid(d.yearMonth);
  }
  for (const p of params.bundle.payouts ?? []) {
    addIfValid(p.yearMonth);
  }
  for (const s of params.bundle.allSessionCounts ?? []) {
    addIfValid(s.yearMonth);
  }

  const currentIdx = toMonthIndex(currentYm);
  const createdYm = toCreatedYearMonth(params.createdAt);
  const createdIdx = createdYm ? toMonthIndex(createdYm) : null;

  if (currentIdx !== null && createdIdx !== null && createdIdx <= currentIdx) {
    const startIdx = Math.max(createdIdx, currentIdx - 11);
    for (let idx = startIdx; idx <= currentIdx; idx++) {
      months.add(fromMonthIndex(idx));
    }
  }

  return Array.from(months).sort((a, b) => b.localeCompare(a));
}

export function buildAssistantMonthsOverview(params: {
  requestedYearMonth: string;
  currentYearMonth?: string;
  assistant: AssistantRateInput;
  bundle: AssistantBundle;
}): AssistantMonthOverviewItem[] {
  const { bundle, assistant, requestedYearMonth } = params;
  const yearMonths = collectAssistantYearMonths({
    requestedYearMonth,
    currentYearMonth: params.currentYearMonth,
    createdAt: assistant.createdAt,
    bundle,
  });

  const createdYm = toCreatedYearMonth(assistant.createdAt);

  return yearMonths.map((ym) => {
    const storedDues = bundle.allStoredDues
      ? bundle.allStoredDues.filter((d) => d.yearMonth === ym)
      : ym === requestedYearMonth
        ? bundle.storedDues
        : [];
    const storedMonthlyRecord = bundle.allStoredMonthlyRecords
      ? (bundle.allStoredMonthlyRecords.find((r) => r.yearMonth === ym) ?? null)
      : ym === requestedYearMonth
        ? bundle.storedMonthlyRecord
        : null;
    const sessionCounts = bundle.allSessionCounts
      ? bundle.allSessionCounts.filter((s) => s.yearMonth === ym)
      : ym === requestedYearMonth
        ? bundle.sessionCounts
        : [];
    const attendanceCounts = bundle.allAttendanceCounts
      ? bundle.allAttendanceCounts.filter((a) => a.yearMonth === ym)
      : ym === requestedYearMonth
        ? bundle.attendanceCounts
        : [];

    const payoutsInMonth = (bundle.payouts ?? []).filter((p) => p.yearMonth === ym);
    const executedSessionsCount = sessionCounts.reduce(
      (sum, s) => sum + Number(s.executedCount || 0),
      0,
    );

    const isBeforeCreation = Boolean(createdYm && ym < createdYm);
    const hasActivity =
      storedDues.length > 0 ||
      Boolean(storedMonthlyRecord) ||
      payoutsInMonth.length > 0 ||
      executedSessionsCount > 0;

    if (isBeforeCreation && !hasActivity) {
      return {
        yearMonth: ym,
        payoutStatus: 'NO_DUES',
        groupsCount: bundle.linkedGroups.filter((g) => g.isActive).length,
        executedSessionsCount: 0,
        totalDues: 0,
        totalPayouts: 0,
        remainingBalance: 0,
        payoutsCount: 0,
        isClosed: false,
      };
    }

    const breakdown = computeAssistantMonthlyBreakdown({
      yearMonth: ym,
      assistant,
      linkedGroups: bundle.linkedGroups,
      storedDues,
      storedMonthlyRecord,
      payouts: bundle.payouts,
      sessionCounts,
      attendanceCounts,
    });

    return {
      yearMonth: ym,
      payoutStatus: classifyAssistantPayoutStatus(
        breakdown.totalDues,
        breakdown.totalPayouts,
        breakdown.remainingBalance,
      ),
      groupsCount: bundle.linkedGroups.filter((g) => g.isActive).length,
      executedSessionsCount,
      totalDues: breakdown.totalDues,
      totalPayouts: breakdown.totalPayouts,
      remainingBalance: breakdown.remainingBalance,
      payoutsCount: payoutsInMonth.length,
      isClosed: breakdown.isClosed,
    };
  });
}
