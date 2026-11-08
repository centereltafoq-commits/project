import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ClassroomStatus } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CacheService } from '../../common/cache/cache.module';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  AllocateGroupToClassroomDto,
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
    @Optional() private readonly cache?: CacheService,
  ) {}

  private async invalidateCaches() {
    try {
      await Promise.all([
        this.cache?.invalidatePrefix('dashboard:summary:'),
        this.cache?.invalidatePrefix('reports:'),
      ]);
    } catch {}
  }

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

    await this.invalidateCaches();
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

    await this.invalidateCaches();
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

    await this.invalidateCaches();
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

    await this.invalidateCaches();
    return { success: true };
  }

  async getAllocatedGroups(classroomId: string) {
    const room = await this.repository.findById(classroomId);
    if (!room) {
      throw new NotFoundException('القاعة غير موجودة');
    }
    const allocated = await this.repository.findAllocatedGroups(classroomId);
    return {
      classroom: room,
      groups: allocated.map((g) => ({
        ...g,
        isOverCapacity: g.enrolledCount > room.maxCapacity || g.maxStudents > room.maxCapacity,
      })),
    };
  }

  async getUnallocatedGroups(includeAll: boolean = false) {
    if (includeAll) {
      return this.repository.findAllActiveGroups();
    }
    return this.repository.findUnallocatedGroups();
  }

  async allocateGroup(
    classroomId: string,
    dto: AllocateGroupToClassroomDto,
    actor: AuthenticatedUser,
  ) {
    const room = await this.repository.findById(classroomId);
    if (!room) {
      throw new NotFoundException('القاعة غير موجودة');
    }

    if (room.status !== ClassroomStatus.AVAILABLE) {
      const statusLabel =
        room.status === ClassroomStatus.MAINTENANCE ? 'تحت الصيانة' : 'غير مفعلة';
      throw new ConflictException(
        `لا يمكن تسكين مجموعة في القاعة (${room.name}) لأنها ${statusLabel}`,
      );
    }

    const group = await this.repository.findGroupById(dto.groupId);
    if (!group) {
      throw new NotFoundException('المجموعة المطلوبة غير موجودة');
    }

    const enrolledCount = await this.repository.getGroupActiveEnrollmentCount(dto.groupId);
    if (enrolledCount > room.maxCapacity && !dto.allowOverCapacity) {
      throw new ConflictException(
        `عدد طلاب المجموعة المسجلين (${enrolledCount}) يتجاوز السعة القصوى للقاعة (${room.maxCapacity} طالب). يرجى اختيار قاعة بسعة أكبر أو تفعيل خيار تجاوز السعة`,
      );
    }

    // Weekly recurring schedule conflict check
    const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const existingAllocated = await this.repository.findAllocatedGroups(classroomId);
    const otherGroups = existingAllocated.filter((g) => g.id !== dto.groupId);

    const targetSlots = dto.slots ?? group.scheduleSlots ?? [];
    for (let i = 0; i < targetSlots.length; i++) {
      const slotA = targetSlots[i]!;
      if (slotA.startTime >= slotA.endTime) {
        throw new BadRequestException('وقت نهاية الحصة يجب أن يكون بعد وقت البداية');
      }
      for (let j = i + 1; j < targetSlots.length; j++) {
        const slotB = targetSlots[j]!;
        if (
          Number(slotA.dayOfWeek) === Number(slotB.dayOfWeek) &&
          slotA.startTime < slotB.endTime &&
          slotA.endTime > slotB.startTime
        ) {
          throw new BadRequestException('يوجد تداخل بين مواعيد نفس المجموعة في نفس اليوم');
        }
      }
    }

    // Only verify slots intended for THIS classroom
    const slotsForThisRoom = targetSlots.filter(
      (s) => !s.classroomId || s.classroomId === classroomId,
    );

    for (const slotA of slotsForThisRoom) {
      for (const other of otherGroups) {
        for (const slotB of other.slotsForThisRoom) {
          if (
            Number(slotA.dayOfWeek) === Number(slotB.dayOfWeek) &&
            slotA.startTime < slotB.endTime &&
            slotA.endTime > slotB.startTime
          ) {
            const dayName = ARABIC_DAYS[slotA.dayOfWeek] ?? String(slotA.dayOfWeek);
            throw new ConflictException(
              `تعارض في جدول القاعة: القاعة مشغولة بالفعل بالمجموعة (${other.name}) يوم (${dayName}) من ${slotB.startTime} إلى ${slotB.endTime}`,
            );
          }
        }
      }
    }

    const allActiveGroups = (await this.repository.findAllActiveGroups?.()) ?? [];
    const otherTeacherGroups = allActiveGroups.filter(
      (g) => g.id !== dto.groupId && g.primaryTeacherId === group.primaryTeacherId,
    );
    for (const slotA of targetSlots) {
      for (const other of otherTeacherGroups) {
        for (const slotB of other.scheduleSlots ?? []) {
          if (
            Number(slotA.dayOfWeek) === Number(slotB.dayOfWeek) &&
            slotA.startTime < slotB.endTime &&
            slotA.endTime > slotB.startTime
          ) {
            const dayName = ARABIC_DAYS[slotA.dayOfWeek] ?? String(slotA.dayOfWeek);
            throw new ConflictException(
              `تعارض في جدول المدرس: المدرس مرتبط بالفعل بالمجموعة (${other.name}) يوم (${dayName}) من ${slotB.startTime} إلى ${slotB.endTime}`,
            );
          }
        }
      }
    }

    const updated = await this.repository.allocateGroup(
      classroomId,
      dto.groupId,
      dto.slots,
      dto.updateUpcomingSessions ?? true,
    );

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'ALLOCATE_GROUP_TO_CLASSROOM',
      entityType: 'CLASSROOM',
      entityId: classroomId,
      afterData: {
        classroomId,
        groupId: dto.groupId,
        enrolledCount,
        slots: targetSlots,
        updateUpcomingSessions: dto.updateUpcomingSessions ?? true,
      },
    });

    await this.invalidateCaches();

    return {
      success: true,
      group: updated,
      enrolledCount,
    };
  }

  async releaseGroup(classroomId: string, groupId: string, actor: AuthenticatedUser) {
    const room = await this.repository.findById(classroomId);
    if (!room) {
      throw new NotFoundException('القاعة غير موجودة');
    }

    const group = await this.repository.findGroupById(groupId);
    if (!group) {
      throw new NotFoundException('المجموعة المطلوبة غير موجودة');
    }

    await this.repository.releaseGroup(classroomId, groupId, true);

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'RELEASE_GROUP_FROM_CLASSROOM',
      entityType: 'CLASSROOM',
      entityId: classroomId,
      beforeData: {
        classroomId,
        groupId,
      },
    });

    await this.invalidateCaches();

    return { success: true };
  }
}
