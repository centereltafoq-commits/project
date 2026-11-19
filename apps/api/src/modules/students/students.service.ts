import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PERMISSIONS, StudentStatus, SystemRole } from '@edu-center/shared';
import { CacheService } from '../../common/cache/cache.module';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateStudentDto, StudentQueryDto, UpdateStudentDto } from './dto/student.dto';
import { StudentsRepository } from './students.repository';
import { StudentsProfileRepository } from './students-profile.repository';
import { computeStudentMonthlyBreakdown } from './students-finance.calculator';
import { buildStudentMonthsOverview } from './students-months-overview.builder';

@Injectable()
export class StudentsService {
  constructor(
    private readonly repository: StudentsRepository,
    private readonly profileRepository: StudentsProfileRepository,
    private readonly audit: AuditLogsService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  async list(query: StudentQueryDto) {
    const { rows, total, page, limit, summary } = await this.repository.findPaginated(query);
    return {
      ...createPaginatedResult(rows, total, page, limit),
      summary,
    };
  }

  async getById(id: string) {
    const student = await this.repository.findById(id);
    if (!student) {
      throw new NotFoundException('الطالب غير موجود');
    }
    return student;
  }

  async create(dto: CreateStudentDto, actor: AuthenticatedUser) {
    const studentCode = dto.studentCode?.trim() || (await this.generateUniqueStudentCode());
    if (dto.studentCode) {
      const dup = await this.repository.findByCode(studentCode);
      if (dup) throw new ConflictException('كود الطالب مستخدم مسبقاً');
    }

    const registrationDate = dto.registrationDate || new Date().toISOString().slice(0, 10);
    const created = await this.repository.create({
      studentCode,
      fullName: dto.fullName.trim(),
      phone: dto.phone?.trim() || null,
      guardianPhone: dto.guardianPhone?.trim() || null,
      gradeLevel: dto.gradeLevel.trim(),
      registrationDate,
      status: dto.status ?? StudentStatus.ACTIVE,
      notes: dto.notes ?? null,
    });

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'CREATE_STUDENT',
      entityType: 'STUDENT',
      entityId: created.id,
      afterData: created,
    });

    await this.cache?.invalidateRosterViews();
    return created;
  }

  async update(id: string, dto: UpdateStudentDto, actor: AuthenticatedUser) {
    const existing = await this.getById(id);
    const updated = await this.repository.update(id, {
      ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
      ...(dto.guardianPhone !== undefined
        ? { guardianPhone: dto.guardianPhone?.trim() || null }
        : {}),
      ...(dto.gradeLevel !== undefined ? { gradeLevel: dto.gradeLevel.trim() } : {}),
      ...(dto.registrationDate !== undefined ? { registrationDate: dto.registrationDate } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    });

    const isArchiving =
      dto.status === StudentStatus.ARCHIVED && existing.status !== StudentStatus.ARCHIVED;

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: isArchiving ? 'ARCHIVE_STUDENT' : 'UPDATE_STUDENT',
      entityType: 'STUDENT',
      entityId: id,
      beforeData: existing,
      afterData: updated,
    });

    await this.cache?.invalidateRosterViews();
    return updated;
  }

  async archive(id: string, actor: AuthenticatedUser) {
    const existing = await this.getById(id);
    const updated = await this.repository.update(id, { status: StudentStatus.ARCHIVED });

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'ARCHIVE_STUDENT',
      entityType: 'STUDENT',
      entityId: id,
      beforeData: existing,
      afterData: updated,
    });

    await this.cache?.invalidateRosterViews();
    return updated;
  }

  async getProfile(id: string, requestedYearMonth?: string, actor?: AuthenticatedUser) {
    const student = await this.getById(id);
    const yearMonth = requestedYearMonth || this.getCurrentYearMonth();
    const bundle = await this.profileRepository.fetchProfileBundle(id, yearMonth);
    const canViewFinance =
      !actor ||
      actor.roleCode === SystemRole.OWNER ||
      Boolean(actor.permissions?.includes(PERMISSIONS.FINANCE_VIEW));

    const computed = computeStudentMonthlyBreakdown(yearMonth, bundle);
    const breakdown = canViewFinance
      ? computed.breakdown
      : computed.breakdown.map((g) => ({
          ...g,
          sessionPrice: 0,
          totalDue: 0,
          totalPaid: 0,
          remaining: 0,
        }));
    const monthTotals = canViewFinance
      ? computed.monthTotals
      : {
          ...computed.monthTotals,
          totalDue: 0,
          totalPaid: 0,
          remaining: 0,
        };

    const rawMonthsOverview = buildStudentMonthsOverview(
      yearMonth,
      this.getCurrentYearMonth(),
      bundle,
    );
    const monthsOverview = canViewFinance
      ? rawMonthsOverview
      : rawMonthsOverview.map((m) => ({
          ...m,
          paymentStatus: 'NO_DUES' as const,
          totalDue: 0,
          totalPaid: 0,
          remaining: 0,
          paymentsCount: 0,
        }));

    return {
      student,
      yearMonth,
      enrollments: bundle.studentEnrollments,
      attendanceRecords: bundle.monthAttendance,
      monthlyBreakdown: breakdown,
      monthTotals,
      payments: canViewFinance ? bundle.studentPayments : [],
      monthsOverview,
    };
  }

  private async generateUniqueStudentCode(): Promise<string> {
    const year = new Date().getFullYear();
    for (let attempt = 0; attempt < 10; attempt++) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      const candidate = `STU-${year}-${rand}`;
      const existing = await this.repository.findByCode(candidate);
      if (!existing) return candidate;
    }
    return `STU-${year}-${Date.now().toString().slice(-5)}`;
  }

  private getCurrentYearMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
}
