import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateGradeLevelDto, GradeLevelQueryDto, UpdateGradeLevelDto } from './dto/grade-level.dto';
import { GradeLevelsRepository } from './grade-levels.repository';

@Injectable()
export class GradeLevelsService {
  constructor(
    private readonly gradeLevelsRepository: GradeLevelsRepository,
    private readonly audit: AuditLogsService,
  ) {}

  async list(query: GradeLevelQueryDto) {
    return this.gradeLevelsRepository.findAll(query.activeOnly);
  }

  async getById(id: string) {
    const gradeLevel = await this.gradeLevelsRepository.findById(id);
    if (!gradeLevel) {
      throw new NotFoundException('الصف الدراسي غير موجود');
    }
    return gradeLevel;
  }

  private async generateUniqueCode(): Promise<string> {
    const existingLevels = (await this.gradeLevelsRepository.findAll(false)) ?? [];
    const usedCodes = new Set(
      existingLevels
        .map((level) => level.code?.trim().toUpperCase())
        .filter((code): code is string => Boolean(code)),
    );

    let index = 1;
    while (index < 10000) {
      const candidate = `GRD-${String(index).padStart(2, '0')}`;
      if (!usedCodes.has(candidate)) {
        return candidate;
      }
      index += 1;
    }

    return `GRD-${Date.now().toString(36).toUpperCase()}`;
  }

  async create(dto: CreateGradeLevelDto, actor?: AuthenticatedUser) {
    const existing = await this.gradeLevelsRepository.findByName(dto.name);
    if (existing) {
      throw new ConflictException('يوجد صف دراسي مسجل مسبقاً بهذا الاسم');
    }

    const normalizedCode = dto.code?.trim();
    if (normalizedCode && this.gradeLevelsRepository.findByCode) {
      const existingByCode = await this.gradeLevelsRepository.findByCode(normalizedCode);
      if (existingByCode) {
        throw new ConflictException('يوجد صف دراسي مسجل مسبقاً بهذا الكود');
      }
    }

    const resolvedCode = normalizedCode || (await this.generateUniqueCode());
    const created = await this.gradeLevelsRepository.create({
      ...dto,
      code: resolvedCode,
    });

    await this.audit.record({
      actorUserId: actor?.id ?? null,
      actorName: actor?.fullName ?? null,
      action: 'CREATE_GRADE_LEVEL',
      entityType: 'GRADE_LEVEL',
      entityId: created.id,
      afterData: created,
    });

    return created;
  }

  async update(id: string, dto: UpdateGradeLevelDto, actor?: AuthenticatedUser) {
    const gradeLevel = await this.getById(id);

    if (dto.name && dto.name !== gradeLevel.name) {
      const duplicate = await this.gradeLevelsRepository.findByName(dto.name);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('يوجد صف دراسي آخر مسجل بنفس هذا الاسم');
      }
    }

    const normalizedCode = dto.code !== undefined ? dto.code.trim() : undefined;
    if (normalizedCode && this.gradeLevelsRepository.findByCode) {
      const duplicateCode = await this.gradeLevelsRepository.findByCode(normalizedCode);
      if (duplicateCode && duplicateCode.id !== id) {
        throw new ConflictException('يوجد صف دراسي آخر مسجل بنفس هذا الكود');
      }
    }

    const payload: UpdateGradeLevelDto = { ...dto };
    if (dto.code !== undefined && !normalizedCode) {
      payload.code = gradeLevel.code?.trim() || (await this.generateUniqueCode());
    }

    const updated = await this.gradeLevelsRepository.update(id, payload, gradeLevel.name);

    await this.audit.record({
      actorUserId: actor?.id ?? null,
      actorName: actor?.fullName ?? null,
      action: 'UPDATE_GRADE_LEVEL',
      entityType: 'GRADE_LEVEL',
      entityId: id,
      beforeData: gradeLevel,
      afterData: updated,
    });

    return updated;
  }

  async remove(id: string, actor?: AuthenticatedUser) {
    const gradeLevel = await this.getById(id);

    const usage = await this.gradeLevelsRepository.countUsage(gradeLevel.name);
    if (usage.studentsCount > 0 || usage.groupsCount > 0) {
      throw new BadRequestException(
        `لا يمكن حذف الصف الدراسي (${gradeLevel.name}) لأنه مرتبط بـ ${usage.studentsCount} طالب و ${usage.groupsCount} مجموعة. يمكنك إلغاء تفعيله بدلاً من حذفه.`,
      );
    }

    const res = await this.gradeLevelsRepository.delete(id);

    await this.audit.record({
      actorUserId: actor?.id ?? null,
      actorName: actor?.fullName ?? null,
      action: 'DELETE_GRADE_LEVEL',
      entityType: 'GRADE_LEVEL',
      entityId: id,
      beforeData: gradeLevel,
    });

    return res;
  }
}


