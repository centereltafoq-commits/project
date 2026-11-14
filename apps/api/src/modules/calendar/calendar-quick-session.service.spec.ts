import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PERMISSIONS, SessionStatus, SystemRole } from '@edu-center/shared';
import { describe, expect, it, vi } from 'vitest';
import { CalendarQuickSessionService } from './calendar-quick-session.service';

describe('CalendarQuickSessionService', () => {
  const actorOwner = {
    id: 'user-1',
    fullName: 'مدير النظام',
    roleCode: SystemRole.OWNER,
    permissions: [],
  } as any;

  function createService(overrides?: {
    calendarRepository?: Record<string, any>;
    attendanceRepository?: Record<string, any>;
    attendanceService?: Record<string, any>;
  }) {
    const calendarRepository = {
      findGroupForQuickSession: vi.fn().mockResolvedValue({
        id: 'group-1',
        name: 'مجموعة الفيزياء',
        primaryTeacherId: 'teacher-1',
        defaultClassroomId: null,
        scheduleSlots: [
          { dayOfWeek: 6, startTime: '16:00', endTime: '18:00', classroomId: null },
        ],
      }),
      findSessionById: vi.fn().mockResolvedValue(null),
      findGroupSessionOnDate: vi.fn().mockResolvedValue(null),
      createQuickSession: vi.fn().mockResolvedValue({
        id: 'sess-new',
        groupId: 'group-1',
        teacherId: 'teacher-1',
        classroomId: 'room-1',
        sessionDate: '2026-11-14',
        yearMonth: '2026-11',
        startTime: '16:30',
        endTime: '18:30',
        status: SessionStatus.SCHEDULED,
      }),
      updateSessionSchedule: vi.fn(),
      updateGroupPinnedSchedule: vi.fn().mockResolvedValue({ id: 'group-1' }),
      ...overrides?.calendarRepository,
    };

    const attendanceRepository = {
      checkSessionConflicts: vi.fn().mockResolvedValue({ hasConflict: false }),
      ...overrides?.attendanceRepository,
    };

    const attendanceService = {
      completeGroupSession: vi.fn().mockResolvedValue({
        id: 'sess-new',
        groupId: 'group-1',
        status: SessionStatus.COMPLETED,
      }),
      ...overrides?.attendanceService,
    };

    const audit = { record: vi.fn().mockResolvedValue(undefined) };
    const cache = { invalidatePrefix: vi.fn().mockResolvedValue(undefined) };
    const settlementService = { assertMonthOpen: vi.fn().mockResolvedValue(undefined) };

    const service = new CalendarQuickSessionService(
      calendarRepository as any,
      attendanceRepository as any,
      attendanceService as any,
      audit as any,
      cache as any,
      settlementService as any,
    );

    return {
      service,
      calendarRepository,
      attendanceRepository,
      attendanceService,
      settlementService,
    };
  }

  it('creates session from virtual calendar slot, pins classroom/time when requested, and completes attendance', async () => {
    const { service, calendarRepository, attendanceService } = createService();

    const result = await service.saveQuickSession(
      {
        groupId: 'group-1',
        sessionDate: '2026-11-14', // Saturday (dayOfWeek = 6)
        startTime: '16:30',
        endTime: '18:30',
        classroomId: 'room-1',
        pinToGroupSchedule: true,
        completeGroupAttendance: true,
        originalSlotStartTime: '16:00',
      },
      actorOwner,
    );

    expect(calendarRepository.createQuickSession).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 'group-1',
        classroomId: 'room-1',
        startTime: '16:30',
        endTime: '18:30',
        sessionDate: '2026-11-14',
        yearMonth: '2026-11',
      }),
    );

    expect(calendarRepository.updateGroupPinnedSchedule).toHaveBeenCalledWith(
      'group-1',
      'room-1',
      [{ dayOfWeek: 6, startTime: '16:30', endTime: '18:30', classroomId: 'room-1' }],
    );

    expect(attendanceService.completeGroupSession).toHaveBeenCalledWith(
      'sess-new',
      actorOwner,
    );

    expect(result.groupPinned).toBe(true);
    expect(result.attendanceCompleted).toBe(true);
  });

  it('updates an existing session when sessionId is provided', async () => {
    const existing = {
      id: 'sess-1',
      groupId: 'group-1',
      teacherId: 'teacher-1',
      classroomId: 'room-1',
      sessionDate: '2026-11-14',
      yearMonth: '2026-11',
      startTime: '16:00',
      endTime: '18:00',
      status: SessionStatus.SCHEDULED,
    };

    const { service, calendarRepository, attendanceRepository } = createService({
      calendarRepository: {
        findSessionById: vi.fn().mockResolvedValue(existing),
        updateSessionSchedule: vi.fn().mockResolvedValue({
          ...existing,
          classroomId: 'room-2',
          startTime: '17:00',
          endTime: '19:00',
        }),
      },
    });

    const result = await service.saveQuickSession(
      {
        sessionId: 'sess-1',
        groupId: 'group-1',
        sessionDate: '2026-11-14',
        startTime: '17:00',
        endTime: '19:00',
        classroomId: 'room-2',
      },
      actorOwner,
    );

    expect(attendanceRepository.checkSessionConflicts).toHaveBeenCalledWith(
      expect.objectContaining({ excludeSessionId: 'sess-1', classroomId: 'room-2' }),
    );
    expect(calendarRepository.updateSessionSchedule).toHaveBeenCalledWith('sess-1', {
      startTime: '17:00',
      endTime: '19:00',
      classroomId: 'room-2',
      topic: undefined,
    });
    expect(result.session.classroomId).toBe('room-2');
    expect(result.groupPinned).toBe(false);
    expect(result.attendanceCompleted).toBe(false);
  });

  it('rejects conflicting classroom allocation', async () => {
    const { service } = createService({
      attendanceRepository: {
        checkSessionConflicts: vi.fn().mockResolvedValue({
          hasConflict: true,
          message: 'القاعة مشغولة بحصة أخرى',
        }),
      },
    });

    await expect(
      service.saveQuickSession(
        {
          groupId: 'group-1',
          sessionDate: '2026-11-14',
          startTime: '16:00',
          endTime: '18:00',
          classroomId: 'room-1',
        },
        actorOwner,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('forbids completing group attendance if actor lacks attendance/session permissions', async () => {
    const { service } = createService();

    await expect(
      service.saveQuickSession(
        {
          groupId: 'group-1',
          sessionDate: '2026-11-14',
          startTime: '16:00',
          endTime: '18:00',
          classroomId: 'room-1',
          completeGroupAttendance: true,
        },
        {
          id: 'user-2',
          fullName: 'مشرف قاعات',
          roleCode: SystemRole.MANAGER,
          permissions: [PERMISSIONS.CLASSROOMS_MANAGE],
        } as any,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
