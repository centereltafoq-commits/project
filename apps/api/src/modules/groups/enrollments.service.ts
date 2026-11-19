import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EnrollmentStatus, PERMISSIONS, SystemRole } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CacheService } from '../../common/cache/cache.module';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MonthlySettlementService } from '../finance/monthly-settlement.service';
import {
  CreateEnrollmentDto,
  EnrollmentQueryDto,
  UpdateEnrollmentDto,
} from './dto/enrollment.dto';
import { GroupsRepository } from './groups.repository';
import { EnrollmentsRepository } from './enrollments.repository';
import {
  buildEnrollmentMonthSummary,
  getDefaultYearMonth,
} from './enrollments-month-summary.calculator';

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly groupsRepository: GroupsRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly audit: AuditLogsService,
    @Optional() private readonly settlementService?: MonthlySettlementService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  private canViewFinance(actor?: AuthenticatedUser): boolean {
    if (!actor) return true;
    return (
      actor.roleCode === SystemRole.OWNER ||
      (actor.permissions ?? []).includes(PERMISSIONS.FINANCE_VIEW)
    );
  }

  async listEnrollments(groupId: string, query: EnrollmentQueryDto, actor?: AuthenticatedUser) {
    const group = await this.groupsRepository.findDetailById(groupId);
    if (!group) throw new NotFoundException('المجموعة غير موجودة');

    const { rows, total, page, limit } = await this.enrollmentsRepository.findPaginatedByGroup(
      groupId,
      query,
    );

    const yearMonth = query.yearMonth ?? getDefaultYearMonth();
    const canViewFinance = this.canViewFinance(actor);
    const activityBundle = await this.enrollmentsRepository.findGroupMonthActivity(
      groupId,
      yearMonth,
      rows.map((r) => r.studentId),
    );

    const enrichedRows = rows.map((row) => ({
      ...row,
      monthSummary: buildEnrollmentMonthSummary(row, yearMonth, activityBundle, canViewFinance),
    }));

    return createPaginatedResult(enrichedRows, total, page, limit);
  }

  async subscribeStudent(groupId: string, dto: CreateEnrollmentDto, actor: AuthenticatedUser) {
    const group = await this.groupsRepository.findDetailById(groupId);
    if (!group) throw new NotFoundException('المجموعة غير موجودة');
    if (!group.isActive) {
      throw new BadRequestException('لا يمكن تسجيل اشتراك جديد في مجموعة متوقفة');
    }

    const studentExists = await this.enrollmentsRepository.findStudentExists(dto.studentId);
    if (!studentExists) {
      throw new NotFoundException('الطالب غير موجود');
    }

    const duplicate = await this.enrollmentsRepository.findActiveDuplicate(groupId, dto.studentId);
    if (duplicate) {
      throw new ConflictException('الطالب مشترك بالفعل باشتراك نشط في هذه المجموعة');
    }

    const activeCount = await this.enrollmentsRepository.countActiveInGroup(groupId);
    if (activeCount >= group.maxStudents) {
      throw new BadRequestException(
        `اكتملت السعة القصوى للمجموعة (${group.maxStudents} طالباً)`,
      );
    }

    const agreedMonthlyPrice =
      dto.agreedMonthlyPrice !== undefined ? dto.agreedMonthlyPrice : Number(group.monthlyPrice);
    const agreedSessionsCount =
      dto.agreedSessionsCount !== undefined ? dto.agreedSessionsCount : group.monthlySessionsCount;
    const agreedSessionPrice =
      dto.agreedSessionPrice !== undefined
        ? dto.agreedSessionPrice
        : agreedMonthlyPrice / Math.max(1, agreedSessionsCount);

    const today = this.getLocalIsoDate();
    const startDate = dto.startDate || today;
    const created = await this.enrollmentsRepository.create({
      studentId: dto.studentId,
      groupId,
      startDate,
      endDate: dto.endDate ?? null,
      agreedMonthlyPrice: agreedMonthlyPrice.toFixed(2),
      agreedSessionsCount,
      agreedSessionPrice: agreedSessionPrice.toFixed(2),
      status: EnrollmentStatus.ACTIVE,
      notes: dto.notes ?? null,
    });

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'CREATE_ENROLLMENT',
      entityType: 'ENROLLMENT',
      entityId: created.id,
      afterData: created,
    });

    await this.recalculateAffectedMonths([startDate, dto.endDate]);
    try {
      await Promise.all([
        this.cache?.invalidatePrefix('dashboard:summary:'),
        this.cache?.invalidatePrefix('reports:'),
      ]);
    } catch {}

    return created;
  }

  private getLocalIsoDate(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private async recalculateAffectedMonths(dates: Array<string | null | undefined>): Promise<void> {
    if (!this.settlementService) return;
    const currentYm = this.getLocalIsoDate().slice(0, 7);
    const months = new Set<string>([currentYm]);
    for (const dt of dates) {
      if (dt && dt.length >= 7) {
        months.add(dt.slice(0, 7));
      }
    }
    for (const ym of months) {
      await this.settlementService.recalculateMonth(ym);
    }
  }

  async updateEnrollment(
    enrollmentId: string,
    dto: UpdateEnrollmentDto,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.enrollmentsRepository.findById(enrollmentId);
    if (!existing) {
      throw new NotFoundException('الاشتراك غير موجود');
    }

    if (dto.status === EnrollmentStatus.ACTIVE && existing.status !== EnrollmentStatus.ACTIVE) {
      const group = await this.groupsRepository.findDetailById(existing.groupId);
      if (!group) throw new NotFoundException('المجموعة غير موجودة');

      const dup = await this.enrollmentsRepository.findActiveDuplicate(
        existing.groupId,
        existing.studentId,
        enrollmentId,
      );
      if (dup) {
        throw new ConflictException('يوجد اشتراك نشط آخر لهذا الطالب في نفس المجموعة');
      }
      const activeCount = await this.enrollmentsRepository.countActiveInGroup(existing.groupId);
      if (activeCount >= group.maxStudents) {
        throw new BadRequestException('اكتملت السعة القصوى للمجموعة');
      }
    }

    const today = this.getLocalIsoDate();
    let resolvedEndDate: string | null | undefined = dto.endDate;
    if (dto.status === EnrollmentStatus.ACTIVE && dto.endDate === undefined) {
      resolvedEndDate = null;
    } else if (
      (dto.status === EnrollmentStatus.PAUSED ||
        dto.status === EnrollmentStatus.CANCELLED ||
        dto.status === EnrollmentStatus.COMPLETED) &&
      dto.endDate === undefined
    ) {
      resolvedEndDate = existing.endDate || today;
    }

    const updates: Parameters<EnrollmentsRepository['update']>[1] = {
      status: dto.status,
      ...(resolvedEndDate !== undefined ? { endDate: resolvedEndDate } : {}),
      ...(dto.startDate !== undefined ? { startDate: dto.startDate } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    };

    if (dto.agreedMonthlyPrice !== undefined) {
      updates.agreedMonthlyPrice = dto.agreedMonthlyPrice.toFixed(2);
      updates.agreedSessionPrice = (
        dto.agreedMonthlyPrice / Math.max(1, existing.agreedSessionsCount)
      ).toFixed(2);
    }

    const updated = await this.enrollmentsRepository.update(enrollmentId, updates);
    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'UPDATE_ENROLLMENT',
      entityType: 'ENROLLMENT',
      entityId: enrollmentId,
      beforeData: existing,
      afterData: updated,
    });

    await this.recalculateAffectedMonths([
      existing.startDate,
      existing.endDate,
      dto.startDate,
      updated?.endDate,
    ]);
    try {
      await Promise.all([
        this.cache?.invalidatePrefix('dashboard:summary:'),
        this.cache?.invalidatePrefix('reports:'),
      ]);
    } catch {}

    return updated;
  }
}
