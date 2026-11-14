import { describe, expect, it } from 'vitest';
import { AssistantCalculationMethod } from '@edu-center/shared';
import { buildAssistantYearSummary } from './assistant-year-grid.helper';

describe('buildAssistantYearSummary', () => {
  const baseAssistant = {
    assistant: {
      id: 'ast-1',
      assistantCode: 'AST-001',
      fullName: 'سارة علي',
      phone: '01000000000',
      calculationMethod: AssistantCalculationMethod.FIXED_PER_SESSION,
      rateValue: '100',
      customFormulaNote: null,
      status: 'ACTIVE' as const,
      createdAt: '2026-04-01T00:00:00.000Z',
    },
    linkedGroups: [
      {
        linkId: 'link-1',
        groupId: 'grp-1',
        groupCode: 'G-1',
        groupName: 'فيزياء',
        subject: 'فيزياء',
        gradeLevel: 'الأول الثانوي',
        teacherName: 'أ. علي',
        monthlySessionsCount: 8,
        monthlyPrice: '300',
        isActive: true,
        overrideCalculationMethod: null,
        overrideRateValue: null,
        activeStudentsCount: 20,
      },
    ],
  };

  it('marks months before creation as NOT_PRESENT, active payout states accurately, and future months UPCOMING', () => {
    const summary = buildAssistantYearSummary({
      year: 2026,
      data: baseAssistant,
      monthsList: [
        {
          yearMonth: '2026-04',
          payoutStatus: 'PAID',
          groupsCount: 1,
          executedSessionsCount: 4,
          totalDues: 400,
          totalPayouts: 400,
          remainingBalance: 0,
          payoutsCount: 1,
          isClosed: true,
        },
        {
          yearMonth: '2026-05',
          payoutStatus: 'PARTIAL',
          groupsCount: 1,
          executedSessionsCount: 4,
          totalDues: 400,
          totalPayouts: 150,
          remainingBalance: 250,
          payoutsCount: 1,
          isClosed: false,
        },
        {
          yearMonth: '2026-06',
          payoutStatus: 'UNPAID',
          groupsCount: 1,
          executedSessionsCount: 3,
          totalDues: 300,
          totalPayouts: 0,
          remainingBalance: 300,
          payoutsCount: 0,
          isClosed: false,
        },
      ],
      selectedYearMonth: '2026-06',
      currentYearMonth: '2026-09',
    });

    expect(summary.cells).toHaveLength(12);
    expect(summary.cells[0]!.state).toBe('NOT_PRESENT'); // Jan
    expect(summary.cells[2]!.state).toBe('NOT_PRESENT'); // Mar
    expect(summary.cells[3]!.state).toBe('PAID'); // Apr
    expect(summary.cells[4]!.state).toBe('PARTIAL'); // May
    expect(summary.cells[5]!.state).toBe('UNPAID'); // Jun
    expect(summary.cells[8]!.state).toBe('NO_DUES'); // Sep
    expect(summary.cells[9]!.state).toBe('UPCOMING'); // Oct
    expect(summary.cells[11]!.state).toBe('UPCOMING'); // Dec
    expect(summary.counts).toEqual({
      paid: 1,
      partial: 1,
      unpaid: 1,
      noDues: 3,
      notPresent: 3,
      upcoming: 3,
    });
    expect(summary.totals).toEqual({
      totalDue: 1100,
      totalPaid: 550,
      remaining: 550,
    });
  });
});
