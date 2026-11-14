import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PERMISSIONS, SessionStatus, SystemRole } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CacheService } from '../../common/cache/cache.module';
import { GroupScheduleSlot } from '../../database/schemas/groups.schema';
import { AttendanceRepository } from '../attendance/attendance.repository';
import { AttendanceService } from '../attendance/attendance.service';
import { assertValidTimeRange } from '../attendance/validators/session-schedule.validator';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MonthlySettlementService } from '../finance/monthly-settlement.service';
import { CalendarRepository } from './calendar.repository';
import { QuickCalendarSessionDto } from './dto/quick-calendar-session.dto';
import { normalizeHHmm } from './validators/calendar-schedule-expander.util';

@Injectable()
export class CalendarQuickSessionService {
  constructor(
    private readonly calendarRepository: CalendarRepository,
    private readonly attendanceRepository: AttendanceRepository,
    private readonly attendanceService: AttendanceService,
    private readonly audit: AuditLogsService,
    private readonly cache: CacheService,
    @Optional() private readonly settlementService?: MonthlySettlementService,
  ) {}

  private buildUpdatedGroupScheduleSlots(params: {
    existingSlots: GroupScheduleSlot[];
    sessionDate: string;
    startTime: string;
    endTime: string;
    classroomId: string | null;
    originalSlotStartTime?: string | null;
  }): GroupScheduleSlot[] {
    const [y, m, d] = params.sessionDate.split('-').map(Number);
    const dayOfWeek = new Date(y!, m! - 1, d!).getDay();
    const slots = [...(params.existingSlots ?? [])].map((s) => ({ ...s }));

    const normalizedOriginal = params.originalSlotStartTime
      ? normalizeHHmm(params.originalSlotStartTime)
      : null;

    let targetIndex = slots.findIndex(
      (s) =>
        Number(s.dayOfWeek) === dayOfWeek &&
        (normalizedOriginal
          ? normalizeHHmm(s.startTime) === normalizedOriginal
          : normalizeHHmm(s.startTime) === params.startTime),
    );

    if (targetIndex === -1) {
      const sameDayIndices = slots
        .map((s, idx) => (Number(s.dayOfWeek) === dayOfWeek ? idx : -1))
        .filter((idx) => idx !== -1);
      if (sameDayIndices.length === 1) {
        targetIndex = sameDayIndices[0]!;
      }
    }

    const updatedSlot: GroupScheduleSlot = {
      dayOfWeek,
      startTime: params.startTime,
      endTime: params.endTime,
      classroomId: params.classroomId,
    };

    if (targetIndex >= 0) {
      slots[targetIndex] = updatedSlot;
    } else {
      slots.push(updatedSlot);
    }

    // Validate against intra-group overlap on the same weekday
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i]!;
        const b = slots[j]!;
        if (
          Number(a.dayOfWeek) === Number(b.dayOfWeek) &&
          a.startTime < b.endTime &&
          a.endTime > b.startTime
        ) {
          throw new BadRequestException('تثبيت هذا الموعد يتعارض مع موعد آخر لنفس المجموعة في نفس اليوم');
        }
      }
    }

    return slots;
  }

  async saveQuickSession(dto: QuickCalendarSessionDto, actor: AuthenticatedUser) {
    assertValidTimeRange(dto.startTime, dto.endTime);

    if (dto.completeGroupAttendance) {
      const isOwner = actor.roleCode === SystemRole.OWNER;
      const perms = actor.permissions ?? [];
      const canComplete =
        isOwner ||
        perms.includes(PERMISSIONS.ATTENDANCE_RECORD) ||
        perms.includes(PERMISSIONS.SESSIONS_MANAGE);
      if (!canComplete) {
        throw new ForbiddenException('لا تملك صلاحية تأكيد حضور المجموعة');
      }
    }

    const group = await this.calendarRepository.findGroupForQuickSession(dto.groupId);
    if (!group) {
      throw new NotFoundException('المجموعة المطلوبة غير موجودة');
    }

    const yearMonth = dto.sessionDate.slice(0, 7);
    if (this.settlementService) {
      await this.settlementService.assertMonthOpen(yearMonth);
    }

    let existingSession = dto.sessionId
      ? await this.calendarRepository.findSessionById(dto.sessionId)
      : await this.calendarRepository.findGroupSessionOnDate(
          dto.groupId,
          dto.sessionDate,
          dto.originalSlotStartTime ?? dto.startTime,
        );

    if (dto.sessionId && !existingSession) {
      throw new NotFoundException('الحصة المطلوبة غير موجودة');
    }

    if (existingSession) {
      if (existingSession.groupId !== dto.groupId) {
        throw new BadRequestException('الحصة لا تنتمي إلى المجموعة المحددة');
      }
      if (existingSession.status === SessionStatus.CANCELLED) {
        throw new BadRequestException('لا يمكن تعديل حصة ملغاة');
      }
    }

    const targetClassroomId =
      dto.classroomId !== undefined
        ? dto.classroomId
        : existingSession?.classroomId ?? group.defaultClassroomId ?? null;
    const targetTeacherId = existingSession?.teacherId ?? group.primaryTeacherId;

    const conflict = await this.attendanceRepository.checkSessionConflicts({
      date: dto.sessionDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      teacherId: targetTeacherId,
      classroomId: targetClassroomId,
      excludeSessionId: existingSession?.id,
    });

    if (conflict.hasConflict) {
      throw new ConflictException(conflict.message);
    }

    const normalizedTopic =
      dto.topic !== undefined ? dto.topic?.trim() || null : undefined;

    let savedSession = existingSession
      ? await this.calendarRepository.updateSessionSchedule(existingSession.id, {
          startTime: dto.startTime,
          endTime: dto.endTime,
          classroomId: targetClassroomId,
          topic: normalizedTopic,
        })
      : await this.calendarRepository.createQuickSession({
          groupId: group.id,
          teacherId: targetTeacherId,
          classroomId: targetClassroomId,
          sessionDate: dto.sessionDate,
          yearMonth,
          startTime: dto.startTime,
          endTime: dto.endTime,
          status: SessionStatus.SCHEDULED,
          topic: normalizedTopic ?? null,
          notes: null,
        });

    if (!savedSession) {
      throw new NotFoundException('تعذر حفظ بيانات الحصة');
    }

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: existingSession ? 'CALENDAR_QUICK_UPDATE_SESSION' : 'CALENDAR_QUICK_CREATE_SESSION',
      entityType: 'SESSION',
      entityId: savedSession.id,
      beforeData: existingSession ?? null,
      afterData: savedSession,
    });

    let groupPinned = false;
    if (dto.pinToGroupSchedule) {
      const nextSlots = this.buildUpdatedGroupScheduleSlots({
        existingSlots: group.scheduleSlots ?? [],
        sessionDate: dto.sessionDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        classroomId: targetClassroomId,
        originalSlotStartTime: dto.originalSlotStartTime,
      });

      const nextDefaultClassroomId = targetClassroomId ?? group.defaultClassroomId ?? null;
      await this.calendarRepository.updateGroupPinnedSchedule(
        group.id,
        nextDefaultClassroomId,
        nextSlots,
      );
      groupPinned = true;

      await this.audit.record({
        actorUserId: actor.id,
        actorName: actor.fullName,
        action: 'CALENDAR_PIN_GROUP_SCHEDULE',
        entityType: 'GROUP',
        entityId: group.id,
        beforeData: {
          defaultClassroomId: group.defaultClassroomId,
          scheduleSlots: group.scheduleSlots,
        },
        afterData: {
          defaultClassroomId: nextDefaultClassroomId,
          scheduleSlots: nextSlots,
        },
      });
    }

    let finalSession: Record<string, unknown> = savedSession;
    let attendanceCompleted = savedSession.status === SessionStatus.COMPLETED;
    if (dto.completeGroupAttendance) {
      const completedSession = await this.attendanceService.completeGroupSession(
        savedSession.id,
        actor,
      );
      finalSession = completedSession;
      attendanceCompleted = completedSession.status === SessionStatus.COMPLETED;
    }

    try {
      await Promise.all([
        this.cache.invalidatePrefix('dashboard:summary:'),
        this.cache.invalidatePrefix('reports:'),
      ]);
    } catch {}

    return {
      session: finalSession,
      groupPinned,
      attendanceCompleted,
    };
  }
}
