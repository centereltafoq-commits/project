import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentStatus } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  CreateEnrollmentDto,
  EnrollmentQueryDto,
  UpdateEnrollmentDto,
} from './dto/enrollment.dto';
import { GroupsRepository } from './groups.repository';
import { EnrollmentsRepository } from './enrollments.repository';

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly groupsRepository: GroupsRepository,
    private readonly enrollmentsRepository: EnrollmentsRepository,
    private readonly audit: AuditLogsService,
  ) {}

  async listEnrollments(groupId: string, query: EnrollmentQueryDto) {
    const group = await this.groupsRepository.findDetailById(groupId);
    if (!group) throw new NotFoundException('المجموعة غير موجودة');

    const { rows, total, page, limit } = await this.enrollmentsRepository.findPaginatedByGroup(
      groupId,
      query,
    );
    return createPaginatedResult(rows, total, page, limit);
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

    const startDate = dto.startDate || new Date().toISOString().slice(0, 10);
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

    return created;
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

    const today = new Date().toISOString().slice(0, 10);
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

    return updated;
  }
}
