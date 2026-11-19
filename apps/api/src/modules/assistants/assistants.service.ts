import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { AssistantCalculationMethod, PERMISSIONS, SystemRole } from '@edu-center/shared';
import { CacheService } from '../../common/cache/cache.module';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  AssistantQueryDto,
  CreateAssistantDto,
  UpdateAssistantDto,
} from './dto/assistant.dto';
import { AssistantsRepository } from './assistants.repository';
import { AssistantsProfileRepository } from './assistants-profile.repository';
import {
  buildAssistantMonthsOverview,
  computeAssistantMonthlyBreakdown,
} from './assistants-months-overview.builder';

@Injectable()
export class AssistantsService {
  constructor(
    private readonly repository: AssistantsRepository,
    private readonly profileRepository: AssistantsProfileRepository,
    private readonly audit: AuditLogsService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  private canSeeCompensation(actor?: AuthenticatedUser): boolean {
    if (!actor) return true;
    if (actor.roleCode === SystemRole.OWNER) return true;
    return Boolean(
      actor.permissions?.includes(PERMISSIONS.FINANCE_VIEW) ||
        actor.permissions?.includes(PERMISSIONS.ASSISTANTS_MANAGE),
    );
  }

  private maskAssistantRow<T extends { rateValue: string; customFormulaNote: string | null }>(
    row: T,
    actor?: AuthenticatedUser,
  ): T {
    if (this.canSeeCompensation(actor)) return row;
    return {
      ...row,
      rateValue: '0.00',
      customFormulaNote: null,
    };
  }

  async list(query: AssistantQueryDto, actor?: AuthenticatedUser) {
    const { rows, total, page, limit } = await this.repository.findPaginated(query);
    const maskedRows = rows.map((r) => this.maskAssistantRow(r, actor));
    return createPaginatedResult(maskedRows, total, page, limit);
  }

  async getById(id: string, actor?: AuthenticatedUser) {
    const assistant = await this.repository.findById(id);
    if (!assistant) {
      throw new NotFoundException('المساعد غير موجود');
    }
    return this.maskAssistantRow(assistant, actor);
  }

  private validateRateForMethod(
    calculationMethod: AssistantCalculationMethod | string,
    rateValue: number,
  ): void {
    if (!Number.isFinite(rateValue) || rateValue < 0) {
      throw new BadRequestException('قيمة النسبة أو الأجر لا يمكن أن تكون سالبة');
    }
    if (
      calculationMethod === AssistantCalculationMethod.SESSION_COMMISSION_PERCENT &&
      rateValue > 100
    ) {
      throw new BadRequestException('نسبة عمولة المساعد لا يمكن أن تتجاوز 100%');
    }
  }

  async create(dto: CreateAssistantDto, actor: AuthenticatedUser) {
    this.validateRateForMethod(dto.calculationMethod, dto.rateValue);

    const assistantCode = dto.assistantCode?.trim() || (await this.generateUniqueAssistantCode());
    if (dto.assistantCode) {
      const dup = await this.repository.findByCode(assistantCode);
      if (dup) throw new ConflictException('كود المساعد مستخدم مسبقاً');
    }

    const created = await this.repository.create({
      assistantCode,
      fullName: dto.fullName.trim(),
      phone: dto.phone.trim(),
      calculationMethod: dto.calculationMethod,
      rateValue: dto.rateValue.toFixed(2),
      customFormulaNote: dto.customFormulaNote ?? null,
      status: dto.status ?? 'ACTIVE',
    });

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'CREATE_ASSISTANT',
      entityType: 'ASSISTANT',
      entityId: created.id,
      afterData: created,
    });

    await this.cache?.invalidateRosterViews();
    return created;
  }

  async update(id: string, dto: UpdateAssistantDto, actor: AuthenticatedUser) {
    const existing = await this.getById(id);
    const effectiveMethod = dto.calculationMethod ?? existing.calculationMethod;
    const effectiveRate =
      dto.rateValue !== undefined ? dto.rateValue : Number(existing.rateValue);
    this.validateRateForMethod(effectiveMethod, effectiveRate);

    const updated = await this.repository.update(id, {
      ...(dto.fullName !== undefined ? { fullName: dto.fullName.trim() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
      ...(dto.calculationMethod !== undefined ? { calculationMethod: dto.calculationMethod } : {}),
      ...(dto.rateValue !== undefined ? { rateValue: dto.rateValue.toFixed(2) } : {}),
      ...(dto.customFormulaNote !== undefined ? { customFormulaNote: dto.customFormulaNote } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    });

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'UPDATE_ASSISTANT',
      entityType: 'ASSISTANT',
      entityId: id,
      beforeData: existing,
      afterData: updated,
    });

    await this.cache?.invalidateRosterViews();
    return updated;
  }

  async getProfile(id: string, requestedYearMonth?: string, actor?: AuthenticatedUser) {
    const rawAssistant = await this.getById(id);
    const assistant = this.maskAssistantRow(rawAssistant, actor);
    const yearMonth = requestedYearMonth || this.getCurrentYearMonth();
    const bundle = await this.profileRepository.fetchProfileBundle(id, yearMonth);
    const canViewFinance =
      !actor ||
      actor.roleCode === SystemRole.OWNER ||
      Boolean(actor.permissions?.includes(PERMISSIONS.FINANCE_VIEW));
    const canSeeRates = this.canSeeCompensation(actor);
    const maskedLinkedGroups = canSeeRates
      ? bundle.linkedGroups
      : bundle.linkedGroups.map((g) => ({ ...g, overrideRateValue: null }));

    const monthsOverview = buildAssistantMonthsOverview({
      requestedYearMonth: yearMonth,
      currentYearMonth: this.getCurrentYearMonth(),
      assistant: rawAssistant,
      bundle,
    });

    if (!canViewFinance) {
      return {
        assistant,
        yearMonth,
        linkedGroups: maskedLinkedGroups,
        monthsOverview: monthsOverview.map((m) => ({
          ...m,
          payoutStatus: 'NO_DUES' as const,
          totalDues: 0,
          totalPayouts: 0,
          remainingBalance: 0,
          payoutsCount: 0,
        })),
        monthlyBreakdown: {
          groupDues: [],
          baseGlobalDue: 0,
          totalDues: 0,
          totalPayouts: 0,
          remainingBalance: 0,
          isClosed: false,
        },
        payouts: [],
      };
    }

    const monthlyBreakdown = computeAssistantMonthlyBreakdown({
      yearMonth,
      assistant: rawAssistant,
      linkedGroups: bundle.linkedGroups,
      storedDues: bundle.storedDues,
      storedMonthlyRecord: bundle.storedMonthlyRecord,
      payouts: bundle.payouts,
      sessionCounts: bundle.sessionCounts,
      attendanceCounts: bundle.attendanceCounts,
    });

    return {
      assistant,
      yearMonth,
      linkedGroups: maskedLinkedGroups,
      monthsOverview,
      monthlyBreakdown,
      payouts: bundle.payouts,
    };
  }

  private async generateUniqueAssistantCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      const candidate = `AST-${rand}`;
      const existing = await this.repository.findByCode(candidate);
      if (!existing) return candidate;
    }
    return `AST-${Date.now().toString().slice(-5)}`;
  }

  private getCurrentYearMonth(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
