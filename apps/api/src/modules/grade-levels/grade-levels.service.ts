import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateGradeLevelDto, GradeLevelQueryDto, UpdateGradeLevelDto } from './dto/grade-level.dto';
import { GradeLevelsRepository } from './grade-levels.repository';

@Injectable()
export class GradeLevelsService {
  constructor(private readonly gradeLevelsRepository: GradeLevelsRepository) {}

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

  async create(dto: CreateGradeLevelDto) {
    const existing = await this.gradeLevelsRepository.findByName(dto.name);
    if (existing) {
      throw new ConflictException('يوجد صف دراسي مسجل مسبقاً بهذا الاسم');
    }

    return this.gradeLevelsRepository.create(dto);
  }

  async update(id: string, dto: UpdateGradeLevelDto) {
    const gradeLevel = await this.getById(id);

    if (dto.name && dto.name !== gradeLevel.name) {
      const duplicate = await this.gradeLevelsRepository.findByName(dto.name);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('يوجد صف دراسي آخر مسجل بنفس هذا الاسم');
      }
    }

    return this.gradeLevelsRepository.update(id, dto);
  }

  async remove(id: string) {
    const gradeLevel = await this.getById(id);

    const usage = await this.gradeLevelsRepository.countUsage(gradeLevel.name);
    if (usage.studentsCount > 0 || usage.groupsCount > 0) {
      throw new BadRequestException(
        `لا يمكن حذف الصف الدراسي (${gradeLevel.name}) لأنه مرتبط بـ ${usage.studentsCount} طالب و ${usage.groupsCount} مجموعة. يمكنك إلغاء تفعيله بدلاً من حذفه.`,
      );
    }

    return this.gradeLevelsRepository.delete(id);
  }
}

