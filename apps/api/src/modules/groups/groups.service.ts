import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateGroupDto, GroupQueryDto, UpdateGroupDto } from './dto/group.dto';
import { GroupsRepository } from './groups.repository';
import { GroupsMutationRepository } from './groups-mutation.repository';

@Injectable()
export class GroupsService {
  constructor(
    private readonly repository: GroupsRepository,
    private readonly mutationRepository: GroupsMutationRepository,
    private readonly audit: AuditLogsService,
  ) {}

  async list(query: GroupQueryDto) {
    const { rows, total, page, limit } = await this.repository.findPaginated(query);
    return createPaginatedResult(rows, total, page, limit);
  }

  async getById(id: string) {
    const group = await this.repository.findDetailById(id);
    if (!group) {
      throw new NotFoundException('المجموعة غير موجودة');
    }
    return group;
  }

  async create(dto: CreateGroupDto, actor: AuthenticatedUser) {
    const groupCode = dto.groupCode?.trim() || (await this.generateUniqueGroupCode());
    if (dto.groupCode) {
      const dup = await this.repository.findByCode(groupCode);
      if (dup) throw new ConflictException('كود المجموعة مستخدم مسبقاً');
    }

    for (const slot of dto.scheduleSlots ?? []) {
      if (slot.startTime >= slot.endTime) {
        throw new BadRequestException('وقت نهاية الحصة يجب أن يكون بعد وقت البداية');
      }
    }

    const calculatedSessionPrice = (dto.monthlyPrice / dto.monthlySessionsCount).toFixed(2);
    const created = await this.mutationRepository.createWithRelations({
      groupData: {
        groupCode,
        name: dto.name.trim(),
        subject: dto.subject.trim(),
        gradeLevel: dto.gradeLevel.trim(),
        primaryTeacherId: dto.primaryTeacherId,
        defaultClassroomId: dto.defaultClassroomId ?? null,
        monthlySessionsCount: dto.monthlySessionsCount,
        monthlyPrice: dto.monthlyPrice.toFixed(2),
        calculatedSessionPrice,
        scheduleSlots: dto.scheduleSlots ?? [],
        maxStudents: dto.maxStudents ?? 50,
        isActive: dto.isActive ?? true,
        notes: dto.notes ?? null,
      },
      policy: dto.financialPolicy,
      coTeacherIds: dto.coTeacherIds ?? [],
      assistants: dto.assistants ?? [],
    });

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'CREATE_GROUP',
      entityType: 'GROUP',
      entityId: created.id,
      afterData: { group: created, financialPolicy: dto.financialPolicy },
    });

    return this.getById(created.id);
  }

  async update(id: string, dto: UpdateGroupDto, actor: AuthenticatedUser) {
    const existing = await this.getById(id);

    for (const slot of dto.scheduleSlots ?? []) {
      if (slot.startTime >= slot.endTime) {
        throw new BadRequestException('وقت نهاية الحصة يجب أن يكون بعد وقت البداية');
      }
    }

    const nextMonthlyPrice =
      dto.monthlyPrice !== undefined ? dto.monthlyPrice : Number(existing.monthlyPrice);
    const nextSessionsCount =
      dto.monthlySessionsCount !== undefined
        ? dto.monthlySessionsCount
        : existing.monthlySessionsCount;

    const groupUpdates: Record<string, unknown> = {};
    if (dto.name !== undefined) groupUpdates.name = dto.name.trim();
    if (dto.subject !== undefined) groupUpdates.subject = dto.subject.trim();
    if (dto.gradeLevel !== undefined) groupUpdates.gradeLevel = dto.gradeLevel.trim();
    if (dto.primaryTeacherId !== undefined) groupUpdates.primaryTeacherId = dto.primaryTeacherId;
    if (dto.defaultClassroomId !== undefined)
      groupUpdates.defaultClassroomId = dto.defaultClassroomId;
    if (dto.monthlySessionsCount !== undefined)
      groupUpdates.monthlySessionsCount = dto.monthlySessionsCount;
    if (dto.monthlyPrice !== undefined) groupUpdates.monthlyPrice = dto.monthlyPrice.toFixed(2);
    if (dto.monthlyPrice !== undefined || dto.monthlySessionsCount !== undefined) {
      groupUpdates.calculatedSessionPrice = (nextMonthlyPrice / nextSessionsCount).toFixed(2);
    }
    if (dto.scheduleSlots !== undefined) groupUpdates.scheduleSlots = dto.scheduleSlots;
    if (dto.maxStudents !== undefined) groupUpdates.maxStudents = dto.maxStudents;
    if (dto.isActive !== undefined) groupUpdates.isActive = dto.isActive;
    if (dto.notes !== undefined) groupUpdates.notes = dto.notes;

    const targetPrimaryTeacher = dto.primaryTeacherId ?? existing.primaryTeacherId;
    await this.mutationRepository.updateWithRelations(
      id,
      groupUpdates,
      dto.financialPolicy,
      dto.primaryTeacherId !== undefined || dto.coTeacherIds !== undefined
        ? targetPrimaryTeacher
        : undefined,
      dto.coTeacherIds,
      dto.assistants,
    );

    const updated = await this.getById(id);
    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'UPDATE_GROUP',
      entityType: 'GROUP',
      entityId: id,
      beforeData: existing,
      afterData: updated,
    });

    return updated;
  }

  private async generateUniqueGroupCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      const candidate = `GRP-${rand}`;
      const existing = await this.repository.findByCode(candidate);
      if (!existing) return candidate;
    }
    return `GRP-${Date.now().toString().slice(-5)}`;
  }
}
