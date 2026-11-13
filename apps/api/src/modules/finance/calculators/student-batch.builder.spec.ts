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

describe('buildStudentSettlementBatch — cancelled enrollment & settlement preservation', () => {
  it('bills a cancelled mid-month enrollment for sessions attended before cancellation', () => {
    const snap = createBaseSnapshot({
      allGroups: [
        {
          id: 'grp-1',
          groupCode: 'GRP-9882',
          name: 'مجموعة QA 1211',
          subject: 'رياضيات',
          gradeLevel: 'الثاني الثانوي',
          primaryTeacherId: 'tch-1',
          defaultClassroomId: null,
          monthlyPrice: '320.00',
          monthlySessionsCount: 8,
          calculatedSessionPrice: '40.00',
          maxStudents: 30,
          scheduleSlots: [],
          isActive: true,
          notes: null,
          createdAt: new Date('2026-11-12T00:00:00Z'),
          updatedAt: new Date('2026-11-12T00:00:00Z'),
        },
      ],
      monthEnrollments: [
        {
          id: 'enr-1',
          studentId: 'stu-1',
          groupId: 'grp-1',
          startDate: '2026-11-12',
          endDate: '2026-11-12',
          agreedMonthlyPrice: '320.00',
          agreedSessionsCount: 8,
          agreedSessionPrice: '40.00',
          status: EnrollmentStatus.CANCELLED,
          notes: null,
          createdAt: new Date('2026-11-12T00:00:00Z'),
          updatedAt: new Date('2026-11-12T14:26:34Z'),
        },
      ],
      monthSessions: [
        {
          id: 'ses-1',
          groupId: 'grp-1',
          teacherId: 'tch-1',
          classroomId: null,
          sessionDate: '2026-11-12',
          yearMonth: '2026-11',
          startTime: '14:00',
          endTime: '16:00',
          status: SessionStatus.COMPLETED,
          topic: null,
          notes: null,
          createdAt: new Date('2026-11-12T00:00:00Z'),
          updatedAt: new Date('2026-11-12T00:00:00Z'),
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
          updatedByUserId: 'usr-1',
          recordedAt: new Date('2026-11-12T14:20:00Z'),
          updatedAt: new Date('2026-11-12T14:20:00Z'),
        },
      ],
      allocationsAgg: [
        {
          studentId: 'stu-1',
          groupId: 'grp-1',
          paidSum: '15.00',
        },
      ],
    });

    const batch = buildStudentSettlementBatch('2026-11', snap);
    expect(batch.studentRows).toHaveLength(1);
    expect(batch.studentRows[0]).toMatchObject({
      studentId: 'stu-1',
      groupId: 'grp-1',
      totalGroupSessions: 1,
      eligibleSessions: 1,
      presentCount: 1,
      sessionPriceSnapshot: '40.00',
      totalDue: '40.00',
      totalPaid: '15.00',
      remainingBalance: '25.00',
      isClosed: false,
    });
    expect(batch.groupRevenueMap.get('grp-1')).toBe(40);
    expect(batch.groupBilledStudentsMap.get('grp-1')).toBe(1);
    expect(batch.groupEnrolledStudentsMap.get('grp-1')).toBe(1);
  });

  it('does not charge a cancelled enrollment that ended before any executed group session ran', () => {
    const snap = createBaseSnapshot({
      allPolicies: [
        {
          id: 'pol-1',
          groupId: 'grp-1',
          revenueSplitMethod: 'ACTUAL_ATTENDANCE_RATIO' as any,
          teacherSharePerStudent: '0.00',
          centerSharePerStudent: '0.00',
          teacherPercentage: '75.00',
          fullMonthAbsencePolicy: FullMonthAbsencePolicy.CHARGE_FULL_SUBSCRIPTION,
          fullAbsenceFixedFee: '50.00',
          chargeExcusedAbsence: false,
          updatedAt: new Date(),
        },
      ],
      monthEnrollments: [
        {
          id: 'enr-1',
          studentId: 'stu-2',
          groupId: 'grp-1',
          startDate: '2026-11-01',
          endDate: '2026-11-01',
          agreedMonthlyPrice: '320.00',
          agreedSessionsCount: 8,
          agreedSessionPrice: '40.00',
          status: EnrollmentStatus.CANCELLED,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      monthSessions: [
        {
          id: 'ses-1',
          groupId: 'grp-1',
          teacherId: 'tch-1',
          classroomId: null,
          sessionDate: '2026-11-02',
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
          studentId: 'stu-2',
          status: AttendanceStatus.ABSENT,
          notes: null,
          recordedByUserId: 'usr-1',
          updatedByUserId: null,
          recordedAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });

    const batch = buildStudentSettlementBatch('2026-11', snap);
    expect(batch.studentRows).toHaveLength(0);
    expect(batch.groupRevenueMap.get('grp-1') ?? 0).toBe(0);
    expect(batch.groupEnrolledStudentsMap.get('grp-1') ?? 0).toBe(0);
  });

  it('preserves paid balance for zero-session cancelled enrollment when prior payment exists', () => {
    const snap = createBaseSnapshot({
      monthEnrollments: [
        {
          id: 'enr-1',
          studentId: 'stu-3',
          groupId: 'grp-1',
          startDate: '2026-11-01',
          endDate: '2026-11-01',
          agreedMonthlyPrice: '320.00',
          agreedSessionsCount: 8,
          agreedSessionPrice: '40.00',
          status: EnrollmentStatus.CANCELLED,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      monthSessions: [
        {
          id: 'ses-1',
          groupId: 'grp-1',
          teacherId: 'tch-1',
          classroomId: null,
          sessionDate: '2026-11-02',
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
      presentCount: 0,
    });
  });

  it('prefers non-cancelled enrollment when both cancelled and active enrollments exist in same month', () => {
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
      totalDue: '40.00',
      presentCount: 1,
    });
  });
});
