import { GroupRevenueSplitMethod } from '@edu-center/shared';
import { roundMoney } from '../utils/money.util';

export interface GroupRevenueSplitPolicyInput {
  revenueSplitMethod: GroupRevenueSplitMethod | string;
  monthlyPrice: number;
  teacherSharePerStudent: number;
  centerSharePerStudent: number;
  teacherPercentage: number;
}

export interface ExistingTeacherDueSnapshot {
  isLocked: boolean;
  executedSessionsCount: number;
  studentsCount: number;
  grossGroupRevenue: number;
  teacherAmount: number;
  centerAmount: number;
  calculationBreakdown?: string | null;
}

export interface CalculateRevenueSplitParams {
  policy: GroupRevenueSplitPolicyInput;
  grossGroupRevenue: number;
  billedStudentsCount: number;
  executedSessionsCount: number;
  existingDue?: ExistingTeacherDueSnapshot | null;
}

export interface RevenueSplitResult {
  executedSessionsCount: number;
  studentsCount: number;
  grossGroupRevenue: number;
  teacherAmount: number;
  centerAmount: number;
  calculationBreakdown: string;
  isLocked: boolean;
}

export function calculateGroupRevenueSplit(
  params: CalculateRevenueSplitParams,
): RevenueSplitResult {
  const {
    policy,
    grossGroupRevenue,
    billedStudentsCount,
    executedSessionsCount,
    existingDue,
  } = params;

  if (existingDue?.isLocked) {
    return {
      executedSessionsCount: existingDue.executedSessionsCount,
      studentsCount: existingDue.studentsCount,
      grossGroupRevenue: roundMoney(existingDue.grossGroupRevenue),
      teacherAmount: roundMoney(existingDue.teacherAmount),
      centerAmount: roundMoney(existingDue.centerAmount),
      calculationBreakdown:
        existingDue.calculationBreakdown ?? 'سجل مقفل مالياً (أسعار تاريخية مجمدة)',
      isLocked: true,
    };
  }

  const cleanGross = roundMoney(Math.max(0, grossGroupRevenue));
  const teacherShare = roundMoney(Math.max(0, policy.teacherSharePerStudent));
  const centerShare = roundMoney(Math.max(0, policy.centerSharePerStudent));
  const monthlyPrice = roundMoney(Math.max(0, policy.monthlyPrice));

  let teacherAmount = 0;
  let centerAmount = 0;
  let calculationBreakdown = '';

  switch (policy.revenueSplitMethod) {
    case GroupRevenueSplitMethod.FIXED_PER_STUDENT: {
      if (executedSessionsCount === 0 || cleanGross <= 0 || billedStudentsCount === 0) {
        teacherAmount = 0;
        centerAmount = 0;
        calculationBreakdown = `مبلغ ثابت لكل طالب (0 مستحق لعدم تنفيذ حصص أو غياب الإيراد)`;
      } else {
        teacherAmount = roundMoney(billedStudentsCount * teacherShare);
        centerAmount =
          centerShare > 0
            ? roundMoney(billedStudentsCount * centerShare)
            : roundMoney(Math.max(0, cleanGross - teacherAmount));
        calculationBreakdown = `مبلغ ثابت لكل طالب (${billedStudentsCount} طالب × ${teacherShare} ج.م مدرس / ${centerAmount} ج.م سنتر)`;
      }
      break;
    }

    case GroupRevenueSplitMethod.FIXED_PER_SESSION: {
      if (executedSessionsCount === 0 || cleanGross <= 0) {
        teacherAmount = 0;
        centerAmount = 0;
        calculationBreakdown = `مبلغ ثابت لكل حصة (0 مستحق لعدم تنفيذ حصص أو غياب الإيراد)`;
      } else {
        teacherAmount = Math.min(cleanGross, roundMoney(executedSessionsCount * teacherShare));
        centerAmount = roundMoney(cleanGross - teacherAmount);
        calculationBreakdown = `مبلغ ثابت لكل حصة (${executedSessionsCount} حصة × ${teacherShare} ج.م مدرس / ${centerAmount} ج.م سنتر من إجمالي ${cleanGross} ج.م)`;
      }
      break;
    }

    case GroupRevenueSplitMethod.CUSTOM_PERCENTAGE: {
      if (executedSessionsCount === 0 || cleanGross <= 0) {
        teacherAmount = 0;
        centerAmount = 0;
        calculationBreakdown = `نسبة مئوية مخصصة (0 مستحق لعدم تنفيذ حصص أو غياب الإيراد)`;
      } else {
        const clampedPct = Math.min(100, Math.max(0, roundMoney(policy.teacherPercentage)));
        const centerPct = roundMoney(100 - clampedPct);
        teacherAmount = roundMoney((cleanGross * clampedPct) / 100);
        centerAmount = roundMoney(cleanGross - teacherAmount);
        calculationBreakdown = `نسبة مئوية مخصصة (${clampedPct}% مدرس / ${centerPct}% سنتر من إجمالي ${cleanGross} ج.م)`;
      }
      break;
    }

    case GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO:
    default: {
      const sharesSum = roundMoney(teacherShare + centerShare);
      const denominator = monthlyPrice > 0 ? monthlyPrice : sharesSum;

      if (denominator <= 0 || cleanGross <= 0 || executedSessionsCount === 0) {
        teacherAmount = 0;
        centerAmount = 0;
        calculationBreakdown = `نسبة الحضور الفعلي (0 مستحق لعدم تنفيذ حصص أو غياب الإيراد)`;
      } else {
        teacherAmount = Math.min(cleanGross, roundMoney((cleanGross * teacherShare) / denominator));
        if (centerShare <= 0 || Math.abs(sharesSum - denominator) < 0.01) {
          centerAmount = roundMoney(cleanGross - teacherAmount);
        } else {
          centerAmount = roundMoney((cleanGross * centerShare) / denominator);
        }
        calculationBreakdown = `نسبة الحضور الفعلي (${teacherShare}/${denominator} مدرس و ${centerShare}/${denominator} سنتر من إجمالي ${cleanGross} ج.م)`;
      }
      break;
    }
  }

  return {
    executedSessionsCount,
    studentsCount: billedStudentsCount,
    grossGroupRevenue: cleanGross,
    teacherAmount,
    centerAmount,
    calculationBreakdown,
    isLocked: false,
  };
}
