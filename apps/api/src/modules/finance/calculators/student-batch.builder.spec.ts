import { describe, expect, it } from 'vitest';
import {
  AttendanceStatus,
  EnrollmentStatus,
  FullMonthAbsencePolicy,
  SessionStatus,
} from '@edu-center/shared';
import { buildStudentSettlementBatch } from './student-batch.builder';
import { MonthlySettlementSnapshot } from '../repositories/monthly-settlement-read.repository';

function createBaseSnapshot(
  overrides: Partial<MonthlySettlementSnapshot> = {},
): MonthlySettlementSnapshot {
  return {
    allGroups: [],
    allPolicies: [],
    allGroupAssistants: [],
    monthEnrollments: [],
    monthSessions: [],
    sessionAttendances: [],
    activeAssistants: [],
    existingStudentRecords: [],
    existingTeacherDues: [],
    existingTeacherRecords: [],
    existingAssistantDues: [],
    existingAssistantRecords: [],
    allocationsAgg: [],
    teacherPayoutsAgg: [],
    assistantPayoutsAgg: [],
    ...overrides,
  };
}

describe('buildStudentSettlementBatch — automatic monthly billing & exit rules', () => {
  it('immediately generates full monthly due row for an active enrollment even with zero executed sessions', () => {
    const snap = createBaseSnapshot({
      allGroups: [
        {
          id: 'grp-1',
          groupCode: 'GRP-1001',
          name: 'فيزياء 3ث',
          subject: 'فيزياء',
          gradeLevel: 'الثالث الثانوي',
          primaryTeacherId: 'tch-1',
          defaultClassroomId: null,
          monthlyPrice: '100.00',
          monthlySessionsCount: 4,
          calculatedSessionPrice: '25.00',
          maxStudents: 30,
          scheduleSlots: [],
          isActive: true,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      monthEnrollments: [
        {
          id: 'enr-1',
          studentId: 'stu-1',
          groupId: 'grp-1',
          startDate: '2026-11-19',
          endDate: null,
          agreedMonthlyPrice: '100.00',
          agreedSessionsCount: 4,
          agreedSessionPrice: '25.00',
          status: EnrollmentStatus.ACTIVE,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    const batch = buildStudentSettlementBatch('2026-11', snap);
    expect(batch.studentRows).toHaveLength(1);
    expect(batch.studentRows[0]).toMatchObject({
      studentId: 'stu-1',
      groupId: 'grp-1',
      yearMonth: '2026-11',
      totalDue: '100.00',
      totalPaid: '0.00',
      remainingBalance: '100.00',
      isClosed: false,
    });
    expect(batch.groupRevenueMap.get('grp-1')).toBe(100);
    expect(batch.groupEnrolledStudentsMap.get('grp-1')).toBe(1);
  });

  it('clears the current month fee when a student exits (CANCELLED) during that same month', () => {
    const snap = createBaseSnapshot({
      monthEnrollments: [
        {
          id: 'enr-1',
          studentId: 'stu-1',
          groupId: 'grp-1',
          startDate: '2026-11-01',
          endDate: '2026-11-19',
          agreedMonthlyPrice: '100.00',
          agreedSessionsCount: 4,
          agreedSessionPrice: '25.00',
          status: EnrollmentStatus.CANCELLED,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      existingStudentRecords: [
        {
          id: 'rec-1',
          studentId: 'stu-1',
          groupId: 'grp-1',
          yearMonth: '2026-11',
          totalGroupSessions: 0,
          eligibleSessions: 0,
          presentCount: 0,
          absentCount: 0,
          excusedCount: 0,
          makeupAttendedCount: 0,
          sessionPriceSnapshot: '25.00',
          extraMakeupFees: '0.00',
          totalDue: '100.00',
          totalPaid: '0.00',
          remainingBalance: '100.00',
          isClosed: false,
          closedAt: null,
          updatedAt: new Date(),
        },
      ],
      monthSessions: [
        {
          id: 'ses-1',
          groupId: 'grp-1',
          teacherId: 'tch-1',
          classroomId: null,
          sessionDate: '2026-11-05',
          yearMonth: '2026-11',
          startTime: '14:00',
          endTime: '16:00',
          status: SessionStatus.COMPLETED,
          topic: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      sessionAttendances: [
        {
          id: 'att-1',
          sessionId: 'ses-1',
          studentId: 'stu-1',
          status: AttendanceStatus.PRESENT,
          notes: null,
          recordedByUserId: 'usr-1',
          updatedByUserId: null,
          recordedAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    const batch = buildStudentSettlementBatch('2026-11', snap);
    expect(batch.studentRows).toHaveLength(1);
    expect(batch.studentRows[0]).toMatchObject({
      studentId: 'stu-1',
      totalDue: '0.00',
      totalPaid: '0.00',
      remainingBalance: '0.00',
      presentCount: 1,
    });
    expect(batch.groupRevenueMap.get('grp-1') ?? 0).toBe(0);
  });

  it('preserves month 11 due when student leaves in month 12, while clearing month 12 fee', () => {
    const enrollment = {
      id: 'enr-1',
      studentId: 'stu-2',
      groupId: 'grp-1',
      startDate: '2026-11-01',
      endDate: '2026-12-04',
      agreedMonthlyPrice: '100.00',
      agreedSessionsCount: 4,
      agreedSessionPrice: '25.00',
      status: EnrollmentStatus.CANCELLED,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const novBatch = buildStudentSettlementBatch(
      '2026-11',
      createBaseSnapshot({ monthEnrollments: [enrollment] }),
    );
    expect(novBatch.studentRows).toHaveLength(1);
    expect(novBatch.studentRows[0]).toMatchObject({
      yearMonth: '2026-11',
      totalDue: '100.00',
      remainingBalance: '100.00',
    });

    const decBatch = buildStudentSettlementBatch(
      '2026-12',
      createBaseSnapshot({ monthEnrollments: [enrollment] }),
    );
    expect(decBatch.studentRows).toHaveLength(0);
    expect(decBatch.groupRevenueMap.get('grp-1') ?? 0).toBe(0);
  });

  it('preserves paid balance for cancelled enrollment when prior payment exists', () => {
    const snap = createBaseSnapshot({
      monthEnrollments: [
        {
          id: 'enr-1',
          studentId: 'stu-3',
          groupId: 'grp-1',
          startDate: '2026-11-01',
          endDate: '2026-11-10',
          agreedMonthlyPrice: '320.00',
          agreedSessionsCount: 8,
          agreedSessionPrice: '40.00',
          status: EnrollmentStatus.CANCELLED,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      allocationsAgg: [
        {
          studentId: 'stu-3',
          groupId: 'grp-1',
          paidSum: '10.00',
        },
      ],
    });

    const batch = buildStudentSettlementBatch('2026-11', snap);
    expect(batch.studentRows).toHaveLength(1);
    expect(batch.studentRows[0]).toMatchObject({
      totalDue: '0.00',
      totalPaid: '10.00',
      remainingBalance: '0.00',
    });
  });

  it('prefers active enrollment when both cancelled and active enrollments exist in same month', () => {
    const snap = createBaseSnapshot({
      monthEnrollments: [
        {
          id: 'enr-old',
          studentId: 'stu-4',
          groupId: 'grp-1',
          startDate: '2026-11-01',
          endDate: '2026-11-03',
          agreedMonthlyPrice: '200.00',
          agreedSessionsCount: 8,
          agreedSessionPrice: '25.00',
          status: EnrollmentStatus.CANCELLED,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'enr-new',
          studentId: 'stu-4',
          groupId: 'grp-1',
          startDate: '2026-11-05',
          endDate: null,
          agreedMonthlyPrice: '320.00',
          agreedSessionsCount: 8,
          agreedSessionPrice: '40.00',
          status: EnrollmentStatus.ACTIVE,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      monthSessions: [
        {
          id: 'ses-2',
          groupId: 'grp-1',
          teacherId: 'tch-1',
          classroomId: null,
          sessionDate: '2026-11-06',
          yearMonth: '2026-11',
          startTime: '14:00',
          endTime: '16:00',
          status: SessionStatus.COMPLETED,
          topic: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      sessionAttendances: [
        {
          id: 'att-2',
          sessionId: 'ses-2',
          studentId: 'stu-4',
          status: AttendanceStatus.PRESENT,
          notes: null,
          recordedByUserId: 'usr-1',
          updatedByUserId: null,
          recordedAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    const batch = buildStudentSettlementBatch('2026-11', snap);
    expect(batch.studentRows[0]).toMatchObject({
      sessionPriceSnapshot: '40.00',
      totalDue: '320.00',
      presentCount: 1,
    });
  });
});
