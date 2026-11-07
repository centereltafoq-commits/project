import { describe, expect, it } from 'vitest';
import { GroupRevenueSplitMethod } from '@edu-center/shared';
import { calculateGroupRevenueSplit } from './revenue-split.calculator';

describe('calculateGroupRevenueSplit', () => {
  it('splits ACTUAL_ATTENDANCE_RATIO proportionally (7/10 sessions = 126 EGP -> 70 teacher / 56 center)', () => {
    const result = calculateGroupRevenueSplit({
      policy: {
        revenueSplitMethod: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
        monthlyPrice: 180,
        teacherSharePerStudent: 100,
        centerSharePerStudent: 80,
        teacherPercentage: 0,
      },
      grossGroupRevenue: 126,
      billedStudentsCount: 1,
      executedSessionsCount: 10,
    });

    expect(result.teacherAmount).toBe(70);
    expect(result.centerAmount).toBe(56);
    expect(result.teacherAmount + result.centerAmount).toBe(126);
  });

  it('splits FIXED_PER_STUDENT by billedStudentsCount (100 teacher / 80 center per student)', () => {
    const result = calculateGroupRevenueSplit({
      policy: {
        revenueSplitMethod: GroupRevenueSplitMethod.FIXED_PER_STUDENT,
        monthlyPrice: 180,
        teacherSharePerStudent: 100,
        centerSharePerStudent: 80,
        teacherPercentage: 0,
      },
      grossGroupRevenue: 2520,
      billedStudentsCount: 15,
      executedSessionsCount: 8,
    });

    expect(result.teacherAmount).toBe(1500);
    expect(result.centerAmount).toBe(1200);
  });

  it('splits CUSTOM_PERCENTAGE cleanly to 2 decimal places without penny drift', () => {
    const result = calculateGroupRevenueSplit({
      policy: {
        revenueSplitMethod: GroupRevenueSplitMethod.CUSTOM_PERCENTAGE,
        monthlyPrice: 200,
        teacherSharePerStudent: 0,
        centerSharePerStudent: 0,
        teacherPercentage: 65.5,
      },
      grossGroupRevenue: 1333.33,
      billedStudentsCount: 8,
      executedSessionsCount: 8,
    });

    expect(result.teacherAmount).toBe(873.33);
    expect(result.centerAmount).toBe(460);
    expect(Number((result.teacherAmount + result.centerAmount).toFixed(2))).toBe(1333.33);
  });

  it('preserves locked historical figures when existingDue.isLocked === true', () => {
    const result = calculateGroupRevenueSplit({
      policy: {
        revenueSplitMethod: GroupRevenueSplitMethod.CUSTOM_PERCENTAGE,
        monthlyPrice: 300,
        teacherSharePerStudent: 200,
        centerSharePerStudent: 100,
        teacherPercentage: 80,
      },
      grossGroupRevenue: 5000,
      billedStudentsCount: 20,
      executedSessionsCount: 10,
      existingDue: {
        isLocked: true,
        executedSessionsCount: 8,
        studentsCount: 12,
        grossGroupRevenue: 2160,
        teacherAmount: 1200,
        centerAmount: 960,
        calculationBreakdown: 'Frozen split',
      },
    });

    expect(result.isLocked).toBe(true);
    expect(result.teacherAmount).toBe(1200);
    expect(result.centerAmount).toBe(960);
    expect(result.grossGroupRevenue).toBe(2160);
  });
});
