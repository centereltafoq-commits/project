import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  AssistantCalculationMethod,
  FullMonthAbsencePolicy,
  GroupRevenueSplitMethod,
  PERMISSIONS,
  SystemRole,
} from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CacheService } from '../../common/cache/cache.module';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { MonthlySettlementService } from '../finance/monthly-settlement.service';
import {
  CreateGroupDto,
  GroupAssistantAssignmentDto,
  GroupQueryDto,
  GroupScheduleSlotDto,
  UpdateGroupDto,
} from './dto/group.dto';
import { GroupsRepository } from './groups.repository';
import { GroupsMutationRepository } from './groups-mutation.repository';

const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

@Injectable()
export class GroupsService {
  constructor(
    private readonly repository: GroupsRepository,
    private readonly mutationRepository: GroupsMutationRepository,
    private readonly audit: AuditLogsService,
    @Optional() private readonly settlementService?: MonthlySettlementService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  private canViewSplitFinance(actor?: AuthenticatedUser): boolean {
    if (!actor) return true;
    return (
      actor.roleCode === SystemRole.OWNER ||
      Boolean(actor.permissions?.includes(PERMISSIONS.FINANCE_VIEW)) ||
      Boolean(actor.permissions?.includes(PERMISSIONS.GROUPS_MANAGE))
    );
  }

  async getLookups(actor?: AuthenticatedUser) {
    const lookups = await this.repository.getLookups();
    const isOwner = !actor || actor.roleCode === SystemRole.OWNER;
    const perms = actor?.permissions ?? [];

    const canSeeAssistantRates =
      isOwner ||
      perms.includes(PERMISSIONS.FINANCE_VIEW) ||
      perms.includes(PERMISSIONS.GROUPS_MANAGE) ||
      perms.includes(PERMISSIONS.ASSISTANTS_MANAGE);

    const canSeeTeachers =
      isOwner ||
      perms.includes(PERMISSIONS.TEACHERS_VIEW) ||
      perms.includes(PERMISSIONS.TEACHERS_MANAGE) ||
      perms.includes(PERMISSIONS.GROUPS_MANAGE);

    const canSeeAssistants =
      isOwner ||
      perms.includes(PERMISSIONS.ASSISTANTS_VIEW) ||
      perms.includes(PERMISSIONS.ASSISTANTS_MANAGE) ||
      perms.includes(PERMISSIONS.GROUPS_MANAGE);

    const canSeeStudents =
      isOwner ||
      perms.includes(PERMISSIONS.STUDENTS_VIEW) ||
      perms.includes(PERMISSIONS.ENROLLMENTS_MANAGE);

    return {
      teachers: canSeeTeachers ? lookups.teachers : [],
      assistants: !canSeeAssistants
        ? []
        : canSeeAssistantRates
          ? lookups.assistants
          : lookups.assistants.map((a) => ({ ...a, rateValue: '0.00' })),
      students: canSeeStudents ? lookups.students : [],
    };
  }

  async list(query: GroupQueryDto, actor?: AuthenticatedUser) {
    const { rows, total, page, limit } = await this.repository.findPaginated(query);
    const showFinance = this.canViewSplitFinance(actor);
    const safeRows = showFinance
      ? rows
      : rows.map((r) => ({
          ...r,
          teacherSharePerStudent: null,
          centerSharePerStudent: null,
          teacherPercentage: null,
        }));
    return createPaginatedResult(safeRows, total, page, limit);
  }

  async getById(id: string, actor?: AuthenticatedUser) {
    const group = await this.repository.findDetailById(id);
    if (!group) {
      throw new NotFoundException('المجموعة غير موجودة');
    }

    if (!this.canViewSplitFinance(actor)) {
      return {
        ...group,
        financialPolicy: group.financialPolicy
          ? {
              ...group.financialPolicy,
              teacherSharePerStudent: '0.00',
              centerSharePerStudent: '0.00',
              teacherPercentage: '0.00',
            }
          : null,
        assistants: group.assistants.map((a) => ({
          ...a,
          defaultRate: '0.00',
          overrideRateValue: null,
        })),
      };
    }

    return group;
  }

  private async validateSlotsAndTeacherSchedule(
    slots: GroupScheduleSlotDto[],
    primaryTeacherId: string,
    isActive: boolean,
    excludeGroupId?: string,
  ) {
    for (let i = 0; i < slots.length; i++) {
      const slotA = slots[i]!;
      if (slotA.startTime >= slotA.endTime) {
        throw new BadRequestException('وقت نهاية الحصة يجب أن يكون بعد وقت البداية');
      }
      for (let j = i + 1; j < slots.length; j++) {
        const slotB = slots[j]!;
        if (
          Number(slotA.dayOfWeek) === Number(slotB.dayOfWeek) &&
          slotA.startTime < slotB.endTime &&
          slotA.endTime > slotB.startTime
        ) {
          throw new BadRequestException('يوجد تداخل بين مواعيد نفس المجموعة في نفس اليوم');
        }
      }
    }

    if (!isActive || slots.length === 0) return;

    const teacherGroups = await this.repository.findActiveGroupsByTeacher(
      primaryTeacherId,
      excludeGroupId,
    );
    for (const slotA of slots) {
      for (const other of teacherGroups) {
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
  }

  private async validateFinancialPolicyAndAssistants(params: {
    monthlyPrice: number;
    monthlySessionsCount: number;
    policy: {
      revenueSplitMethod: string;
      teacherSharePerStudent: number;
      centerSharePerStudent: number;
      teacherPercentage?: number | null;
      fullMonthAbsencePolicy?: string | null;
      fullAbsenceFixedFee?: number | null;
    };
    assistants?: GroupAssistantAssignmentDto[];
  }) {
    const { monthlyPrice, monthlySessionsCount, policy, assistants: assistantLinks } = params;

    if (!Number.isFinite(monthlySessionsCount) || monthlySessionsCount < 1) {
      throw new BadRequestException('عدد الحصص الشهرية يجب أن يكون 1 على الأقل');
    }
    if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) {
      throw new BadRequestException('قيمة الاشتراك الشهري يجب أن تكون موجبة أو صفر');
    }

    if (
      policy.revenueSplitMethod === GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO ||
      policy.revenueSplitMethod === GroupRevenueSplitMethod.FIXED_PER_STUDENT
    ) {
      if (policy.teacherSharePerStudent < 0 || policy.centerSharePerStudent < 0) {
        throw new BadRequestException('أنصبة المدرس والسنتر لا يمكن أن تكون سالبة');
      }
      const sharesSum = Number(
        (policy.teacherSharePerStudent + policy.centerSharePerStudent).toFixed(2),
      );
      if (sharesSum > monthlyPrice + 0.001) {
        throw new BadRequestException(
          `مجموع نصيب المدرس والسنتر (${sharesSum} ج.م) لا يمكن أن يتجاوز الاشتراك الشهري للطالب (${monthlyPrice} ج.م)`,
        );
      }
    } else if (policy.revenueSplitMethod === GroupRevenueSplitMethod.CUSTOM_PERCENTAGE) {
      const pct = Number(policy.teacherPercentage ?? 0);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        throw new BadRequestException('نسبة المدرس المئوية يجب أن تكون بين 0% و 100%');
      }
    }

    if (
      policy.fullMonthAbsencePolicy === FullMonthAbsencePolicy.CHARGE_FIXED_RESERVATION_FEE &&
      Number(policy.fullAbsenceFixedFee ?? 0) > monthlyPrice + 0.001
    ) {
      throw new BadRequestException(
        `رسوم حجز المقعد (${policy.fullAbsenceFixedFee} ج.م) لا يمكن أن تتجاوز الاشتراك الشهري (${monthlyPrice} ج.م)`,
      );
    }

    if (assistantLinks && assistantLinks.length > 0) {
      const seenAssistants = new Set<string>();
      const lookups = await this.repository.getLookups();
      const assistantById = new Map(lookups.assistants.map((a) => [a.id, a]));

      for (const link of assistantLinks) {
        if (seenAssistants.has(link.assistantId)) {
          throw new BadRequestException('لا يمكن إسناد نفس المساعد مرتين لنفس المجموعة');
        }
        seenAssistants.add(link.assistantId);

        const assistant = assistantById.get(link.assistantId);
        const effectiveMethod = link.overrideCalculationMethod ?? assistant?.calculationMethod;
        const effectiveRate =
          link.overrideRateValue !== undefined
            ? link.overrideRateValue
            : assistant
              ? Number(assistant.rateValue)
              : undefined;

        if (effectiveRate !== undefined && effectiveRate < 0) {
          throw new BadRequestException('نسبة أو أجر المساعد لا يمكن أن يكون سالباً');
        }
        if (
          effectiveMethod === AssistantCalculationMethod.SESSION_COMMISSION_PERCENT &&
          effectiveRate !== undefined &&
          effectiveRate > 100
        ) {
          throw new BadRequestException(
            `نسبة عمولة المساعد${assistant ? ` (${assistant.fullName})` : ''} لا يمكن أن تتجاوز 100%`,
          );
        }
      }
    }
  }

  async create(dto: CreateGroupDto, actor: AuthenticatedUser) {
    const groupCode = dto.groupCode?.trim() || (await this.generateUniqueGroupCode());
    if (dto.groupCode) {
      const dup = await this.repository.findByCode(groupCode);
      if (dup) throw new ConflictException('كود المجموعة مستخدم مسبقاً');
    }

    const isActive = dto.isActive ?? true;
    const rawSlots = dto.scheduleSlots ?? [];
    await this.validateSlotsAndTeacherSchedule(rawSlots, dto.primaryTeacherId, isActive);
    await this.validateFinancialPolicyAndAssistants({
      monthlyPrice: dto.monthlyPrice,
      monthlySessionsCount: dto.monthlySessionsCount,
      policy: dto.financialPolicy,
      assistants: dto.assistants,
    });

    // Business Rule: Groups are NEVER assigned a classroom automatically upon creation.
    // Classroom & schedule slot allocation happens manually in Classroom Management.
    const unassignedSlots = rawSlots.map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      classroomId: null,
    }));

    const calculatedSessionPrice = (dto.monthlyPrice / dto.monthlySessionsCount).toFixed(2);
    const created = await this.mutationRepository.createWithRelations({
      groupData: {
        groupCode,
        name: dto.name.trim(),
        subject: dto.subject.trim(),
        gradeLevel: dto.gradeLevel.trim(),
        primaryTeacherId: dto.primaryTeacherId,
        defaultClassroomId: null,
        monthlySessionsCount: dto.monthlySessionsCount,
        monthlyPrice: dto.monthlyPrice.toFixed(2),
        calculatedSessionPrice,
        scheduleSlots: unassignedSlots,
        maxStudents: dto.maxStudents ?? 50,
        isActive,
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

    try {
      await Promise.all([
        this.cache?.invalidatePrefix('dashboard:summary:'),
        this.cache?.invalidatePrefix('reports:'),
      ]);
    } catch {}

    return this.getById(created.id, actor);
  }

  async update(id: string, dto: UpdateGroupDto, actor: AuthenticatedUser) {
    const existing = await this.getById(id);

    const targetPrimaryTeacher = dto.primaryTeacherId ?? existing.primaryTeacherId;
    const targetIsActive = dto.isActive ?? existing.isActive;
    const targetSlots = (dto.scheduleSlots ?? existing.scheduleSlots ?? []) as GroupScheduleSlotDto[];

    await this.validateSlotsAndTeacherSchedule(
      targetSlots,
      targetPrimaryTeacher,
      targetIsActive,
      id,
    );

    const nextMonthlyPrice =
      dto.monthlyPrice !== undefined ? dto.monthlyPrice : Number(existing.monthlyPrice);
    const nextSessionsCount =
      dto.monthlySessionsCount !== undefined
        ? dto.monthlySessionsCount
        : existing.monthlySessionsCount;

    const existingPol = existing.financialPolicy;
    const mergedPolicy = {
      revenueSplitMethod:
        dto.financialPolicy?.revenueSplitMethod ??
        existingPol?.revenueSplitMethod ??
        GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
      teacherSharePerStudent:
        dto.financialPolicy?.teacherSharePerStudent ??
        Number(existingPol?.teacherSharePerStudent ?? 0),
      centerSharePerStudent:
        dto.financialPolicy?.centerSharePerStudent ??
        Number(existingPol?.centerSharePerStudent ?? 0),
      teacherPercentage:
        dto.financialPolicy?.teacherPercentage ??
        (existingPol?.teacherPercentage !== null && existingPol?.teacherPercentage !== undefined
          ? Number(existingPol.teacherPercentage)
          : 0),
      fullMonthAbsencePolicy:
        dto.financialPolicy?.fullMonthAbsencePolicy ??
        existingPol?.fullMonthAbsencePolicy ??
        FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
      fullAbsenceFixedFee:
        dto.financialPolicy?.fullAbsenceFixedFee ??
        Number(existingPol?.fullAbsenceFixedFee ?? 0),
    };

    await this.validateFinancialPolicyAndAssistants({
      monthlyPrice: nextMonthlyPrice,
      monthlySessionsCount: nextSessionsCount,
      policy: mergedPolicy,
      assistants: dto.assistants,
    });

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

    if (
      this.settlementService &&
      (dto.monthlyPrice !== undefined ||
        dto.monthlySessionsCount !== undefined ||
        dto.primaryTeacherId !== undefined ||
        dto.financialPolicy !== undefined ||
        dto.assistants !== undefined ||
        dto.isActive !== undefined)
    ) {
      const now = new Date();
      const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await this.settlementService.recalculateMonth(currentYm);
    }

    try {
      await Promise.all([
        this.cache?.invalidatePrefix('dashboard:summary:'),
        this.cache?.invalidatePrefix('reports:'),
      ]);
    } catch {}

    const updated = await this.getById(id, actor);
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
