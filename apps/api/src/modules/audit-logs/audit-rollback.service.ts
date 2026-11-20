import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { EnrollmentStatus, SessionStatus, SystemRole } from '@edu-center/shared';
import { CacheService } from '../../common/cache/cache.module';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { MonthlySettlementService } from '../finance/monthly-settlement.service';
import { parseMoney, roundMoney } from '../finance/utils/money.util';
import { AuditRollbackRepository } from './audit-rollback.repository';
import {
  ACTION_REQUIRED_PERMISSIONS,
  AuditRollbackExecuteResult,
  AuditRollbackPreviewResult,
  ReversibleAuditAction,
  RollbackImpactItem,
  isReversibleAuditAction,
} from './audit-rollback.types';
import { AuditLogsService } from './audit-logs.service';
import { getActionArabicLabel, getEntityArabicLabel } from './audit-translations.util';

@Injectable()
export class AuditRollbackService {
  constructor(
    private readonly rollbackRepo: AuditRollbackRepository,
    private readonly auditLogsService: AuditLogsService,
    @Optional()
    @Inject(forwardRef(() => MonthlySettlementService))
    private readonly settlementService?: MonthlySettlementService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  private getCurrentYearMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  assertCanRollback(action: string, actor?: AuthenticatedUser): void {
    if (!actor) return;
    if (actor.roleCode === SystemRole.OWNER) return;

    const reqPerm = ACTION_REQUIRED_PERMISSIONS[action as ReversibleAuditAction];
    if (!reqPerm || !(actor.permissions ?? []).includes(reqPerm)) {
      throw new ForbiddenException(
        'لا تملك الصلاحية المطلوبة للتراجع عن هذا النوع من العمليات',
      );
    }
  }

  private buildBasePreview(
    log: NonNullable<Awaited<ReturnType<AuditRollbackRepository['findAuditLogById']>>>,
  ): AuditRollbackPreviewResult {
    return {
      auditLogId: log.id,
      action: log.action,
      actionAr: getActionArabicLabel(log.action),
      entityType: log.entityType,
      entityTypeAr: getEntityArabicLabel(log.entityType),
      entityId: log.entityId ?? null,
      isReversible: isReversibleAuditAction(log.action),
      canRollback: false,
      alreadyReverted: false,
      blockedReason: null,
      affectedMonths: [],
      affectedChanges: [],
      warnings: [],
    };
  }

  private async isAnyMonthClosed(yearMonths: string[]): Promise<string | null> {
    if (!this.settlementService?.isMonthClosed) return null;
    for (const ym of Array.from(new Set(yearMonths))) {
      if (await this.settlementService.isMonthClosed(ym)) {
        return ym;
      }
    }
    return null;
  }

  async previewRollback(
    auditLogId: string,
    actor: AuthenticatedUser,
  ): Promise<AuditRollbackPreviewResult> {
    const log = await this.rollbackRepo.findAuditLogById(auditLogId);
    if (!log) {
      throw new NotFoundException('سجل العملية المطلوب غير موجود');
    }

    const base = this.buildBasePreview(log);

    if (!base.isReversible) {
      return {
        ...base,
        blockedReason: 'هذا النوع من العمليات لا يدعم التراجع التلقائي حرصاً على سلامة البيانات',
      };
    }

    this.assertCanRollback(log.action, actor);

    const existingRollback = await this.rollbackRepo.findExistingRollbackForLog(auditLogId);
    if (existingRollback) {
      return {
        ...base,
        alreadyReverted: true,
        blockedReason: `تم التراجع عن هذه العملية مسبقاً بواسطة (${existingRollback.revertedByName})`,
      };
    }

    if (!log.entityId) {
      return {
        ...base,
        blockedReason: 'لا يوجد معرّف سجل مرتبط بهذه العملية لتنفيذ التراجع',
      };
    }

    const laterLogs = await this.rollbackRepo.findLaterEntityLogs(
      log.entityType,
      log.entityId,
      new Date(log.createdAt),
      log.id,
    );
    if (laterLogs.length > 0) {
      base.warnings.push(
        `يوجد (${laterLogs.length}) تعديل/عملية أحدث مسجلة على نفس السجل بعد هذه العملية.`,
      );
    }

    switch (log.action as ReversibleAuditAction) {
      case 'FINANCE_COLLECT_PAYMENT':
        return this.previewPaymentRollback(base, log.entityId);
      case 'FINANCE_TEACHER_PAYOUT':
        return this.previewTeacherPayoutRollback(base, log.entityId);
      case 'FINANCE_ASSISTANT_PAYOUT':
        return this.previewAssistantPayoutRollback(base, log.entityId);
      case 'FINANCE_EXPENSE_CREATE':
        return this.previewExpenseCreateRollback(base, log.entityId);
      case 'FINANCE_EXPENSE_UPDATE':
        return this.previewExpenseUpdateRollback(base, log.entityId, log.beforeData);
      case 'FINANCE_EXPENSE_DELETE':
        return this.previewExpenseDeleteRollback(base, log.entityId, log.beforeData);
      case 'CREATE_ENROLLMENT':
        return this.previewCreateEnrollmentRollback(base, log.entityId);
      case 'UPDATE_ENROLLMENT':
        return this.previewUpdateEnrollmentRollback(base, log.entityId, log.beforeData);
      case 'UPDATE_STUDENT':
      case 'ARCHIVE_STUDENT':
        return this.previewStudentUpdateRollback(base, log.entityId, log.beforeData);
      case 'OVERRIDE_ATTENDANCE':
        return this.previewAttendanceOverrideRollback(base, log.entityId, log.beforeData);
      case 'COMPLETE_GROUP_SESSION':
        return this.previewCompleteGroupSessionRollback(base, log.entityId);
    }
  }

  private async previewPaymentRollback(
    base: AuditRollbackPreviewResult,
    paymentId: string,
  ): Promise<AuditRollbackPreviewResult> {
    const payment = await this.rollbackRepo.getPaymentWithDetails(paymentId);
    if (!payment) {
      return {
        ...base,
        blockedReason: 'إيصال التحصيل غير موجود أو تم التراجع عنه/حذفه بالفعل',
      };
    }

    const closedYm =
      payment.monthlyRows.some((r) => r.isClosed)
        ? payment.yearMonth
        : await this.isAnyMonthClosed([payment.yearMonth]);

    if (closedYm) {
      return {
        ...base,
        affectedMonths: [payment.yearMonth],
        blockedReason: `الشهر المالي (${closedYm}) مغلق نهائياً — لا يمكن التراجع عن التحصيل فيه`,
      };
    }

    const totalCurrentPaid = roundMoney(
      payment.monthlyRows.reduce((s, r) => s + parseMoney(r.totalPaid), 0),
    );
    const totalCurrentDue = roundMoney(
      payment.monthlyRows.reduce((s, r) => s + parseMoney(r.totalDue), 0),
    );
    const currentRemaining = roundMoney(Math.max(0, totalCurrentDue - totalCurrentPaid));
    const afterRollbackPaid = roundMoney(Math.max(0, totalCurrentPaid - payment.amountNum));
    const afterRollbackRemaining = roundMoney(Math.max(0, totalCurrentDue - afterRollbackPaid));

    const changes: RollbackImpactItem[] = [
      {
        area: 'إيصال التحصيل',
        summary: `إلغاء وحذف إيصال رقم (${payment.receiptNumber}) بقيمة ${payment.amountNum} ج.م`,
        detail: `الطالب: ${payment.studentName} (${payment.studentCode}) — شهر ${payment.yearMonth}`,
        severity: 'warning',
      },
      {
        area: 'رصيد ومستحقات الطالب',
        summary: `تعديل المسدد من ${totalCurrentPaid} ج.م إلى ${afterRollbackPaid} ج.م`,
        detail: `سيرتفع المتبقي على الطالب في شهر ${payment.yearMonth} من ${currentRemaining} ج.م إلى ${afterRollbackRemaining} ج.م`,
        severity: 'info',
      },
      {
        area: 'التقارير والخزينة',
        summary: `إعادة احتساب صافي تحصيلات شهر ${payment.yearMonth}`,
        detail: 'سيتم خصم المبلغ من إجمالي المتحصلات والتقارير المالية ورفع المتبقي عند بوابة QR',
        severity: 'info',
      },
    ];

    if (payment.allocations.length > 0) {
      const allocSummary = payment.allocations
        .map((a) => `${a.groupName || 'مجموعة'}: ${a.allocatedNum} ج.م`)
        .join('، ');
      changes.push({
        area: 'توزيعات المجموعات',
        summary: `حذف ${payment.allocations.length} توزيع مالي مرتبط بالإيصال`,
        detail: allocSummary,
        severity: 'info',
      });
    }

    return {
      ...base,
      canRollback: true,
      affectedMonths: [payment.yearMonth],
      affectedChanges: changes,
    };
  }

  private async previewTeacherPayoutRollback(
    base: AuditRollbackPreviewResult,
    payoutId: string,
  ): Promise<AuditRollbackPreviewResult> {
    const payout = await this.rollbackRepo.getTeacherPayoutWithDetails(payoutId);
    if (!payout) {
      return {
        ...base,
        blockedReason: 'سجل صرف مستحقات المدرس غير موجود أو تم التراجع عنه بالفعل',
      };
    }

    const closedYm =
      payout.monthly?.isClosed
        ? payout.yearMonth
        : await this.isAnyMonthClosed([payout.yearMonth]);

    if (closedYm) {
      return {
        ...base,
        affectedMonths: [payout.yearMonth],
        blockedReason: `الشهر المالي (${closedYm}) مغلق نهائياً — لا يمكن التراجع عن الصرف فيه`,
      };
    }

    const prevPaidOut = parseMoney(payout.monthly?.totalPaidOut);
    const totalDues = parseMoney(payout.monthly?.totalDues);
    const prevRem = parseMoney(payout.monthly?.remainingBalance);
    const afterPaidOut = roundMoney(Math.max(0, prevPaidOut - payout.amountNum));
    const afterRem = roundMoney(Math.max(0, totalDues - afterPaidOut));

    return {
      ...base,
      canRollback: true,
      affectedMonths: [payout.yearMonth],
      affectedChanges: [
        {
          area: 'إذن صرف المدرس',
          summary: `حذف صرف رقم (${payout.referenceNumber}) بقيمة ${payout.amountNum} ج.م`,
          detail: `المدرس: ${payout.teacherName} (${payout.teacherCode}) — شهر ${payout.yearMonth}`,
          severity: 'warning',
        },
        {
          area: 'حساب المدرس الشهري',
          summary: `تعديل إجمالي المنصرف للمدرس من ${prevPaidOut} ج.م إلى ${afterPaidOut} ج.م`,
          detail: `المستحق المتبقي للمدرس سيعود من ${prevRem} ج.م إلى ${afterRem} ج.م`,
          severity: 'info',
        },
        {
          area: 'الخزينة والتسويات',
          summary: `إعادة احتساب ملخص شهر ${payout.yearMonth}`,
          detail: 'سيعود مبلغ الصرف إلى الرصيد المستحق للمدرس ويُخصم من بند المصروفات/الصرف',
          severity: 'info',
        },
      ],
    };
  }

  private async previewAssistantPayoutRollback(
    base: AuditRollbackPreviewResult,
    payoutId: string,
  ): Promise<AuditRollbackPreviewResult> {
    const payout = await this.rollbackRepo.getAssistantPayoutWithDetails(payoutId);
    if (!payout) {
      return {
        ...base,
        blockedReason: 'سجل صرف مستحقات المساعد غير موجود أو تم التراجع عنه بالفعل',
      };
    }

    const closedYm =
      payout.monthly?.isClosed
        ? payout.yearMonth
        : await this.isAnyMonthClosed([payout.yearMonth]);

    if (closedYm) {
      return {
        ...base,
        affectedMonths: [payout.yearMonth],
        blockedReason: `الشهر المالي (${closedYm}) مغلق نهائياً — لا يمكن التراجع عن الصرف فيه`,
      };
    }

    const prevPaidOut = parseMoney(payout.monthly?.totalPaidOut);
    const totalDues = parseMoney(payout.monthly?.totalDues);
    const prevRem = parseMoney(payout.monthly?.remainingBalance);
    const afterPaidOut = roundMoney(Math.max(0, prevPaidOut - payout.amountNum));
    const afterRem = roundMoney(Math.max(0, totalDues - afterPaidOut));

    return {
      ...base,
      canRollback: true,
      affectedMonths: [payout.yearMonth],
      affectedChanges: [
        {
          area: 'إذن صرف المساعد',
          summary: `حذف صرف رقم (${payout.referenceNumber}) بقيمة ${payout.amountNum} ج.م`,
          detail: `المساعد: ${payout.assistantName} (${payout.assistantCode}) — شهر ${payout.yearMonth}`,
          severity: 'warning',
        },
        {
          area: 'حساب المساعد الشهري',
          summary: `تعديل إجمالي المنصرف للمساعد من ${prevPaidOut} ج.م إلى ${afterPaidOut} ج.م`,
          detail: `المستحق المتبقي للمساعد سيعود من ${prevRem} ج.م إلى ${afterRem} ج.م`,
          severity: 'info',
        },
      ],
    };
  }

  private async previewExpenseCreateRollback(
    base: AuditRollbackPreviewResult,
    expenseId: string,
  ): Promise<AuditRollbackPreviewResult> {
    const expense = await this.rollbackRepo.getExpenseById(expenseId);
    if (!expense) {
      return {
        ...base,
        blockedReason: 'سجل المصروف غير موجود أو تم حذفه بالفعل',
      };
    }

    const closedYm = await this.isAnyMonthClosed([expense.yearMonth]);
    if (closedYm) {
      return {
        ...base,
        affectedMonths: [expense.yearMonth],
        blockedReason: `الشهر المالي (${closedYm}) مغلق نهائياً — لا يمكن التراجع عن المصروف فيه`,
      };
    }

    return {
      ...base,
      canRollback: true,
      affectedMonths: [expense.yearMonth],
      affectedChanges: [
        {
          area: 'المصروفات',
          summary: `حذف المصروف "${expense.title}" بقيمة ${parseMoney(expense.amount)} ج.م`,
          detail: `تاريخ المصروف: ${expense.expenseDate} (شهر ${expense.yearMonth})`,
          severity: 'warning',
        },
        {
          area: 'صافي الربح والتسوية',
          summary: `إعادة احتساب مصروفات وصافي شهر ${expense.yearMonth}`,
          detail: 'سيتم حذف أثر هذا المصروف من إجمالي مصروفات السنتر',
          severity: 'info',
        },
      ],
    };
  }

  private async previewExpenseUpdateRollback(
    base: AuditRollbackPreviewResult,
    expenseId: string,
    beforeData: unknown,
  ): Promise<AuditRollbackPreviewResult> {
    if (!beforeData || typeof beforeData !== 'object') {
      return { ...base, blockedReason: 'لا توجد بيانات سابقة مسجلة لاستعادة المصروف' };
    }
    const existing = await this.rollbackRepo.getExpenseById(expenseId);
    if (!existing) {
      return { ...base, blockedReason: 'سجل المصروف غير موجود' };
    }
    const prev = beforeData as Record<string, any>;
    const months = Array.from(new Set([existing.yearMonth, String(prev.yearMonth || existing.yearMonth)]));
    const closedYm = await this.isAnyMonthClosed(months);
    if (closedYm) {
      return {
        ...base,
        affectedMonths: months,
        blockedReason: `الشهر المالي (${closedYm}) مغلق نهائياً — لا يمكن تعديل المصروف فيه`,
      };
    }

    return {
      ...base,
      canRollback: true,
      affectedMonths: months,
      affectedChanges: [
        {
          area: 'استعادة بيانات المصروف',
          summary: `إرجاع "${existing.title}" (${parseMoney(existing.amount)} ج.م) إلى "${prev.title}" (${parseMoney(prev.amount)} ج.م)`,
          detail: `التاريخ سيعود إلى ${prev.expenseDate ?? existing.expenseDate}`,
          severity: 'info',
        },
      ],
    };
  }

  private async previewExpenseDeleteRollback(
    base: AuditRollbackPreviewResult,
    expenseId: string,
    beforeData: unknown,
  ): Promise<AuditRollbackPreviewResult> {
    if (!beforeData || typeof beforeData !== 'object') {
      return { ...base, blockedReason: 'لا توجد بيانات سابقة لاستعادة المصروف المحذوف' };
    }
    const existing = await this.rollbackRepo.getExpenseById(expenseId);
    if (existing) {
      return { ...base, blockedReason: 'سجل المصروف موجود بالفعل في النظام' };
    }
    const prev = beforeData as Record<string, any>;
    const yearMonth = String(prev.yearMonth || '');
    const closedYm = yearMonth ? await this.isAnyMonthClosed([yearMonth]) : null;
    if (closedYm) {
      return {
        ...base,
        affectedMonths: [closedYm],
        blockedReason: `الشهر المالي (${closedYm}) مغلق نهائياً`,
      };
    }

    return {
      ...base,
      canRollback: true,
      affectedMonths: yearMonth ? [yearMonth] : [],
      affectedChanges: [
        {
          area: 'استعادة مصروف محذوف',
          summary: `إعادة إدراج المصروف "${prev.title}" بقيمة ${parseMoney(prev.amount)} ج.م`,
          detail: `تاريخ المصروف: ${prev.expenseDate} (شهر ${yearMonth})`,
          severity: 'info',
        },
      ],
    };
  }

  private async previewCreateEnrollmentRollback(
    base: AuditRollbackPreviewResult,
    enrollmentId: string,
  ): Promise<AuditRollbackPreviewResult> {
    const enrollment = await this.rollbackRepo.getEnrollmentWithDetails(enrollmentId);
    if (!enrollment) {
      return {
        ...base,
        blockedReason: 'سجل الاشتراك غير موجود أو تم التراجع عنه بالفعل',
      };
    }

    const startYm = enrollment.startDate.slice(0, 7);
    const affectedMonths = Array.from(
      new Set(
        [startYm, enrollment.endDate?.slice(0, 7), this.getCurrentYearMonth()].filter(
          (m): m is string => Boolean(m),
        ),
      ),
    );

    const closedYm = await this.isAnyMonthClosed(affectedMonths);
    if (closedYm) {
      return {
        ...base,
        affectedMonths,
        blockedReason: `الشهر المالي (${closedYm}) مغلق نهائياً — لا يمكن التراجع عن الاشتراك`,
      };
    }

    const deps = await this.rollbackRepo.countEnrollmentDependencies(
      enrollment.studentId,
      enrollment.groupId,
      enrollment.startDate,
      enrollment.endDate,
    );

    if (deps.paymentAllocationsCount > 0) {
      return {
        ...base,
        affectedMonths,
        blockedReason: `يوجد (${deps.paymentAllocationsCount}) دفعة تحصيل مرتبطة بهذا الاشتراك بإجمالي ${deps.paymentAllocatedTotal} ج.م — يجب التراجع عن التحصيل أولاً`,
      };
    }

    const changes: RollbackImpactItem[] =
      deps.attendanceCount > 0
        ? [
            {
              area: 'اشتراك المجموعة',
              summary: `تحويل اشتراك "${enrollment.studentName}" في "${enrollment.groupName}" إلى (ملغي)`,
              detail: `لوجود ${deps.attendanceCount} سجل حضور مرتبط، سيتم إلغاء الاشتراك وإيقافه من تاريخ ${enrollment.startDate} للحفاظ على سجل الحضور`,
              severity: 'warning',
            },
          ]
        : [
            {
              area: 'اشتراك المجموعة',
              summary: `حذف اشتراك "${enrollment.studentName}" في "${enrollment.groupName}" نهائياً`,
              detail: 'لا توجد مدفوعات أو حضور مسجل على هذا الاشتراك — سيتم حذفه بالكامل',
              severity: 'warning',
            },
          ];

    changes.push({
      area: 'المستحقات الشهرية',
      summary: `إعادة احتساب مستحقات الشهور (${affectedMonths.join('، ')})`,
      detail: 'سيتم تحديث مديونية الطالب ونسبة المدرس/المساعد حسب الإزالة',
      severity: 'info',
    });

    return {
      ...base,
      canRollback: true,
      affectedMonths,
      affectedChanges: changes,
    };
  }

  private async previewUpdateEnrollmentRollback(
    base: AuditRollbackPreviewResult,
    enrollmentId: string,
    beforeData: unknown,
  ): Promise<AuditRollbackPreviewResult> {
    if (!beforeData || typeof beforeData !== 'object') {
      return { ...base, blockedReason: 'لا توجد بيانات سابقة لاستعادة الاشتراك' };
    }

    const existing = await this.rollbackRepo.getEnrollmentWithDetails(enrollmentId);
    if (!existing) {
      return { ...base, blockedReason: 'سجل الاشتراك غير موجود' };
    }

    const prev = beforeData as Record<string, any>;
    const targetStatus = String(prev.status ?? existing.status);

    if (
      targetStatus === EnrollmentStatus.ACTIVE &&
      existing.status !== EnrollmentStatus.ACTIVE
    ) {
      const hasDup = await this.rollbackRepo.hasOtherActiveEnrollment(
        existing.studentId,
        existing.groupId,
        enrollmentId,
      );
      if (hasDup) {
        return {
          ...base,
          blockedReason: 'يوجد اشتراك نشط آخر لنفس الطالب في نفس المجموعة حالياً',
        };
      }
    }

    const affectedMonths = Array.from(
      new Set(
        [
          existing.startDate.slice(0, 7),
          existing.endDate?.slice(0, 7),
          typeof prev.startDate === 'string' ? prev.startDate.slice(0, 7) : undefined,
          typeof prev.endDate === 'string' ? prev.endDate.slice(0, 7) : undefined,
          this.getCurrentYearMonth(),
        ].filter((m): m is string => Boolean(m)),
      ),
    );

    const closedYm = await this.isAnyMonthClosed(affectedMonths);
    if (closedYm) {
      return {
        ...base,
        affectedMonths,
        blockedReason: `الشهر المالي (${closedYm}) مغلق نهائياً`,
      };
    }

    return {
      ...base,
      canRollback: true,
      affectedMonths,
      affectedChanges: [
        {
          area: 'اشتراك الطالب',
          summary: `استعادة حالة وسعر اشتراك "${existing.studentName}" في "${existing.groupName}"`,
          detail: `الحالة: من (${existing.status}) إلى (${targetStatus}) • القيمة الشهرية: من ${parseMoney(existing.agreedMonthlyPrice)} إلى ${parseMoney(prev.agreedMonthlyPrice ?? existing.agreedMonthlyPrice)} ج.م`,
          severity: 'info',
        },
        {
          area: 'المستحقات المالية',
          summary: `إعادة احتساب الشهور (${affectedMonths.join('، ')})`,
          detail: 'سيتم تحديث مستحقات الطالب والمجموعة وفق الحالة والسعر المستعاد',
          severity: 'info',
        },
      ],
    };
  }

  private async previewStudentUpdateRollback(
    base: AuditRollbackPreviewResult,
    studentId: string,
    beforeData: unknown,
  ): Promise<AuditRollbackPreviewResult> {
    if (!beforeData || typeof beforeData !== 'object') {
      return { ...base, blockedReason: 'لا توجد بيانات سابقة مسجلة لاستعادة ملف الطالب' };
    }
    const existing = await this.rollbackRepo.getStudentById(studentId);
    if (!existing) {
      return { ...base, blockedReason: 'ملف الطالب غير موجود' };
    }
    const prev = beforeData as Record<string, any>;

    return {
      ...base,
      canRollback: true,
      affectedMonths: [],
      affectedChanges: [
        {
          area: 'بيانات الطالب',
          summary: `استعادة بيانات "${existing.fullName}" (${existing.studentCode}) إلى حالتها السابقة`,
          detail: `الاسم السابق: ${prev.fullName ?? existing.fullName} • الصف: ${prev.gradeLevel ?? existing.gradeLevel} • الحالة: ${prev.status ?? existing.status}`,
          severity: 'info',
        },
      ],
    };
  }

  private async previewAttendanceOverrideRollback(
    base: AuditRollbackPreviewResult,
    sessionId: string,
    beforeData: unknown,
  ): Promise<AuditRollbackPreviewResult> {
    if (!Array.isArray(beforeData) || beforeData.length === 0) {
      return { ...base, blockedReason: 'لا توجد سجلات حضور سابقة للتراجع عنها' };
    }
    const session = await this.rollbackRepo.getSessionById(sessionId);
    if (!session) {
      return { ...base, blockedReason: 'الحصة المرتبطة غير موجودة' };
    }

    const closedYm = await this.isAnyMonthClosed([session.yearMonth]);
    if (closedYm) {
      return {
        ...base,
        affectedMonths: [session.yearMonth],
        blockedReason: `الشهر المالي (${closedYm}) مغلق نهائياً — لا يمكن تعديل حضوره`,
      };
    }

    return {
      ...base,
      canRollback: true,
      affectedMonths: [session.yearMonth],
      affectedChanges: [
        {
          area: 'كشف الحضور',
          summary: `إعادة حالات حضور ${beforeData.length} طالب في حصة (${session.groupName})`,
          detail: `تاريخ الحصة: ${session.sessionDate} — سيتم استرجاع الحالة والملاحظات السابقة وإعادة احتساب الشهر`,
          severity: 'warning',
        },
      ],
    };
  }

  private async previewCompleteGroupSessionRollback(
    base: AuditRollbackPreviewResult,
    sessionId: string,
  ): Promise<AuditRollbackPreviewResult> {
    const session = await this.rollbackRepo.getSessionById(sessionId);
    if (!session) {
      return { ...base, blockedReason: 'الحصة المرتبطة غير موجودة' };
    }

    if (session.status !== SessionStatus.COMPLETED) {
      return {
        ...base,
        blockedReason: 'الحصة ليست في حالة مكتملة حالياً (ربما تم تعديلها مسبقاً)',
      };
    }

    const closedYm = await this.isAnyMonthClosed([session.yearMonth]);
    if (closedYm) {
      return {
        ...base,
        affectedMonths: [session.yearMonth],
        blockedReason: `الشهر المالي (${closedYm}) مغلق نهائياً — لا يمكن التراجع عن تحضير المجموعة فيه`,
      };
    }

    const attendanceCount = await this.rollbackRepo.countSessionAttendanceRows(sessionId);
    if (attendanceCount > 0) {
      return {
        ...base,
        affectedMonths: [session.yearMonth],
        blockedReason: `لا يمكن التراجع عن تحضير المجموعة لأن الحصة تحتوي على (${attendanceCount}) سجل حضور فردي للطلاب — يجب مراجعة كشف الطلاب أولاً`,
      };
    }

    return {
      ...base,
      canRollback: true,
      affectedMonths: [session.yearMonth],
      affectedChanges: [
        {
          area: 'حصة الاشتراك (المجموعة)',
          summary: `إعادة حصة مجموعة (${session.groupName}) بتاريخ ${session.sessionDate} من "مكتملة" إلى "مجدولة"`,
          detail: 'سينقص عدّاد حصص المجموعة المنفذة في الاشتراك بمقدار حصة واحدة دون المساس بسجلات حضور الطلاب الفردية',
          severity: 'warning',
        },
        {
          area: 'المتابعة والتقارير الشهرية',
          summary: `إعادة احتساب شهر ${session.yearMonth}`,
          detail: 'تحديث متابعة الحصص في لوحة التحكم وتقارير المدرس/المساعد وفق حالة الحصة المستعادة',
          severity: 'info',
        },
      ],
    };
  }

  async executeRollback(
    auditLogId: string,
    reason: string | undefined,
    actor: AuthenticatedUser,
  ): Promise<AuditRollbackExecuteResult> {
    const preview = await this.previewRollback(auditLogId, actor);
    if (!preview.canRollback) {
      throw new ConflictException(
        preview.blockedReason || 'لا يمكن التراجع عن هذه العملية في الوقت الحالي',
      );
    }

    const log = await this.rollbackRepo.findAuditLogById(auditLogId);
    if (!log || !log.entityId) {
      throw new NotFoundException('سجل العملية غير موجود');
    }

    const currentYearMonth = this.getCurrentYearMonth();
    let txResult: { beforeData: unknown; afterData: unknown; affectedMonths: string[] };

    switch (log.action as ReversibleAuditAction) {
      case 'FINANCE_COLLECT_PAYMENT':
        txResult = await this.rollbackRepo.rollbackPaymentTx(log.entityId, auditLogId);
        break;
      case 'FINANCE_TEACHER_PAYOUT':
        txResult = await this.rollbackRepo.rollbackTeacherPayoutTx(log.entityId, auditLogId);
        break;
      case 'FINANCE_ASSISTANT_PAYOUT':
        txResult = await this.rollbackRepo.rollbackAssistantPayoutTx(log.entityId, auditLogId);
        break;
      case 'FINANCE_EXPENSE_CREATE':
        txResult = await this.rollbackRepo.rollbackExpenseCreateTx(log.entityId, auditLogId);
        break;
      case 'FINANCE_EXPENSE_UPDATE':
        txResult = await this.rollbackRepo.rollbackExpenseUpdateTx(
          log.entityId,
          (log.beforeData as Record<string, any>) ?? {},
          auditLogId,
        );
        break;
      case 'FINANCE_EXPENSE_DELETE':
        txResult = await this.rollbackRepo.rollbackExpenseDeleteTx(
          log.entityId,
          (log.beforeData as Record<string, any>) ?? {},
          auditLogId,
        );
        break;
      case 'CREATE_ENROLLMENT':
        txResult = await this.rollbackRepo.rollbackCreateEnrollmentTx(
          log.entityId,
          currentYearMonth,
          auditLogId,
        );
        break;
      case 'UPDATE_ENROLLMENT':
        txResult = await this.rollbackRepo.rollbackUpdateEnrollmentTx(
          log.entityId,
          (log.beforeData as Record<string, any>) ?? {},
          currentYearMonth,
          auditLogId,
        );
        break;
      case 'UPDATE_STUDENT':
      case 'ARCHIVE_STUDENT':
        txResult = await this.rollbackRepo.rollbackStudentUpdateTx(
          log.entityId,
          (log.beforeData as Record<string, any>) ?? {},
          auditLogId,
        );
        break;
      case 'OVERRIDE_ATTENDANCE':
        txResult = await this.rollbackRepo.rollbackAttendanceOverrideTx(
          log.entityId,
          (log.beforeData as Array<{ studentId: string; status: string; notes?: string | null }>) ??
            [],
          actor.id,
          auditLogId,
        );
        break;
      case 'COMPLETE_GROUP_SESSION':
        txResult = await this.rollbackRepo.rollbackCompleteGroupSessionTx(log.entityId, auditLogId);
        break;
      default:
        throw new BadRequestException('نوع العملية غير مدعوم للتراجع');
    }

    const monthsToRecalc = Array.from(new Set(txResult.affectedMonths));
    if (this.settlementService?.recalculateMonth) {
      for (const ym of monthsToRecalc) {
        await this.settlementService.recalculateMonth(ym);
      }
    }

    try {
      await Promise.all([
        this.cache?.invalidatePrefix('dashboard:summary:'),
        this.cache?.invalidatePrefix('reports:'),
        ...(log.action === 'CREATE_ENROLLMENT' ||
        log.action === 'UPDATE_ENROLLMENT' ||
        log.action === 'UPDATE_STUDENT' ||
        log.action === 'ARCHIVE_STUDENT'
          ? [this.cache?.invalidateRosterViews?.()]
          : []),
      ]);
    } catch {}

    const cleanReason = reason?.trim() || null;

    await this.auditLogsService.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'AUDIT_ROLLBACK',
      entityType: log.entityType,
      entityId: log.entityId,
      beforeData: txResult.beforeData,
      afterData: txResult.afterData,
      metadata: {
        revertedAuditLogId: log.id,
        revertedAction: log.action,
        revertedActionAr: preview.actionAr,
        reason: cleanReason,
        affectedMonths: monthsToRecalc,
        affectedChanges: preview.affectedChanges,
      },
    });

    return {
      success: true,
      revertedAuditLogId: log.id,
      affectedMonths: monthsToRecalc,
      affectedChanges: preview.affectedChanges,
      message: `تم التراجع بنجاح عن (${preview.actionAr}) وتسجيل التعديل في سجل العمليات`,
    };
  }
}
