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

  it('returns 0 dues across all methods when executedSessionsCount is 0', () => {
    const fixedStudent = calculateGroupRevenueSplit({
      policy: {
        revenueSplitMethod: GroupRevenueSplitMethod.FIXED_PER_STUDENT,
        monthlyPrice: 200,
        teacherSharePerStudent: 120,
        centerSharePerStudent: 80,
        teacherPercentage: 0,
      },
      grossGroupRevenue: 2400,
      billedStudentsCount: 12,
      executedSessionsCount: 0,
    });
    expect(fixedStudent.teacherAmount).toBe(0);
    expect(fixedStudent.centerAmount).toBe(0);

    const ratio = calculateGroupRevenueSplit({
      policy: {
        revenueSplitMethod: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
        monthlyPrice: 200,
        teacherSharePerStudent: 120,
        centerSharePerStudent: 80,
        teacherPercentage: 0,
      },
      grossGroupRevenue: 1000,
      billedStudentsCount: 5,
      executedSessionsCount: 0,
    });
    expect(ratio.teacherAmount).toBe(0);
    expect(ratio.centerAmount).toBe(0);
  });

  it('calculates FIXED_PER_SESSION and leaves remainder of revenue to the center', () => {
    const result = calculateGroupRevenueSplit({
      policy: {
        revenueSplitMethod: GroupRevenueSplitMethod.FIXED_PER_SESSION,
        monthlyPrice: 200,
        teacherSharePerStudent: 250, // 250 EGP per session
        centerSharePerStudent: 0,
        teacherPercentage: 0,
      },
      grossGroupRevenue: 1500,
      billedStudentsCount: 10,
      executedSessionsCount: 4,
    });

    // 4 sessions * 250 EGP = 1000 EGP to teacher; 1500 - 1000 = 500 EGP to center
    expect(result.teacherAmount).toBe(1000);
    expect(result.centerAmount).toBe(500);
    expect(result.teacherAmount + result.centerAmount).toBe(1500);
  });

  it('safely handles zero denominator and negative gross inputs without throwing or NaN', () => {
    const result = calculateGroupRevenueSplit({
      policy: {
        revenueSplitMethod: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
        monthlyPrice: 0,
        teacherSharePerStudent: 0,
        centerSharePerStudent: 0,
        teacherPercentage: 0,
      },
      grossGroupRevenue: -100,
      billedStudentsCount: 0,
      executedSessionsCount: 0,
    });

    expect(result.teacherAmount).toBe(0);
    expect(result.centerAmount).toBe(0);
    expect(result.grossGroupRevenue).toBe(0);
  });

  it('allocates remainder cleanly to the center when centerShare is omitted in FIXED_PER_STUDENT or ACTUAL_ATTENDANCE_RATIO', () => {
    const fixedStudentOmittedCenter = calculateGroupRevenueSplit({
      policy: {
        revenueSplitMethod: GroupRevenueSplitMethod.FIXED_PER_STUDENT,
        monthlyPrice: 200,
        teacherSharePerStudent: 120,
        centerSharePerStudent: 0, // Admin omitted explicit center share
        teacherPercentage: 0,
      },
      grossGroupRevenue: 2000,
      billedStudentsCount: 10,
      executedSessionsCount: 4,
    });
    // Teacher gets 10 * 120 = 1200 EGP; Center gets remainder 2000 - 1200 = 800 EGP
    expect(fixedStudentOmittedCenter.teacherAmount).toBe(1200);
    expect(fixedStudentOmittedCenter.centerAmount).toBe(800);
    expect(fixedStudentOmittedCenter.teacherAmount + fixedStudentOmittedCenter.centerAmount).toBe(2000);

    const ratioOmittedCenter = calculateGroupRevenueSplit({
      policy: {
        revenueSplitMethod: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
        monthlyPrice: 500,
        teacherSharePerStudent: 350,
        centerSharePerStudent: 0,
        teacherPercentage: 0,
      },
      grossGroupRevenue: 1000,
      billedStudentsCount: 2,
      executedSessionsCount: 4,
    });
    // Teacher gets (1000 * 350) / 500 = 700 EGP; Center gets remainder 1000 - 700 = 300 EGP
    expect(ratioOmittedCenter.teacherAmount).toBe(700);
    expect(ratioOmittedCenter.centerAmount).toBe(300);
    expect(ratioOmittedCenter.teacherAmount + ratioOmittedCenter.centerAmount).toBe(1000);
  });
});
