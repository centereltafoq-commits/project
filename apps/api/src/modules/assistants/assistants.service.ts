import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AssistantCalculationMethod, PERMISSIONS, SystemRole } from '@edu-center/shared';
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

@Injectable()
export class AssistantsService {
  constructor(
    private readonly repository: AssistantsRepository,
    private readonly profileRepository: AssistantsProfileRepository,
    private readonly audit: AuditLogsService,
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

  async create(dto: CreateAssistantDto, actor: AuthenticatedUser) {
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

    return created;
  }

  async update(id: string, dto: UpdateAssistantDto, actor: AuthenticatedUser) {
    const existing = await this.getById(id);
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

    if (!canViewFinance) {
      return {
        assistant,
        yearMonth,
        linkedGroups: maskedLinkedGroups,
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

    const execByGroup = new Map(
      bundle.sessionCounts.map((s) => [s.groupId, Number(s.executedCount || 0)]),
    );
    const hoursByGroup = new Map(
      bundle.sessionCounts.map((s) => [
        s.groupId,
        this.round2(Number((s as { executedMinutes?: number }).executedMinutes || 0) / 60),
      ]),
    );
    const presentByGroup = new Map(
      bundle.attendanceCounts.map((a) => [a.groupId, Number(a.presentEntries || 0)]),
    );
    const storedByGroup = new Map(
      bundle.storedDues.filter((d) => d.groupId).map((d) => [d.groupId!, d]),
    );

    const groupDues = bundle.linkedGroups.map((grp) => {
      const sessionsCount = execByGroup.get(grp.groupId) ?? 0;
      const stored = storedByGroup.get(grp.groupId);
      if (stored && (stored.isLocked || stored.sessionsCount === sessionsCount)) {
        return {
          groupId: grp.groupId,
          groupName: grp.groupName,
          calculationMethod: stored.calculationMethod,
          rateValue: Number(grp.overrideRateValue ?? rawAssistant.rateValue),
          sessionsCount: stored.sessionsCount,
          studentsCount: stored.studentsCount,
          amount: Number(stored.amount),
          isLocked: stored.isLocked,
        };
      }

      const method = (grp.overrideCalculationMethod ||
        rawAssistant.calculationMethod) as AssistantCalculationMethod;
      const rate = Number(grp.overrideRateValue ?? rawAssistant.rateValue ?? 0);
      const hoursCount = hoursByGroup.get(grp.groupId) ?? sessionsCount * 2;
      const studentsCount = Number(grp.activeStudentsCount || 0);
      const presentEntries = presentByGroup.get(grp.groupId) ?? 0;
      const sessionPrice = Number(grp.calculatedSessionPrice || 0);

      let amount = 0;
      if (method === AssistantCalculationMethod.FIXED_PER_STUDENT) {
        amount = studentsCount * rate;
      } else if (method === AssistantCalculationMethod.PER_ATTENDING_STUDENT) {
        amount = presentEntries * rate;
      } else if (method === AssistantCalculationMethod.FIXED_PER_SESSION) {
        amount = sessionsCount * rate;
      } else if (method === AssistantCalculationMethod.HOURLY) {
        amount = (hoursCount > 0 ? hoursCount : sessionsCount * 2) * rate;
      } else if (method === AssistantCalculationMethod.SESSION_COMMISSION_PERCENT) {
        const clampedRate = Math.min(100, Math.max(0, rate));
        const rev =
          presentEntries > 0
            ? presentEntries * sessionPrice
            : studentsCount * sessionsCount * sessionPrice;
        amount = (rev * clampedRate) / 100;
      } else if (method === AssistantCalculationMethod.FIXED_MONTHLY) {
        amount = grp.overrideRateValue !== null ? rate : 0;
      } else {
        amount = grp.overrideRateValue !== null ? rate : 0;
      }

      return {
        groupId: grp.groupId,
        groupName: grp.groupName,
        calculationMethod: method,
        rateValue: rate,
        sessionsCount,
        studentsCount,
        amount: this.round2(amount),
        isLocked: false,
      };
    });

    const globalStoredDue = bundle.storedDues.find((d) => !d.groupId);
    const hasNonOverriddenOrNoLinks =
      bundle.linkedGroups.length === 0 ||
      bundle.linkedGroups.some((g) => !g.overrideCalculationMethod && g.overrideRateValue === null);

    const baseGlobalDue = globalStoredDue
      ? Number(globalStoredDue.amount)
      : (rawAssistant.calculationMethod === AssistantCalculationMethod.FIXED_MONTHLY ||
            rawAssistant.calculationMethod === AssistantCalculationMethod.CUSTOM_AGREEMENT) &&
          hasNonOverriddenOrNoLinks
        ? Number(rawAssistant.rateValue || 0)
        : 0;

    const liveTotalDues = this.round2(
      groupDues.reduce((s, d) => s + d.amount, 0) + baseGlobalDue,
    );
    const monthPayoutsTotal = this.round2(
      bundle.payouts
        .filter((p) => p.yearMonth === yearMonth)
        .reduce((s, p) => s + Number(p.amount || 0), 0),
    );

    const totalDues = bundle.storedMonthlyRecord?.isClosed
      ? Number(bundle.storedMonthlyRecord.totalDues)
      : liveTotalDues;
    const totalPayouts = bundle.storedMonthlyRecord?.isClosed
      ? Number(bundle.storedMonthlyRecord.totalPaidOut)
      : monthPayoutsTotal;
    const remainingBalance = Math.max(0, this.round2(totalDues - totalPayouts));

    return {
      assistant,
      yearMonth,
      linkedGroups: maskedLinkedGroups,
      monthlyBreakdown: {
        groupDues,
        baseGlobalDue,
        totalDues,
        totalPayouts,
        remainingBalance,
        isClosed: bundle.storedMonthlyRecord?.isClosed ?? false,
      },
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
