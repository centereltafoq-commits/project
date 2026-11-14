import { describe, expect, it } from 'vitest';
import { EnrollmentStatus, StudentStatus } from '@edu-center/shared';
import { StudentProfileData } from '../students.types';
import { buildStudentYearSummary } from './student-year-grid.helper';

describe('buildStudentYearSummary', () => {
  const baseProfile: StudentProfileData = {
    student: {
      id: 'stu-1',
      studentCode: 'STU-001',
      fullName: 'يوسف أحمد',
      phone: null,
      guardianPhone: null,
      gradeLevel: 'الأول الثانوي',
      registrationDate: '2026-03-05',
      status: StudentStatus.ACTIVE,
      notes: null,
      createdAt: '2026-03-05T00:00:00.000Z',
    },
    yearMonth: '2026-11',
    enrollments: [
      {
        id: 'enr-1',
        groupId: 'grp-1',
        groupCode: 'GRP-1',
        groupName: 'فيزياء',
        subject: 'فيزياء',
        gradeLevel: 'الأول الثانوي',
        teacherName: 'أ. علي',
        startDate: '2026-03-05',
        endDate: null,
        agreedMonthlyPrice: '300.00',
        agreedSessionsCount: 8,
        agreedSessionPrice: '37.50',
        status: EnrollmentStatus.ACTIVE,
        notes: null,
      },
    ],
    attendanceRecords: [],
    monthlyBreakdown: [],
    monthTotals: {
      totalSessions: 0,
      presentCount: 0,
      absentCount: 0,
      excusedCount: 0,
      totalDue: 0,
      totalPaid: 0,
      remaining: 0,
    },
    payments: [],
  };

  it('classifies paid, partial, unpaid, not_present (before enrollment), and upcoming months across all 12 months', () => {
    const monthsList = [
      {
        yearMonth: '2026-03',
        paymentStatus: 'PAID' as const,
        totalSessions: 4,
        presentCount: 4,
        absentCount: 0,
        excusedCount: 0,
        totalDue: 300,
        totalPaid: 300,
        remaining: 0,
        groupsCount: 1,
        paymentsCount: 1,
        isClosed: true,
      },
      {
        yearMonth: '2026-04',
        paymentStatus: 'PARTIAL' as const,
        totalSessions: 4,
        presentCount: 3,
        absentCount: 1,
        excusedCount: 0,
        totalDue: 300,
        totalPaid: 100,
        remaining: 200,
        groupsCount: 1,
        paymentsCount: 1,
        isClosed: false,
      },
      {
        yearMonth: '2026-05',
        paymentStatus: 'UNPAID' as const,
        totalSessions: 4,
        presentCount: 4,
        absentCount: 0,
        excusedCount: 0,
        totalDue: 300,
        totalPaid: 0,
        remaining: 300,
        groupsCount: 1,
        paymentsCount: 0,
        isClosed: false,
      },
    ];

    const summary = buildStudentYearSummary({
      year: 2026,
      data: baseProfile,
      monthsList,
      selectedYearMonth: '2026-05',
      currentYearMonth: '2026-11',
    });

    expect(summary.cells).toHaveLength(12);
    // Jan & Feb are before registration/enrollment -> NOT_PRESENT
    expect(summary.cells[0]!.state).toBe('NOT_PRESENT');
    expect(summary.cells[1]!.state).toBe('NOT_PRESENT');
    // Mar -> PAID, Apr -> PARTIAL, May -> UNPAID
    expect(summary.cells[2]!.state).toBe('PAID');
    expect(summary.cells[3]!.state).toBe('PARTIAL');
    expect(summary.cells[4]!.state).toBe('UNPAID');
    // Jun..Nov have enrollment but no sessions/dues -> NO_DUES
    expect(summary.cells[5]!.state).toBe('NO_DUES');
    // Dec (with active ongoing enrollment or future month)
    expect(summary.counts).toEqual({
      paid: 1,
      partial: 1,
      unpaid: 1,
      noDues: 7,
      notPresent: 2,
      upcoming: 0,
    });
    expect(summary.totals).toEqual({
      totalDue: 900,
      totalPaid: 400,
      remaining: 500,
    });
  });

  it('marks un-enrolled student months including current month as NOT_PRESENT and future month as UPCOMING', () => {
    const unenrolledProfile: StudentProfileData = {
      ...baseProfile,
      enrollments: [],
    };

    const summary = buildStudentYearSummary({
      year: 2026,
      data: unenrolledProfile,
      monthsList: [
        {
          yearMonth: '2026-11',
          paymentStatus: 'NO_DUES',
          totalSessions: 0,
          presentCount: 0,
          absentCount: 0,
          excusedCount: 0,
          totalDue: 0,
          totalPaid: 0,
          remaining: 0,
          groupsCount: 0,
          paymentsCount: 0,
          isClosed: false,
        },
      ],
      selectedYearMonth: '2026-11',
      currentYearMonth: '2026-11',
    });

    expect(summary.cells[10]!.state).toBe('NOT_PRESENT'); // Nov (0 groups, 0 dues)
    expect(summary.cells[11]!.state).toBe('UPCOMING'); // Dec (future, not enrolled)
  });
});
