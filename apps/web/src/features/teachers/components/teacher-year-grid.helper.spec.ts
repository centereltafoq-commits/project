import { describe, expect, it } from 'vitest';
import { TeacherEmploymentStatus } from '@edu-center/shared';
import { buildTeacherYearSummary } from './teacher-year-grid.helper';

describe('buildTeacherYearSummary', () => {
  const baseTeacher = {
    teacher: {
      id: 't-1',
      teacherCode: 'TCH-001',
      fullName: 'أ. محمود',
      phone: '01000000000',
      specialization: 'فيزياء',
      contractDate: '2026-03-10',
      employmentStatus: TeacherEmploymentStatus.ACTIVE,
      userId: null,
      notes: null,
      createdAt: '2026-03-10T00:00:00.000Z',
    },
    assignedGroups: [
      {
        id: 'grp-1',
        groupCode: 'GRP-1',
        name: 'أولى ثانوي',
        subject: 'فيزياء',
        gradeLevel: 'الأول الثانوي',
        monthlySessionsCount: 8,
        monthlyPrice: '300.00',
        isActive: true,
        activeStudentsCount: 15,
      },
    ],
  };

  it('classifies before contract as NOT_PRESENT, active payout months, NO_DUES, and future months as UPCOMING', () => {
    const summary = buildTeacherYearSummary({
      year: 2026,
      data: baseTeacher,
      monthsList: [
        {
          yearMonth: '2026-03',
          payoutStatus: 'PAID',
          groupsCount: 1,
          executedSessionsCount: 8,
          totalDues: 2000,
          totalPayouts: 2000,
          remainingBalance: 0,
          payoutsCount: 1,
          isClosed: true,
        },
        {
          yearMonth: '2026-04',
          payoutStatus: 'PARTIAL',
          groupsCount: 1,
          executedSessionsCount: 8,
          totalDues: 2000,
          totalPayouts: 800,
          remainingBalance: 1200,
          payoutsCount: 1,
          isClosed: false,
        },
        {
          yearMonth: '2026-05',
          payoutStatus: 'UNPAID',
          groupsCount: 1,
          executedSessionsCount: 6,
          totalDues: 1500,
          totalPayouts: 0,
          remainingBalance: 1500,
          payoutsCount: 0,
          isClosed: false,
        },
      ],
      selectedYearMonth: '2026-05',
      currentYearMonth: '2026-10',
    });

    expect(summary.cells).toHaveLength(12);
    expect(summary.cells[0]!.state).toBe('NOT_PRESENT'); // Jan
    expect(summary.cells[1]!.state).toBe('NOT_PRESENT'); // Feb
    expect(summary.cells[2]!.state).toBe('PAID'); // Mar
    expect(summary.cells[3]!.state).toBe('PARTIAL'); // Apr
    expect(summary.cells[4]!.state).toBe('UNPAID'); // May
    expect(summary.cells[5]!.state).toBe('NO_DUES'); // Jun
    expect(summary.cells[9]!.state).toBe('NO_DUES'); // Oct
    expect(summary.cells[10]!.state).toBe('UPCOMING'); // Nov
    expect(summary.cells[11]!.state).toBe('UPCOMING'); // Dec
    expect(summary.totals).toEqual({
      totalDue: 5500,
      totalPaid: 2800,
      remaining: 2700,
    });
    expect(summary.counts).toEqual({
      paid: 1,
      partial: 1,
      unpaid: 1,
      noDues: 5,
      notPresent: 2,
      upcoming: 2,
    });
  });
});
