import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ClassroomStatus } from '@edu-center/shared';
import {
  BookingsConflictRepository,
  ConflictContextData,
} from '../bookings-conflict.repository';
import { ScheduleConflictChecker } from './schedule-conflict.checker';

function buildEmptyContext(overrides?: Partial<ConflictContextData>): ConflictContextData {
  return {
    teacherConfirmedBookings: [],
    teacherSessions: [],
    studentConfirmedBookings: [],
    studentGroupSessions: [],
    classroom: {
      id: 'room-1',
      roomNumber: '101',
      name: 'قاعة نيوتن',
      maxCapacity: 40,
      status: ClassroomStatus.AVAILABLE,
    },
    classroomMaintenances: [],
    classroomBookings: [],
    classroomSessions: [],
    ...overrides,
  };
}

describe('ScheduleConflictChecker (5 Conflict Prevention Rules)', () => {
  it('passes cleanly when no conflicts exist and back-to-back slots only touch boundaries', async () => {
    const repo = {
      fetchConflictContext: vi.fn().mockResolvedValue(
        buildEmptyContext({
          teacherSessions: [
            { id: 'sess-1', startTime: '12:00', endTime: '14:00', label: 'فيزياء 3ث' },
          ],
          classroomBookings: [
            {
              id: 'cb-1',
              startTime: '16:00',
              endTime: '18:00',
              label: 'مراجعة',
              bookingRequestId: 'other-req',
            },
          ],
        }),
      ),
    } as unknown as BookingsConflictRepository;

    const checker = new ScheduleConflictChecker(repo);
    const result = await checker.checkConflicts({
      date: '2026-11-10',
      startTime: '14:00',
      endTime: '16:00',
      teacherId: 'teacher-1',
      studentId: 'student-1',
      classroomId: 'room-1',
      expectedAttendees: 25,
    });

    expect(result.hasConflict).toBe(false);
    expect(result.conflicts).toHaveLength(0);
  });

  it('Rule 1: detects overlapping confirmed booking or scheduled group session for same Teacher', async () => {
    const repo = {
      fetchConflictContext: vi.fn().mockResolvedValue(
        buildEmptyContext({
          teacherConfirmedBookings: [
            { id: 'bk-99', startTime: '14:30', endTime: '15:30', label: 'حصة خاصة' },
          ],
          teacherSessions: [
            { id: 'sess-2', startTime: '15:00', endTime: '17:00', label: 'مجموعة التفوق' },
          ],
        }),
      ),
    } as unknown as BookingsConflictRepository;

    const checker = new ScheduleConflictChecker(repo);
    const result = await checker.checkConflicts({
      date: '2026-11-10',
      startTime: '14:00',
      endTime: '16:00',
      teacherId: 'teacher-1',
      expectedAttendees: 1,
    });

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts.filter((c) => c.rule === 'TEACHER_CONFLICT')).toHaveLength(2);
  });

  it('Rule 2: detects overlapping confirmed booking or active group session for same Student', async () => {
    const repo = {
      fetchConflictContext: vi.fn().mockResolvedValue(
        buildEmptyContext({
          studentConfirmedBookings: [
            { id: 'bk-st-1', startTime: '13:30', endTime: '14:30', label: 'مراجعة كيمياء' },
          ],
          studentGroupSessions: [
            { id: 'sess-st-1', startTime: '14:15', endTime: '15:45', label: 'كيمياء عضوية' },
          ],
        }),
      ),
    } as unknown as BookingsConflictRepository;

    const checker = new ScheduleConflictChecker(repo);
    const result = await checker.checkConflicts({
      date: '2026-11-10',
      startTime: '14:00',
      endTime: '15:00',
      teacherId: 'teacher-1',
      studentId: 'student-1',
      expectedAttendees: 1,
    });

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts.filter((c) => c.rule === 'STUDENT_CONFLICT')).toHaveLength(2);
  });

  it('Rule 3: blocks classroom in MAINTENANCE/INACTIVE status or overlapping maintenance window', async () => {
    const repo = {
      fetchConflictContext: vi.fn().mockResolvedValue(
        buildEmptyContext({
          classroom: {
            id: 'room-1',
            roomNumber: '101',
            name: 'قاعة نيوتن',
            maxCapacity: 40,
            status: ClassroomStatus.MAINTENANCE,
          },
          classroomMaintenances: [
            {
              id: 'm-1',
              startAt: new Date('2026-11-10T14:30:00'),
              endAt: new Date('2026-11-10T16:30:00'),
              reason: 'صيانة التكييف',
            },
          ],
        }),
      ),
    } as unknown as BookingsConflictRepository;

    const checker = new ScheduleConflictChecker(repo);
    const result = await checker.checkConflicts({
      date: '2026-11-10',
      startTime: '14:00',
      endTime: '15:00',
      teacherId: 'teacher-1',
      classroomId: 'room-1',
      expectedAttendees: 10,
    });

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts.filter((c) => c.rule === 'CLASSROOM_UNAVAILABLE')).toHaveLength(2);
  });

  it('Rule 4: detects overlapping classroom_bookings or group sessions in assigned classroom', async () => {
    const repo = {
      fetchConflictContext: vi.fn().mockResolvedValue(
        buildEmptyContext({
          classroomBookings: [
            {
              id: 'cb-10',
              startTime: '14:00',
              endTime: '15:30',
              label: 'حجز مراجعة نهائية',
              bookingRequestId: 'other-booking',
            },
          ],
          classroomSessions: [
            {
              id: 'cs-10',
              startTime: '15:00',
              endTime: '17:00',
              label: 'مجموعة الرياضيات',
            },
          ],
        }),
      ),
    } as unknown as BookingsConflictRepository;

    const checker = new ScheduleConflictChecker(repo);
    const result = await checker.checkConflicts({
      date: '2026-11-10',
      startTime: '14:30',
      endTime: '16:00',
      teacherId: 'teacher-1',
      classroomId: 'room-1',
      expectedAttendees: 15,
    });

    expect(result.hasConflict).toBe(true);
    expect(result.conflicts.filter((c) => c.rule === 'CLASSROOM_OCCUPIED')).toHaveLength(2);
  });

  it('Rule 5: blocks booking when expectedAttendees exceeds classroom.maxCapacity', async () => {
    const repo = {
      fetchConflictContext: vi.fn().mockResolvedValue(
        buildEmptyContext({
          classroom: {
            id: 'room-small',
            roomNumber: '202',
            name: 'قاعة صغيرة',
            maxCapacity: 20,
            status: ClassroomStatus.AVAILABLE,
          },
        }),
      ),
    } as unknown as BookingsConflictRepository;

    const checker = new ScheduleConflictChecker(repo);

    await expect(
      checker.assertNoConflicts({
        date: '2026-11-10',
        startTime: '10:00',
        endTime: '12:00',
        teacherId: 'teacher-1',
        classroomId: 'room-small',
        expectedAttendees: 35,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('excludes current booking id when modifying an already-confirmed booking', async () => {
    const repo = {
      fetchConflictContext: vi.fn().mockResolvedValue(
        buildEmptyContext({
          teacherConfirmedBookings: [
            { id: 'same-booking', startTime: '10:00', endTime: '12:00', label: 'نفس الحجز' },
          ],
          classroomBookings: [
            {
              id: 'cb-self',
              startTime: '10:00',
              endTime: '12:00',
              label: 'نفس الحجز',
              bookingRequestId: 'same-booking',
            },
          ],
        }),
      ),
    } as unknown as BookingsConflictRepository;

    const checker = new ScheduleConflictChecker(repo);
    const res = await checker.checkConflicts({
      excludeBookingId: 'same-booking',
      date: '2026-11-10',
      startTime: '10:00',
      endTime: '12:00',
      teacherId: 'teacher-1',
      classroomId: 'room-1',
      expectedAttendees: 10,
    });

    expect(res.hasConflict).toBe(false);
  });
});
