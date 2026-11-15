import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  AttendanceStatus,
  PERMISSIONS,
  SessionStatus,
  StudentStatus,
  SystemRole,
} from '@edu-center/shared';
import { AttendanceQrService, buildStudentPaymentGate } from './attendance-qr.service';

describe('AttendanceQrService (Reception QR Scanner & Mandatory Payment Gate)', () => {
  const actor = {
    id: 'user-1',
    email: 'assistant@test.com',
    fullName: 'سارة مساعد',
    roleCode: SystemRole.MANAGER,
    permissions: [PERMISSIONS.ATTENDANCE_RECORD, PERMISSIONS.FINANCE_VIEW],
  };

  const mockStudent = {
    id: '11111111-1111-4111-8111-111111111111',
    studentCode: 'STU-2026-0001',
    fullName: 'يوسف أحمد',
    phone: '01012345678',
    guardianPhone: '01098765432',
    gradeLevel: 'الثالث الثانوي',
    status: StudentStatus.ACTIVE,
    registrationDate: '2026-09-01',
  };

  const buildService = (overrides?: {
    monthsOverview?: any[];
    existingAttendance?: any;
  }) => {
    const studentsRepository = {
      findByCodeOrId: vi.fn().mockResolvedValue(mockStudent),
      findById: vi.fn().mockResolvedValue(mockStudent),
    };
    const studentsService = {
      getProfile: vi.fn().mockResolvedValue({
        student: mockStudent,
        enrollments: [
          {
            id: 'enr-1',
            groupId: '22222222-2222-4222-8222-222222222222',
            groupName: 'فيزياء أ',
            status: 'ACTIVE',
          },
        ],
        monthlyBreakdown: [],
        monthsOverview: overrides?.monthsOverview ?? [
          {
            yearMonth: '2026-10',
            paymentStatus: 'PAID',
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
            yearMonth: '2026-11',
            paymentStatus: 'UNPAID',
            totalSessions: 2,
            presentCount: 2,
            absentCount: 0,
            excusedCount: 0,
            totalDue: 300,
            totalPaid: 0,
            remaining: 300,
            groupsCount: 1,
            paymentsCount: 0,
            isClosed: false,
          },
        ],
      }),
    };
    const attendanceRepository = {
      findStudentActiveGroupsForDate: vi.fn().mockResolvedValue([
        {
          enrollmentId: 'enr-1',
          groupId: '22222222-2222-4222-8222-222222222222',
          groupCode: 'GRP-1',
          groupName: 'فيزياء أ',
          subject: 'فيزياء',
          gradeLevel: 'الثالث الثانوي',
          primaryTeacherId: 'tch-1',
          teacherName: 'أ. كريم',
          defaultClassroomId: 'cls-1',
          classroomName: 'القاعة الذهبية',
          roomNumber: 'R-101',
          scheduleSlots: [],
        },
      ]),
      findSessionsByGroupsAndDateForStudent: vi.fn().mockResolvedValue([
        {
          sessionId: '33333333-3333-4333-8333-333333333333',
          groupId: '22222222-2222-4222-8222-222222222222',
          groupCode: 'GRP-1',
          groupName: 'فيزياء أ',
          subject: 'فيزياء',
          teacherId: 'tch-1',
          teacherName: 'أ. كريم',
          classroomId: 'cls-1',
          classroomName: 'القاعة الذهبية',
          roomNumber: 'R-101',
          sessionDate: '2026-11-14',
          yearMonth: '2026-11',
          startTime: '16:00',
          endTime: '18:00',
          sessionStatus: SessionStatus.SCHEDULED,
          attendanceId: null,
          attendanceStatus: null,
          recordedAt: null,
        },
      ]),
      findSessionById: vi.fn().mockResolvedValue({
        id: '33333333-3333-4333-8333-333333333333',
        groupId: '22222222-2222-4222-8222-222222222222',
        groupName: 'فيزياء أ',
        sessionDate: '2026-11-14',
        yearMonth: '2026-11',
        status: SessionStatus.SCHEDULED,
      }),
      createSession: vi.fn(),
    };
    const existingMap = new Map<string, any>();
    if (overrides?.existingAttendance) {
      existingMap.set(mockStudent.id, overrides.existingAttendance);
    }
    const sheetRepository = {
      findExistingAttendanceMap: vi.fn().mockResolvedValue(existingMap),
      upsertSessionAttendance: vi.fn().mockResolvedValue(undefined),
    };
    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const cache = { invalidatePrefix: vi.fn().mockResolvedValue(undefined) };
    const settlementService = {
      assertMonthOpen: vi.fn().mockResolvedValue(undefined),
      recalculateMonth: vi.fn().mockResolvedValue(undefined),
    };

    const service = new AttendanceQrService(
      studentsRepository as any,
      studentsService as any,
      attendanceRepository as any,
      sheetRepository as any,
      audit as any,
      cache as any,
      settlementService as any,
    );

    return { service, sheetRepository, settlementService, studentsRepository };
  };

  it('builds blocked payment gate when student has unpaid/partial balance', () => {
    const gate = buildStudentPaymentGate([
      {
        yearMonth: '2026-11',
        paymentStatus: 'PARTIAL',
        totalSessions: 4,
        presentCount: 2,
        absentCount: 0,
        excusedCount: 0,
        totalDue: 300,
        totalPaid: 100,
        remaining: 200,
        groupsCount: 1,
        paymentsCount: 1,
        isClosed: false,
      },
      {
        yearMonth: '2026-10',
        paymentStatus: 'PAID',
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
    ]);

    expect(gate.isBlocked).toBe(true);
    expect(gate.totalRemaining).toBe(200);
    expect(gate.unpaidMonths).toHaveLength(1);
    expect(gate.unpaidMonths[0]!.yearMonth).toBe('2026-11');
  });

  it('returns student overview, unpaid warning state, and today sessions on QR lookup', async () => {
    const { service } = buildService();
    const res = await service.lookupStudentByQr('EDU:STU-2026-0001', '2026-11-14', actor);

    expect(res.student.fullName).toBe('يوسف أحمد');
    expect(res.paymentGate.isBlocked).toBe(true);
    expect(res.paymentGate.totalRemaining).toBe(300);
    expect(res.todaySessions).toHaveLength(1);
    expect(res.todaySessions[0]!.groupName).toBe('فيزياء أ');
  });

  it('rejects QR check-in when student owes unpaid dues', async () => {
    const { service, sheetRepository } = buildService();

    await expect(
      service.checkInStudentByQr(
        {
          studentId: mockStudent.id,
          sessionId: '33333333-3333-4333-8333-333333333333',
          sessionDate: '2026-11-14',
        },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(sheetRepository.upsertSessionAttendance).not.toHaveBeenCalled();
  });

  it('allows QR check-in and records PRESENT attendance once student has zero balance', async () => {
    const { service, sheetRepository, settlementService } = buildService({
      monthsOverview: [
        {
          yearMonth: '2026-11',
          paymentStatus: 'PAID',
          totalSessions: 2,
          presentCount: 2,
          absentCount: 0,
          excusedCount: 0,
          totalDue: 300,
          totalPaid: 300,
          remaining: 0,
          groupsCount: 1,
          paymentsCount: 1,
          isClosed: false,
        },
      ],
    });

    const result = await service.checkInStudentByQr(
      {
        studentId: mockStudent.id,
        sessionId: '33333333-3333-4333-8333-333333333333',
        sessionDate: '2026-11-14',
      },
      actor,
    );

    expect(result.success).toBe(true);
    expect(result.alreadyCheckedIn).toBe(false);
    expect(result.attendanceStatus).toBe(AttendanceStatus.PRESENT);
    expect(sheetRepository.upsertSessionAttendance).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: '33333333-3333-4333-8333-333333333333',
        inserts: [
          expect.objectContaining({
            studentId: mockStudent.id,
            status: AttendanceStatus.PRESENT,
          }),
        ],
      }),
    );
    expect(settlementService.recalculateMonth).toHaveBeenCalledWith('2026-11');
  });

  it('throws NotFoundException when scanned QR code does not match any student', async () => {
    const { service, studentsRepository } = buildService();
    studentsRepository.findByCodeOrId.mockResolvedValueOnce(null);

    await expect(
      service.lookupStudentByQr('UNKNOWN-999', '2026-11-14', actor),
    ).rejects.toThrow(NotFoundException);
  });
});
