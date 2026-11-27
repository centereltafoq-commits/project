import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  AttendanceStatus,
  EnrollmentStatus,
  FullMonthAbsencePolicy,
  PERMISSIONS,
  SessionStatus,
  SystemRole,
} from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EnrollmentsService } from './enrollments.service';

describe('EnrollmentsService - Monthly Payment & Attendance Summary', () => {
  let service: EnrollmentsService;
  let mockGroupsRepo: any;
  let mockEnrollmentsRepo: any;
  let mockAudit: any;

  const ownerActor: AuthenticatedUser = {
    id: 'owner-1',
    email: 'owner@center.com',
    fullName: 'Owner',
    roleCode: SystemRole.OWNER,
    permissions: [],
  };

  const attendanceOnlyActor: AuthenticatedUser = {
    id: 'staff-1',
    email: 'staff@center.com',
    fullName: 'Attendance Staff',
    roleCode: SystemRole.ATTENDANCE_STAFF,
    permissions: [PERMISSIONS.ENROLLMENTS_VIEW],
  };

  beforeEach(() => {
    mockGroupsRepo = {
      findDetailById: vi.fn().mockResolvedValue({ id: 'grp-1', name: 'فيزياء 3ث' }),
    };

    mockEnrollmentsRepo = {
      findPaginatedByGroup: vi.fn().mockResolvedValue({
        rows: [
          {
            id: 'enr-1',
            studentId: 'stu-1',
            studentCode: 'STU-001',
            studentName: 'أحمد علي',
            studentPhone: '0101',
            guardianPhone: '0102',
            gradeLevel: 'الثالث الثانوي',
            groupId: 'grp-1',
            startDate: '2026-11-01',
            endDate: null,
            agreedMonthlyPrice: '400.00',
            agreedSessionsCount: 4,
            agreedSessionPrice: '100.00',
            status: EnrollmentStatus.ACTIVE,
            notes: null,
          },
          {
            id: 'enr-2',
            studentId: 'stu-2',
            studentCode: 'STU-002',
            studentName: 'سارة حسن',
            studentPhone: '0103',
            guardianPhone: '0104',
            gradeLevel: 'الثالث الثانوي',
            groupId: 'grp-1',
            startDate: '2026-11-01',
            endDate: null,
            agreedMonthlyPrice: '400.00',
            agreedSessionsCount: 4,
            agreedSessionPrice: '100.00',
            status: EnrollmentStatus.ACTIVE,
            notes: null,
          },
          {
            id: 'enr-3',
            studentId: 'stu-3',
            studentCode: 'STU-003',
            studentName: 'كريم محمود',
            studentPhone: '0105',
            guardianPhone: '0106',
            gradeLevel: 'الثالث الثانوي',
            groupId: 'grp-1',
            startDate: '2026-11-10',
            endDate: null,
            agreedMonthlyPrice: '400.00',
            agreedSessionsCount: 4,
            agreedSessionPrice: '100.00',
            status: EnrollmentStatus.ACTIVE,
            notes: null,
          },
          {
            id: 'enr-4',
            studentId: 'stu-4',
            studentCode: 'STU-004',
            studentName: 'منى طارق',
            studentPhone: '0107',
            guardianPhone: '0108',
            gradeLevel: 'الثالث الثانوي',
            groupId: 'grp-1',
            startDate: '2026-11-01',
            endDate: '2026-11-19',
            agreedMonthlyPrice: '400.00',
            agreedSessionsCount: 4,
            agreedSessionPrice: '100.00',
            status: EnrollmentStatus.CANCELLED,
            notes: null,
          },
          {
            id: 'enr-5',
            studentId: 'stu-5',
            studentCode: 'STU-005',
            studentName: 'يوسف سامي',
            studentPhone: '0109',
            guardianPhone: '0110',
            gradeLevel: 'الثالث الثانوي',
            groupId: 'grp-1',
            startDate: '2026-11-01',
            endDate: '2026-12-05',
            agreedMonthlyPrice: '400.00',
            agreedSessionsCount: 4,
            agreedSessionPrice: '100.00',
            status: EnrollmentStatus.CANCELLED,
            notes: null,
          },
        ],
        total: 5,
        page: 1,
        limit: 20,
      }),
      findGroupMonthActivity: vi.fn().mockResolvedValue({
        policy: {
          fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
          fullAbsenceFixedFee: 0,
          chargeExcusedAbsence: false,
        },
        monthSessions: [
          { id: 'ses-1', sessionDate: '2026-11-02', status: SessionStatus.COMPLETED },
          { id: 'ses-2', sessionDate: '2026-11-09', status: SessionStatus.COMPLETED },
          { id: 'ses-3', sessionDate: '2026-11-16', status: SessionStatus.SCHEDULED },
          { id: 'ses-4', sessionDate: '2026-11-23', status: SessionStatus.SCHEDULED },
        ],
        sessionIdsWithAttendance: new Set(['ses-1', 'ses-2', 'ses-3']),
        attendanceRows: [
          { sessionId: 'ses-1', studentId: 'stu-1', status: AttendanceStatus.PRESENT },
          { sessionId: 'ses-2', studentId: 'stu-1', status: AttendanceStatus.PRESENT },
          { sessionId: 'ses-3', studentId: 'stu-1', status: AttendanceStatus.ABSENT },
          { sessionId: 'ses-1', studentId: 'stu-2', status: AttendanceStatus.PRESENT },
          { sessionId: 'ses-2', studentId: 'stu-2', status: AttendanceStatus.EXCUSED },
          { sessionId: 'ses-3', studentId: 'stu-2', status: AttendanceStatus.ABSENT },
          { sessionId: 'ses-3', studentId: 'stu-3', status: AttendanceStatus.PRESENT },
        ],
        storedRecords: [],
        allocatedByStudent: new Map([
          ['stu-1', 400], // PAID full 400
          ['stu-2', 150], // PARTIAL (400 due, 150 paid)
          // stu-3: active, 0 paid -> UNPAID (400 due)
          // stu-4: cancelled in month 11 -> NO_DUES (0 due)
          // stu-5: cancelled in month 12 -> month 11 still UNPAID (400 due)
        ]),
      }),
    };

    mockAudit = { record: vi.fn() };
    service = new EnrollmentsService(mockGroupsRepo, mockEnrollmentsRepo, mockAudit);
  });

  it('computes PAID, PARTIAL, UNPAID, NO_DUES and attendance counters accurately for selected month', async () => {
    const result = await service.listEnrollments(
      'grp-1',
      { page: 1, limit: 20, yearMonth: '2026-11' },
      ownerActor,
    );

    expect(mockEnrollmentsRepo.findGroupMonthActivity).toHaveBeenCalledWith(
      'grp-1',
      '2026-11',
      ['stu-1', 'stu-2', 'stu-3', 'stu-4', 'stu-5'],
    );

    const [s1, s2, s3, s4, s5] = result.data;
    expect(s1.monthSummary).toEqual({
      yearMonth: '2026-11',
      paymentStatus: 'PAID',
      totalDue: 400,
      totalPaid: 400,
      remaining: 0,
      totalSessions: 3,
      presentCount: 2,
      absentCount: 1,
      excusedCount: 0,
      isClosed: false,
    });

    expect(s2.monthSummary).toEqual({
      yearMonth: '2026-11',
      paymentStatus: 'PARTIAL',
      totalDue: 400,
      totalPaid: 150,
      remaining: 250,
      totalSessions: 3,
      presentCount: 1,
      absentCount: 1,
      excusedCount: 1,
      isClosed: false,
    });

    // Active student automatically owes full 400 regardless of session count
    expect(s3.monthSummary).toEqual({
      yearMonth: '2026-11',
      paymentStatus: 'UNPAID',
      totalDue: 400,
      totalPaid: 0,
      remaining: 400,
      totalSessions: 1,
      presentCount: 1,
      absentCount: 0,
      excusedCount: 0,
      isClosed: false,
    });

    // Cancelled during 2026-11 -> fees cleared for 2026-11
    expect(s4.monthSummary).toEqual({
      yearMonth: '2026-11',
      paymentStatus: 'NO_DUES',
      totalDue: 0,
      totalPaid: 0,
      remaining: 0,
      totalSessions: 3,
      presentCount: 0,
      absentCount: 0,
      excusedCount: 0,
      isClosed: false,
    });

    // Cancelled in 2026-12 -> 2026-11 dues remain owed!
    expect(s5.monthSummary).toEqual({
      yearMonth: '2026-11',
      paymentStatus: 'UNPAID',
      totalDue: 400,
      totalPaid: 0,
      remaining: 400,
      totalSessions: 3,
      presentCount: 0,
      absentCount: 0,
      excusedCount: 0,
      isClosed: false,
    });
  });

  it('masks financial figures and paymentStatus while keeping attendance visible when lacking FINANCE_VIEW', async () => {
    const result = await service.listEnrollments(
      'grp-1',
      { page: 1, limit: 20, yearMonth: '2026-11' },
      attendanceOnlyActor,
    );

    const [s1] = result.data;
    expect(s1.monthSummary).toEqual({
      yearMonth: '2026-11',
      paymentStatus: null,
      totalDue: 0,
      totalPaid: 0,
      remaining: 0,
      totalSessions: 3,
      presentCount: 2,
      absentCount: 1,
      excusedCount: 0,
      isClosed: false,
    });
  });

  it('preserves closed month snapshots without overwriting dues', async () => {
    mockEnrollmentsRepo.findGroupMonthActivity.mockResolvedValueOnce({
      policy: null,
      monthSessions: [],
      sessionIdsWithAttendance: new Set<string>(),
      attendanceRows: [],
      storedRecords: [
        {
          studentId: 'stu-1',
          isClosed: true,
          totalGroupSessions: 4,
          eligibleSessions: 4,
          presentCount: 3,
          absentCount: 1,
          excusedCount: 0,
          sessionPriceSnapshot: '100.00',
          totalDue: '400.00',
          totalPaid: '400.00',
        },
      ],
      allocatedByStudent: new Map<string, number>(),
    });

    const result = await service.listEnrollments(
      'grp-1',
      { page: 1, limit: 20, yearMonth: '2026-10' },
      ownerActor,
    );

      expect(result.data[0].monthSummary).toEqual({
      yearMonth: '2026-10',
      paymentStatus: 'PAID',
      totalDue: 400,
      totalPaid: 400,
      remaining: 0,
      totalSessions: 4,
      presentCount: 3,
      absentCount: 1,
      excusedCount: 0,
      isClosed: true,
    });
  });

  it('bulk subscribes deduplicated students once and recalculates affected month once', async () => {
    const mockSettlement = { recalculateMonth: vi.fn().mockResolvedValue(undefined) };
    const mockCache = { invalidatePrefix: vi.fn().mockResolvedValue(undefined) };

    mockGroupsRepo.findDetailById.mockResolvedValue({
      id: 'grp-1',
      name: 'فيزياء 3ث',
      isActive: true,
      monthlyPrice: '400.00',
      monthlySessionsCount: 4,
      maxStudents: 30,
    });
    mockEnrollmentsRepo.createBulkWithOptionalTransfer = vi.fn().mockResolvedValue({
      created: [
        { id: 'enr-10', studentId: 'stu-1' },
        { id: 'enr-11', studentId: 'stu-2' },
      ],
      skippedAlreadyEnrolledCount: 1,
      transferredCount: 0,
    });

    const svcWithSettlement = new EnrollmentsService(
      mockGroupsRepo,
      mockEnrollmentsRepo,
      mockAudit,
      mockSettlement as any,
      mockCache as any,
    );

    const res = await svcWithSettlement.bulkSubscribeStudents(
      'grp-1',
      {
        studentIds: ['stu-1', 'stu-2', 'stu-1', 'stu-3'],
        startDate: '2026-11-05',
      },
      ownerActor,
    );

    expect(mockEnrollmentsRepo.createBulkWithOptionalTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 'grp-1',
        skipAlreadyEnrolled: true,
        rows: expect.arrayContaining([
          expect.objectContaining({
            studentId: 'stu-1',
            agreedMonthlyPrice: '400.00',
            agreedSessionsCount: 4,
            agreedSessionPrice: '100.00',
          }),
        ]),
      }),
    );
    expect(mockEnrollmentsRepo.createBulkWithOptionalTransfer.mock.calls[0][0].rows).toHaveLength(3);
    expect(res).toEqual({
      enrolledCount: 2,
      skippedAlreadyEnrolledCount: 1,
      createdIds: ['enr-10', 'enr-11'],
    });
    expect(mockSettlement.recalculateMonth).toHaveBeenCalledWith('2026-11');
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'BULK_CREATE_ENROLLMENT', entityId: 'grp-1' }),
    );
  });
});
