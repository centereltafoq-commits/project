import { describe, expect, it } from 'vitest';
import { AssistantCalculationMethod } from '@edu-center/shared';
import { calculateAssistantDues } from './assistant-dues.calculator';

describe('calculateAssistantDues', () => {
  const baseMetrics = {
    executedSessionsRevenue: 4500,
    executedSessionsCount: 8,
    enrolledStudentsCount: 25,
    totalAttendancesCount: 180,
  };

  it('calculates SESSION_COMMISSION_PERCENT (primary center method) from executed sessions revenue', () => {
    const result = calculateAssistantDues({
      assistant: {
        calculationMethod: AssistantCalculationMethod.SESSION_COMMISSION_PERCENT,
        rateValue: 10,
      },
      metrics: baseMetrics,
    });

    expect(result.calculationMethod).toBe(
      AssistantCalculationMethod.SESSION_COMMISSION_PERCENT,
    );
    expect(result.amount).toBe(450); // 10% of 4500
  });

  it('supports group-level override over assistant default rate & method', () => {
    const result = calculateAssistantDues({
      assistant: {
        calculationMethod: AssistantCalculationMethod.FIXED_MONTHLY,
        rateValue: 2000,
      },
      groupOverride: {
        overrideCalculationMethod: AssistantCalculationMethod.FIXED_PER_SESSION,
        overrideRateValue: 75,
      },
      metrics: baseMetrics,
    });

    expect(result.calculationMethod).toBe(AssistantCalculationMethod.FIXED_PER_SESSION);
    expect(result.amount).toBe(600); // 75 * 8 sessions
  });

  it('calculates FIXED_PER_STUDENT, PER_ATTENDING_STUDENT, FIXED_MONTHLY, and CUSTOM_AGREEMENT', () => {
    const perStudent = calculateAssistantDues({
      assistant: {
        calculationMethod: AssistantCalculationMethod.FIXED_PER_STUDENT,
        rateValue: 15,
      },
      metrics: baseMetrics,
    });
    expect(perStudent.amount).toBe(375); // 15 * 25 enrolled

    const perAttending = calculateAssistantDues({
      assistant: {
        calculationMethod: AssistantCalculationMethod.PER_ATTENDING_STUDENT,
        rateValue: 3.5,
      },
      metrics: baseMetrics,
    });
    expect(perAttending.amount).toBe(630); // 3.5 * 180 attendances
    expect(perAttending.studentsCount).toBe(180);

    const fixedMonthly = calculateAssistantDues({
      assistant: {
        calculationMethod: AssistantCalculationMethod.FIXED_MONTHLY,
        rateValue: 2500,
      },
      metrics: baseMetrics,
    });
    expect(fixedMonthly.amount).toBe(2500);

    const customAgreement = calculateAssistantDues({
      assistant: {
        calculationMethod: AssistantCalculationMethod.CUSTOM_AGREEMENT,
        rateValue: 1750,
        customFormulaNote: 'مكافأة إدارة معمل الكيمياء + إشراف',
      },
      metrics: baseMetrics,
    });
    expect(customAgreement.amount).toBe(1750);
    expect(customAgreement.calculationBreakdown).toContain('مكافأة إدارة معمل الكيمياء');
  });

  it('preserves locked dues when existingDue.isLocked === true', () => {
    const result = calculateAssistantDues({
      assistant: {
        calculationMethod: AssistantCalculationMethod.SESSION_COMMISSION_PERCENT,
        rateValue: 25,
      },
      metrics: baseMetrics,
      existingDue: {
        isLocked: true,
        calculationMethod: AssistantCalculationMethod.SESSION_COMMISSION_PERCENT,
        sessionsCount: 8,
        studentsCount: 20,
        amount: 320,
      },
    });

    expect(result.isLocked).toBe(true);
    expect(result.amount).toBe(320);
  });
});
