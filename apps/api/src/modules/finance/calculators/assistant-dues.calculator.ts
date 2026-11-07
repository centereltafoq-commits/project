import { AssistantCalculationMethod } from '@edu-center/shared';
import { roundMoney } from '../utils/money.util';

export interface AssistantRateProfileInput {
  calculationMethod: AssistantCalculationMethod | string;
  rateValue: number;
  customFormulaNote?: string | null;
}

export interface GroupAssistantOverrideInput {
  overrideCalculationMethod?: AssistantCalculationMethod | string | null;
  overrideRateValue?: number | null;
}

export interface AssistantDuesMetricsInput {
  executedSessionsRevenue: number;
  executedSessionsCount: number;
  enrolledStudentsCount: number;
  totalAttendancesCount: number;
}

export interface ExistingAssistantDueSnapshot {
  isLocked: boolean;
  calculationMethod: string;
  sessionsCount: number;
  studentsCount: number;
  amount: number;
  calculationBreakdown?: string | null;
}

export interface CalculateAssistantDuesParams {
  assistant: AssistantRateProfileInput;
  groupOverride?: GroupAssistantOverrideInput | null;
  metrics: AssistantDuesMetricsInput;
  existingDue?: ExistingAssistantDueSnapshot | null;
}

export interface AssistantDuesResult {
  calculationMethod: string;
  effectiveRateValue: number;
  sessionsCount: number;
  studentsCount: number;
  amount: number;
  calculationBreakdown: string;
  isLocked: boolean;
}

export function resolveAssistantRateConfig(
  assistant: AssistantRateProfileInput,
  groupOverride?: GroupAssistantOverrideInput | null,
): { calculationMethod: string; rateValue: number } {
  const calculationMethod =
    groupOverride?.overrideCalculationMethod || assistant.calculationMethod;
  const rateValue =
    groupOverride?.overrideRateValue !== null &&
    groupOverride?.overrideRateValue !== undefined
      ? roundMoney(groupOverride.overrideRateValue)
      : roundMoney(assistant.rateValue);

  return { calculationMethod, rateValue };
}

export function calculateAssistantDues(
  params: CalculateAssistantDuesParams,
): AssistantDuesResult {
  const { assistant, groupOverride, metrics, existingDue } = params;

  if (existingDue?.isLocked) {
    return {
      calculationMethod: existingDue.calculationMethod,
      effectiveRateValue: roundMoney(assistant.rateValue),
      sessionsCount: existingDue.sessionsCount,
      studentsCount: existingDue.studentsCount,
      amount: roundMoney(existingDue.amount),
      calculationBreakdown:
        existingDue.calculationBreakdown ?? 'سجل مقفل مالياً (مستحقات تاريخية مجمدة)',
      isLocked: true,
    };
  }

  const { calculationMethod, rateValue } = resolveAssistantRateConfig(
    assistant,
    groupOverride,
  );
  const cleanRevenue = roundMoney(Math.max(0, metrics.executedSessionsRevenue));
  const sessionsCount = Math.max(0, Math.trunc(metrics.executedSessionsCount));
  const enrolledCount = Math.max(0, Math.trunc(metrics.enrolledStudentsCount));
  const attendancesCount = Math.max(0, Math.trunc(metrics.totalAttendancesCount));

  let amount = 0;
  let studentsCount = enrolledCount;
  let calculationBreakdown = '';

  switch (calculationMethod) {
    case AssistantCalculationMethod.SESSION_COMMISSION_PERCENT: {
      amount = roundMoney((cleanRevenue * rateValue) / 100);
      calculationBreakdown = `عمولة ${rateValue}% من إيراد الحصص المنفذة (${cleanRevenue} ج.م)`;
      break;
    }

    case AssistantCalculationMethod.FIXED_PER_SESSION: {
      amount = roundMoney(rateValue * sessionsCount);
      calculationBreakdown = `${rateValue} ج.م × ${sessionsCount} حصة منفذة`;
      break;
    }

    case AssistantCalculationMethod.FIXED_PER_STUDENT: {
      amount = roundMoney(rateValue * enrolledCount);
      calculationBreakdown = `${rateValue} ج.م × ${enrolledCount} طالب مقيد`;
      break;
    }

    case AssistantCalculationMethod.PER_ATTENDING_STUDENT: {
      studentsCount = attendancesCount;
      amount = roundMoney(rateValue * attendancesCount);
      calculationBreakdown = `${rateValue} ج.م × ${attendancesCount} حضور طالب فعلي`;
      break;
    }

    case AssistantCalculationMethod.FIXED_MONTHLY: {
      amount = roundMoney(rateValue);
      calculationBreakdown = `مرتب شهري ثابت (${amount} ج.م)`;
      break;
    }

    case AssistantCalculationMethod.CUSTOM_AGREEMENT:
    default: {
      amount = roundMoney(rateValue);
      const note = assistant.customFormulaNote?.trim();
      calculationBreakdown = note
        ? `اتفاق مخصص (${amount} ج.م) — ${note}`
        : `اتفاق مخصص (${amount} ج.م)`;
      break;
    }
  }

  return {
    calculationMethod,
    effectiveRateValue: rateValue,
    sessionsCount,
    studentsCount,
    amount,
    calculationBreakdown,
    isLocked: false,
  };
}
