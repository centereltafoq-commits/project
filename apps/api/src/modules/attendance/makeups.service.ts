import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AttendanceStatus, MakeupStatus } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CacheService } from '../../common/cache/cache.module';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MonthlySettlementService } from '../finance/monthly-settlement.service';
import { AttendanceRepository } from './attendance.repository';
import { CreateMakeupDto, MakeupQueryDto, UpdateMakeupDto } from './dto/makeup.dto';
import { MakeupsRepository } from './makeups.repository';

@Injectable()
export class MakeupsService {
  constructor(
    private readonly repository: AttendanceRepository,
    private readonly makeupsRepository: MakeupsRepository,
    private readonly audit: AuditLogsService,
    @Optional() private readonly settlementService?: MonthlySettlementService,
    @Optional() private readonly cache?: CacheService,
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

    if (this.settlementService) {
      await this.settlementService.assertMonthOpen(originalSession.yearMonth);
    }

    const existingAtt = await this.makeupsRepository.findStudentAttendance(
      dto.originalSessionId,
      dto.studentId,
    );
    if (
      existingAtt &&
      (existingAtt.status === AttendanceStatus.PRESENT ||
        existingAtt.status === AttendanceStatus.MAKEUP_ATTENDED)
    ) {
      throw new BadRequestException('لا يمكن إنشاء حصة تعويضية لطالب حاضر في الحصة الأصلية بالفعل');
    }

    const extraFee = dto.isFree ? '0.00' : Number(dto.extraFee ?? 0).toFixed(2);
    const status =
      dto.status ?? (dto.scheduledAt ? MakeupStatus.SCHEDULED : MakeupStatus.PENDING);

    if (status === MakeupStatus.SCHEDULED && !dto.scheduledAt) {
      throw new BadRequestException('يجب تحديد موعد انعقاد الحصة التعويضية المجدولة');
    }

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

    if (this.settlementService) {
      await this.settlementService.recalculateMonth(originalSession.yearMonth);
    }
    try {
      await Promise.all([
        this.cache?.invalidatePrefix('dashboard:summary:'),
        this.cache?.invalidatePrefix('reports:'),
      ]);
    } catch {}

    return created;
  }

  async updateMakeup(id: string, dto: UpdateMakeupDto, actor: AuthenticatedUser) {
    const existing = await this.makeupsRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('الحصة التعويضية غير موجودة');
    }

    const originalSession = await this.repository.findSessionById(existing.originalSessionId);
    if (originalSession && this.settlementService) {
      await this.settlementService.assertMonthOpen(originalSession.yearMonth);
    }

    const effectiveIsFree = dto.isFree !== undefined ? dto.isFree : existing.isFree;
    const effectiveExtraFee = effectiveIsFree
      ? '0.00'
      : dto.extraFee !== undefined
        ? Number(dto.extraFee).toFixed(2)
        : existing.extraFee;

    const targetStatus = dto.status !== undefined ? dto.status : existing.status;
    const targetScheduledAt =
      dto.scheduledAt !== undefined
        ? dto.scheduledAt ? new Date(dto.scheduledAt) : null
        : existing.scheduledAt;

    if (targetStatus === MakeupStatus.SCHEDULED && !targetScheduledAt) {
      throw new BadRequestException('يجب تحديد موعد انعقاد الحصة التعويضية المجدولة');
    }

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

    if (this.settlementService && originalSession) {
      await this.settlementService.recalculateMonth(originalSession.yearMonth);
    }
    try {
      await Promise.all([
        this.cache?.invalidatePrefix('dashboard:summary:'),
        this.cache?.invalidatePrefix('reports:'),
      ]);
    } catch {}

    return updated;
  }
}
