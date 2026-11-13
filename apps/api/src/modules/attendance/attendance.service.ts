import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  AttendanceStatus,
  PERMISSIONS,
  SessionStatus,
  SystemRole,
} from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CacheService } from '../../common/cache/cache.module';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MonthlySettlementService } from '../finance/monthly-settlement.service';
import { AttendanceRepository } from './attendance.repository';
import { RecordSessionAttendanceDto } from './dto/attendance-record.dto';
import {
  CreateSessionDto,
  GenerateMonthSessionsDto,
  SessionQueryDto,
} from './dto/session.dto';
import { SessionSheetRepository } from './session-sheet.repository';
import {
  assertValidTimeRange,
  buildMonthSessionDates,
  normalizeAttendanceItems,
} from './validators/session-schedule.validator';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly repository: AttendanceRepository,
    private readonly sheetRepository: SessionSheetRepository,
    private readonly audit: AuditLogsService,
    private readonly cache: CacheService,
    @Optional() private readonly settlementService?: MonthlySettlementService,
  ) {}

  async getLookups(actor?: AuthenticatedUser) {
    const lookups = await this.repository.getLookups();
    const isOwner = !actor || actor.roleCode === SystemRole.OWNER;
    const perms = actor?.permissions ?? [];

    const canSeeTeachers =
      isOwner ||
      perms.includes(PERMISSIONS.TEACHERS_VIEW) ||
      perms.includes(PERMISSIONS.TEACHERS_MANAGE) ||
      perms.includes(PERMISSIONS.SESSIONS_MANAGE);

    const canSeeClassrooms =
      isOwner ||
      perms.includes(PERMISSIONS.CLASSROOMS_VIEW) ||
      perms.includes(PERMISSIONS.CLASSROOMS_MANAGE) ||
      perms.includes(PERMISSIONS.SESSIONS_MANAGE);

    const canSeeStudents =
      isOwner ||
      perms.includes(PERMISSIONS.STUDENTS_VIEW) ||
      perms.includes(PERMISSIONS.ATTENDANCE_RECORD);

    return {
      groups: lookups.groups,
      teachers: canSeeTeachers ? lookups.teachers : [],
      classrooms: canSeeClassrooms ? lookups.classrooms : [],
      students: canSeeStudents ? lookups.students : [],
    };
  }

  async listSessions(query: SessionQueryDto) {
    const { rows, total, page, limit } = await this.repository.findSessionsPaginated(query);
    return createPaginatedResult(rows, total, page, limit);
  }

  async createSession(dto: CreateSessionDto, actor: AuthenticatedUser) {
    assertValidTimeRange(dto.startTime, dto.endTime);

    const group = await this.repository.findGroupById(dto.groupId);
    if (!group) {
      throw new NotFoundException('المجموعة المطلوبة غير موجودة');
    }

    const yearMonth = dto.sessionDate.slice(0, 7);
    if (this.settlementService) {
      await this.settlementService.assertMonthOpen(yearMonth);
    }

    const targetClassroomId = dto.classroomId ?? group.defaultClassroomId ?? null;
    const targetTeacherId = dto.teacherId ?? group.primaryTeacherId;

    const conflict = await this.repository.checkSessionConflicts({
      date: dto.sessionDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      teacherId: targetTeacherId,
      classroomId: targetClassroomId,
    });

    if (conflict.hasConflict) {
      throw new ConflictException(conflict.message);
    }

    const created = await this.repository.createSession({
      groupId: dto.groupId,
      teacherId: targetTeacherId,
      classroomId: targetClassroomId,
      sessionDate: dto.sessionDate,
      yearMonth,
      startTime: dto.startTime,
      endTime: dto.endTime,
      status: SessionStatus.SCHEDULED,
      topic: dto.topic ?? null,
      notes: dto.notes ?? null,
    });

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'CREATE_SESSION',
      entityType: 'SESSION',
      entityId: created.id,
      afterData: created,
    });

    try {
      await Promise.all([
        this.cache.invalidatePrefix('dashboard:summary:'),
        this.cache.invalidatePrefix('reports:'),
      ]);
    } catch {}

    return created;
  }

  async generateMonthSessions(dto: GenerateMonthSessionsDto, actor: AuthenticatedUser) {
    const group = await this.repository.findGroupById(dto.groupId);
    if (!group) {
      throw new NotFoundException('المجموعة المطلوبة غير موجودة');
    }

    if (this.settlementService) {
      await this.settlementService.assertMonthOpen(dto.yearMonth);
    }

    const candidateDates = buildMonthSessionDates(dto.yearMonth, group.scheduleSlots);
    const existing = await this.repository.findExistingGroupSessionsInMonth(
      dto.groupId,
      dto.yearMonth,
    );
    const existingKeys = new Set(existing.map((s) => `${s.sessionDate}|${s.startTime}`));

    const rowsToInsert = candidateDates
      .filter((slot) => !existingKeys.has(`${slot.sessionDate}|${slot.startTime}`))
      .map((slot) => ({
        groupId: group.id,
        teacherId: group.primaryTeacherId,
        classroomId: slot.classroomId ?? group.defaultClassroomId ?? null,
        sessionDate: slot.sessionDate,
        yearMonth: slot.yearMonth,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: SessionStatus.SCHEDULED,
      }));

    const inserted = await this.repository.insertSessionsBatch(rowsToInsert);

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'GENERATE_MONTH_SESSIONS',
      entityType: 'GROUP',
      entityId: group.id,
      afterData: {
        yearMonth: dto.yearMonth,
        createdCount: inserted.length,
        skippedCount: candidateDates.length - rowsToInsert.length,
      },
    });

    try {
      await Promise.all([
        this.cache.invalidatePrefix('dashboard:summary:'),
        this.cache.invalidatePrefix('reports:'),
      ]);
    } catch {}

    return {
      yearMonth: dto.yearMonth,
      groupId: group.id,
      createdCount: inserted.length,
      skippedCount: candidateDates.length - rowsToInsert.length,
      sessions: inserted,
    };
  }

  async getSessionSheet(sessionId: string) {
    const session = await this.repository.findSessionById(sessionId);
    if (!session) {
      throw new NotFoundException('الحصة المطلوبة غير موجودة');
    }

    const students = await this.sheetRepository.getSessionSheetStudents(
      sessionId,
      session.groupId,
      session.sessionDate,
    );

    const summary = {
      totalStudents: students.length,
      presentCount: students.filter((s) => s.status === AttendanceStatus.PRESENT).length,
      absentCount: students.filter((s) => s.status === AttendanceStatus.ABSENT).length,
      excusedCount: students.filter((s) => s.status === AttendanceStatus.EXCUSED).length,
      unrecordedCount: students.filter((s) => !s.status).length,
    };

    const isMonthClosed = this.settlementService?.isMonthClosed
      ? await this.settlementService.isMonthClosed(session.yearMonth)
      : false;

    return { session, summary, students, isMonthClosed };
  }

  async recordSessionAttendance(
    sessionId: string,
    dto: RecordSessionAttendanceDto,
    actor: AuthenticatedUser,
  ) {
    const session = await this.repository.findSessionById(sessionId);
    if (!session) {
      throw new NotFoundException('الحصة المطلوبة غير موجودة');
    }

    if (this.settlementService) {
      await this.settlementService.assertMonthOpen(session.yearMonth);
    }

    const items = normalizeAttendanceItems(dto);
    const existingMap = await this.sheetRepository.findExistingAttendanceMap(sessionId);
    const canOverride =
      actor.roleCode === SystemRole.OWNER ||
      actor.permissions.includes(PERMISSIONS.ATTENDANCE_OVERRIDE);

    const inserts: Array<{ studentId: string; status: string; notes: string | null }> = [];
    const updates: Array<{ studentId: string; status: string; notes: string | null }> = [];
    const beforeUpdates: Array<{ studentId: string; status: string; notes: string | null }> = [];

    for (const item of items) {
      const normalizedNotes =
        item.notes !== undefined ? item.notes.trim() || null : undefined;
      const prev = existingMap.get(item.studentId);
      if (!prev) {
        inserts.push({
          studentId: item.studentId,
          status: item.status,
          notes: normalizedNotes ?? null,
        });
        continue;
      }

      const prevNormalizedNotes = prev.notes?.trim() || null;
      const statusChanged = prev.status !== item.status;
      const notesChanged =
        normalizedNotes !== undefined && normalizedNotes !== prevNormalizedNotes;

      if (statusChanged && !canOverride) {
        throw new ForbiddenException('تعديل الحضور المسجل مسبقاً يتطلب صلاحية إدارية');
      }

      if (statusChanged || notesChanged) {
        beforeUpdates.push({
          studentId: prev.studentId,
          status: prev.status,
          notes: prev.notes,
        });
        updates.push({
          studentId: item.studentId,
          status: item.status,
          notes: normalizedNotes !== undefined ? normalizedNotes : prevNormalizedNotes,
        });
      }
    }

    const normalizedTopic =
      dto.topic !== undefined ? dto.topic.trim() || null : undefined;

    await this.sheetRepository.upsertSessionAttendance({
      sessionId,
      actorUserId: actor.id,
      topic: normalizedTopic,
      inserts,
      updates,
    });

    if (updates.length > 0) {
      await this.audit.record({
        actorUserId: actor.id,
        actorName: actor.fullName,
        action: 'OVERRIDE_ATTENDANCE',
        entityType: 'SESSION',
        entityId: sessionId,
        beforeData: beforeUpdates,
        afterData: updates,
      });
    } else if (inserts.length > 0) {
      await this.audit.record({
        actorUserId: actor.id,
        actorName: actor.fullName,
        action: 'RECORD_ATTENDANCE',
        entityType: 'SESSION',
        entityId: sessionId,
        afterData: { insertedCount: inserts.length },
      });
    }

    if (this.settlementService) {
      await this.settlementService.recalculateMonth(session.yearMonth);
    }

    try {
      await Promise.all([
        this.cache.invalidatePrefix('dashboard:summary:'),
        this.cache.invalidatePrefix('reports:'),
      ]);
    } catch {}

    return this.getSessionSheet(sessionId);
  }

  /**
   * Marks an entire group session as attended/completed and triggers monthly financial billing
   * for all active students enrolled in that group independently of individual attendance sheets.
   */
  async completeGroupSession(sessionId: string, actor: AuthenticatedUser) {
    const session = await this.repository.findSessionById(sessionId);
    if (!session) {
      throw new NotFoundException('الحصة المطلوبة غير موجودة');
    }

    if (session.status === SessionStatus.CANCELLED) {
      throw new BadRequestException('لا يمكن تسجيل حضور مجموعة لحصة ملغاة');
    }

    if (this.settlementService) {
      await this.settlementService.assertMonthOpen(session.yearMonth);
    }

    const updatedSession =
      session.status === SessionStatus.COMPLETED
        ? session
        : (await this.sheetRepository.markSessionCompleted(sessionId)) ?? session;

    if (session.status !== SessionStatus.COMPLETED) {
      await this.audit.record({
        actorUserId: actor.id,
        actorName: actor.fullName,
        action: 'COMPLETE_GROUP_SESSION',
        entityType: 'SESSION',
        entityId: sessionId,
        afterData: {
          groupId: session.groupId,
          yearMonth: session.yearMonth,
          sessionDate: session.sessionDate,
        },
      });
    }

    if (this.settlementService) {
      await this.settlementService.recalculateMonth(session.yearMonth);
    }

    try {
      await Promise.all([
        this.cache.invalidatePrefix('dashboard:summary:'),
        this.cache.invalidatePrefix('reports:'),
      ]);
    } catch {}

    return updatedSession;
  }
}
