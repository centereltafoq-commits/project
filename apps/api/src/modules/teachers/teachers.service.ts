import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PERMISSIONS, SystemRole, TeacherEmploymentStatus } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  CreateTeacherDto,
  TeacherQueryDto,
  UpdateTeacherAvailabilityDto,
  UpdateTeacherDto,
} from './dto/teacher.dto';
import { TeachersRepository } from './teachers.repository';
import { TeachersProfileRepository } from './teachers-profile.repository';
import { computeTeacherMonthlySummary } from './teachers-finance.calculator';
import {
  buildTeacherMonthSessions,
  buildTeacherMonthsOverview,
} from './teachers-months-overview.builder';

@Injectable()
export class TeachersService {
  constructor(
    private readonly repository: TeachersRepository,
    private readonly profileRepository: TeachersProfileRepository,
    private readonly audit: AuditLogsService,
  ) {}

  async list(query: TeacherQueryDto) {
    const { rows, total, page, limit } = await this.repository.findPaginated(query);
    return createPaginatedResult(rows, total, page, limit);
  }

  async getById(id: string) {
    const teacher = await this.repository.findById(id);
    if (!teacher) {
      throw new NotFoundException('المدرس غير موجود');
    }
    return teacher;
  }

  async create(dto: CreateTeacherDto, actor: AuthenticatedUser) {
    const teacherCode = dto.teacherCode?.trim() || (await this.generateUniqueTeacherCode());
    if (dto.teacherCode) {
      const dup = await this.repository.findByCode(teacherCode);
      if (dup) throw new ConflictException('كود المدرس مستخدم مسبقاً');
    }

    const contractDate = dto.contractDate || new Date().toISOString().slice(0, 10);
    const created = await this.repository.create({
      teacherCode,
      userId: dto.userId ?? null,
      fullName: dto.fullName.trim(),
      phone: dto.phone.trim(),
      specialization: dto.specialization.trim(),
      contractDate,
      employmentStatus: dto.employmentStatus ?? TeacherEmploymentStatus.ACTIVE,
      notes: dto.notes ?? null,
    });

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'CREATE_TEACHER',
      entityType: 'TEACHER',
      entityId: created.id,
      afterData: created,
    });

    return created;
  }

  async update(id: string, dto: UpdateTeacherDto, actor: AuthenticatedUser) {
    const existing = await this.getById(id);
    const updated = await this.repository.update(id, {
      ...(dto.userId !== undefined ? { userId: dto.userId } : {}),
      ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
      ...(dto.specialization !== undefined ? { specialization: dto.specialization.trim() } : {}),
      ...(dto.contractDate !== undefined ? { contractDate: dto.contractDate } : {}),
      ...(dto.employmentStatus !== undefined ? { employmentStatus: dto.employmentStatus } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    });

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'UPDATE_TEACHER',
      entityType: 'TEACHER',
      entityId: id,
      beforeData: existing,
      afterData: updated,
    });

    return updated;
  }

  async updateAvailability(
    id: string,
    dto: UpdateTeacherAvailabilityDto,
    actor: AuthenticatedUser,
  ) {
    await this.getById(id);
    const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    for (let i = 0; i < dto.slots.length; i++) {
      const slotA = dto.slots[i]!;
      if (slotA.startTime >= slotA.endTime) {
        throw new BadRequestException('وقت نهاية الإتاحة يجب أن يكون بعد وقت البداية');
      }

      for (let j = i + 1; j < dto.slots.length; j++) {
        const slotB = dto.slots[j]!;
        if (Number(slotA.dayOfWeek) !== Number(slotB.dayOfWeek)) continue;

        const dayName = ARABIC_DAYS[Number(slotA.dayOfWeek)] ?? String(slotA.dayOfWeek);
        if (slotA.startTime === slotB.startTime && slotA.endTime === slotB.endTime) {
          throw new ConflictException(
            `تكرار فترة الإتاحة مرفوض: يوم ${dayName} (${slotA.startTime} - ${slotA.endTime}) مكررة`,
          );
        }

        if (slotA.startTime < slotB.endTime && slotA.endTime > slotB.startTime) {
          throw new ConflictException(
            `تعارض في أوقات إتاحة المدرس يوم ${dayName}: (${slotA.startTime} - ${slotA.endTime}) تتداخل مع (${slotB.startTime} - ${slotB.endTime})`,
          );
        }
      }
    }

    const updatedSlots = await this.repository.replaceAvailability(id, dto.slots);
    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'UPDATE_TEACHER_AVAILABILITY',
      entityType: 'TEACHER',
      entityId: id,
      afterData: updatedSlots,
    });

    return updatedSlots;
  }

  async getProfile(id: string, requestedYearMonth?: string, actor?: AuthenticatedUser) {
    const teacher = await this.getById(id);
    const isOwner = actor?.roleCode === SystemRole.OWNER;
    const isOwnTeacher = Boolean(actor?.id && teacher.userId === actor.id);
    const canViewAllTeachers =
      !actor || isOwner || Boolean(actor.permissions?.includes(PERMISSIONS.TEACHERS_VIEW));

    if (!canViewAllTeachers && !isOwnTeacher) {
      throw new ForbiddenException('لا تملك صلاحية عرض ملف مدرس آخر');
    }

    const yearMonth = requestedYearMonth || this.getCurrentYearMonth();
    const bundle = await this.profileRepository.fetchProfileBundle(id, yearMonth);
    const hasFinanceView = Boolean(actor?.permissions?.includes(PERMISSIONS.FINANCE_VIEW));
    const canViewFinance = !actor || isOwner || isOwnTeacher || hasFinanceView;

    const fullSummary = computeTeacherMonthlySummary(yearMonth, bundle);
    const monthlyBreakdown = canViewFinance
      ? fullSummary
      : {
          groups: fullSummary.groups.map((g) => ({
            ...g,
            grossRevenue: 0,
            teacherShare: 0,
            centerShare: 0,
          })),
          totals: {
            groupsCount: fullSummary.totals.groupsCount,
            executedSessionsCount: fullSummary.totals.executedSessionsCount,
            totalDues: 0,
            totalPayouts: 0,
            remainingBalance: 0,
            isClosed: fullSummary.totals.isClosed,
          },
        };

    const assignedGroups = canViewFinance
      ? bundle.assignedGroups
      : bundle.assignedGroups.map((g) => ({
          ...g,
          teacherSharePerStudent: '0.00',
          centerSharePerStudent: '0.00',
          teacherPercentage: '0.00',
        }));

    const scheduleSlots = assignedGroups
      .filter((g) => g.isActive)
      .flatMap((g) =>
        (g.scheduleSlots || []).map((slot) => ({
          groupId: g.id,
          groupName: g.name,
          classroomName: g.classroomName,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
        })),
      )
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));

    const rawMonthsOverview = buildTeacherMonthsOverview({
      requestedYearMonth: yearMonth,
      currentYearMonth: this.getCurrentYearMonth(),
      contractDate: teacher.contractDate,
      bundle,
    });

    const monthsOverview = canViewFinance
      ? rawMonthsOverview
      : rawMonthsOverview.map((m) => ({
          ...m,
          payoutStatus: 'NO_DUES' as const,
          totalDues: 0,
          totalPayouts: 0,
          remainingBalance: 0,
          payoutsCount: 0,
        }));

    const monthSessions = buildTeacherMonthSessions(yearMonth, bundle);

    return {
      teacher,
      yearMonth,
      assignedGroups,
      scheduleSlots,
      availability: bundle.availability,
      monthlyBreakdown,
      monthsOverview,
      monthSessions,
      payouts: canViewFinance ? bundle.payouts : [],
    };
  }

  async getOwnProfile(userId: string, requestedYearMonth?: string) {
    const teacher = await this.repository.findByUserId(userId);
    if (!teacher) {
      throw new NotFoundException('لا يوجد ملف مدرس مرتبط بحسابك الحالي');
    }
    return this.getProfile(teacher.id, requestedYearMonth, { id: userId } as AuthenticatedUser);
  }

  private async generateUniqueTeacherCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      const candidate = `TCH-${rand}`;
      const existing = await this.repository.findByCode(candidate);
      if (!existing) return candidate;
    }
    return `TCH-${Date.now().toString().slice(-5)}`;
  }

  private getCurrentYearMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}
