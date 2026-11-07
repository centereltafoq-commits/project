import { Injectable, NotFoundException } from '@nestjs/common';
import { MakeupStatus } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AttendanceRepository } from './attendance.repository';
import { CreateMakeupDto, MakeupQueryDto, UpdateMakeupDto } from './dto/makeup.dto';
import { MakeupsRepository } from './makeups.repository';

@Injectable()
export class MakeupsService {
  constructor(
    private readonly repository: AttendanceRepository,
    private readonly makeupsRepository: MakeupsRepository,
    private readonly audit: AuditLogsService,
  ) {}

  async listMakeups(query: MakeupQueryDto) {
    const { rows, total, page, limit } = await this.makeupsRepository.findPaginated(query);
    return createPaginatedResult(rows, total, page, limit);
  }

  async createMakeup(dto: CreateMakeupDto, actor: AuthenticatedUser) {
    const originalSession = await this.repository.findSessionById(dto.originalSessionId);
    if (!originalSession) {
      throw new NotFoundException('الحصة الأصلية غير موجودة');
    }

    const extraFee = dto.isFree ? '0.00' : Number(dto.extraFee ?? 0).toFixed(2);
    const status =
      dto.status ?? (dto.scheduledAt ? MakeupStatus.SCHEDULED : MakeupStatus.PENDING);

    const created = await this.makeupsRepository.create({
      studentId: dto.studentId,
      originalSessionId: dto.originalSessionId,
      absenceDate: dto.absenceDate || originalSession.sessionDate,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      classroomId: dto.classroomId ?? null,
      status,
      isFree: dto.isFree,
      extraFee,
      approvedByUserId: actor.id,
      notes: dto.notes ?? null,
    });

    if (status === MakeupStatus.COMPLETED) {
      await this.makeupsRepository.updateAndSyncOriginalAttendance(
        created.id,
        {},
        {
          originalSessionId: created.originalSessionId,
          studentId: created.studentId,
          actorUserId: actor.id,
        },
      );
    }

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'CREATE_MAKEUP_SESSION',
      entityType: 'MAKEUP_SESSION',
      entityId: created.id,
      afterData: created,
    });

    return created;
  }

  async updateMakeup(id: string, dto: UpdateMakeupDto, actor: AuthenticatedUser) {
    const existing = await this.makeupsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('الحصة التعويضية غير موجودة');
    }

    const effectiveIsFree = dto.isFree !== undefined ? dto.isFree : existing.isFree;
    const effectiveExtraFee = effectiveIsFree
      ? '0.00'
      : dto.extraFee !== undefined
        ? Number(dto.extraFee).toFixed(2)
        : existing.extraFee;

    const updates: Parameters<MakeupsRepository['updateAndSyncOriginalAttendance']>[1] = {
      isFree: effectiveIsFree,
      extraFee: effectiveExtraFee,
      approvedByUserId: actor.id,
    };
    if (dto.status !== undefined) updates.status = dto.status;
    if (dto.scheduledAt !== undefined) {
      updates.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
    }
    if (dto.classroomId !== undefined) updates.classroomId = dto.classroomId || null;
    if (dto.notes !== undefined) updates.notes = dto.notes;

    const shouldSyncAttendance = dto.status === MakeupStatus.COMPLETED;

    const updated = await this.makeupsRepository.updateAndSyncOriginalAttendance(
      id,
      updates,
      shouldSyncAttendance
        ? {
            originalSessionId: existing.originalSessionId,
            studentId: existing.studentId,
            actorUserId: actor.id,
          }
        : undefined,
    );

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'UPDATE_MAKEUP_SESSION',
      entityType: 'MAKEUP_SESSION',
      entityId: id,
      beforeData: existing,
      afterData: updated,
    });

    return updated;
  }
}
