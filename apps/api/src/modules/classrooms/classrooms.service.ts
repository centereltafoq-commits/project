import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClassroomStatus } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  AvailableClassroomsQueryDto,
  ClassroomQueryDto,
  ClassroomScheduleQueryDto,
  CreateClassroomDto,
  CreateMaintenanceDto,
  UpdateClassroomDto,
} from './dto/classroom.dto';
import { ClassroomsRepository } from './classrooms.repository';
import { ClassroomsAvailabilityRepository } from './classrooms-availability.repository';

@Injectable()
export class ClassroomsService {
  constructor(
    private readonly repository: ClassroomsRepository,
    private readonly availabilityRepository: ClassroomsAvailabilityRepository,
    private readonly audit: AuditLogsService,
  ) {}

  async list(query: ClassroomQueryDto) {
    const { rows, total, page, limit } = await this.repository.findPaginated(query);
    return createPaginatedResult(rows, total, page, limit);
  }

  async getById(id: string) {
    const room = await this.repository.findById(id);
    if (!room) {
      throw new NotFoundException('القاعة غير موجودة');
    }
    const maintenances = await this.repository.listMaintenances(id);
    return { ...room, maintenances };
  }

  async findAvailable(query: AvailableClassroomsQueryDto) {
    if (query.startTime >= query.endTime) {
      throw new BadRequestException('وقت النهاية يجب أن يكون بعد وقت البداية');
    }
    return this.availabilityRepository.findAvailable(query);
  }

  async getSchedule(id: string, query: ClassroomScheduleQueryDto) {
    const classroom = await this.repository.findById(id);
    if (!classroom) {
      throw new NotFoundException('القاعة غير موجودة');
    }
    if (query.from > query.to) {
      throw new BadRequestException('تاريخ النهاية يجب أن يكون بعد أو مساوياً لتاريخ البداية');
    }
    const schedule = await this.availabilityRepository.fetchSchedule(id, query.from, query.to);
    return {
      classroom,
      from: query.from,
      to: query.to,
      ...schedule,
    };
  }

  async create(dto: CreateClassroomDto, actor: AuthenticatedUser) {
    const roomNumber = dto.roomNumber.trim();
    const dup = await this.repository.findByRoomNumber(roomNumber);
    if (dup) {
      throw new ConflictException('رقم القاعة مسجل مسبقاً');
    }

    const created = await this.repository.create({
      roomNumber,
      name: dto.name.trim(),
      maxCapacity: dto.maxCapacity,
      seatsCount: dto.seatsCount,
      equipment: (dto.equipment ?? []).map((e) => e.trim()).filter(Boolean),
      status: dto.status ?? ClassroomStatus.AVAILABLE,
      notes: dto.notes ?? null,
    });

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'CREATE_CLASSROOM',
      entityType: 'CLASSROOM',
      entityId: created.id,
      afterData: created,
    });

    return created;
  }

  async update(id: string, dto: UpdateClassroomDto, actor: AuthenticatedUser) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('القاعة غير موجودة');
    }

    if (dto.roomNumber && dto.roomNumber.trim() !== existing.roomNumber) {
      const dup = await this.repository.findByRoomNumber(dto.roomNumber.trim());
      if (dup && dup.id !== id) {
        throw new ConflictException('رقم القاعة مسجل لقاعة أخرى');
      }
    }

    const updated = await this.repository.update(id, {
      ...(dto.roomNumber !== undefined ? { roomNumber: dto.roomNumber.trim() } : {}),
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.maxCapacity !== undefined ? { maxCapacity: dto.maxCapacity } : {}),
      ...(dto.seatsCount !== undefined ? { seatsCount: dto.seatsCount } : {}),
      ...(dto.equipment !== undefined
        ? { equipment: dto.equipment.map((e) => e.trim()).filter(Boolean) }
        : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    });

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'UPDATE_CLASSROOM',
      entityType: 'CLASSROOM',
      entityId: id,
      beforeData: existing,
      afterData: updated,
    });

    return updated;
  }

  async addMaintenance(classroomId: string, dto: CreateMaintenanceDto, actor: AuthenticatedUser) {
    const room = await this.repository.findById(classroomId);
    if (!room) {
      throw new NotFoundException('القاعة غير موجودة');
    }
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);
    if (startAt >= endAt) {
      throw new BadRequestException('وقت انتهاء الصيانة يجب أن يكون بعد وقت البداية');
    }

    const created = await this.repository.createMaintenance(
      classroomId,
      startAt,
      endAt,
      dto.reason.trim(),
    );

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'CREATE_CLASSROOM_MAINTENANCE',
      entityType: 'CLASSROOM_MAINTENANCE',
      entityId: created.id,
      afterData: created,
    });

    return created;
  }

  async removeMaintenance(maintId: string, actor: AuthenticatedUser) {
    const deleted = await this.repository.deleteMaintenance(maintId);
    if (!deleted) {
      throw new NotFoundException('سجل الصيانة غير موجود');
    }

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'DELETE_CLASSROOM_MAINTENANCE',
      entityType: 'CLASSROOM_MAINTENANCE',
      entityId: maintId,
      beforeData: deleted,
    });

    return { success: true };
  }
}
