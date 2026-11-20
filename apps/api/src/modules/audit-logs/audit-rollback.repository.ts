import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EnrollmentStatus, SessionStatus } from '@edu-center/shared';
import { and, desc, eq, gte, ilike, lte, ne, or, sql } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  assistantMonthlyRecords,
  assistantPayouts,
  assistants,
  attendance,
  auditLogs,
  enrollments,
  expenses,
  groups,
  paymentAllocations,
  payments,
  sessions,
  studentMonthlyRecords,
  students,
  teacherMonthlyRecords,
  teacherPayouts,
  teachers,
  users,
} from '../../database/schemas';
import {
  FinanceTransaction,
  lockFinanceMonths,
} from '../finance/repositories/finance-month-lock.util';
import { parseMoney, roundMoney, toMoneyString } from '../finance/utils/money.util';

export interface RevertedAuditMeta {
  rollbackAuditLogId: string;
  revertedAt: Date;
  revertedByName: string;
}

@Injectable()
export class AuditRollbackRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async findAuditLogById(id: string) {
    const [row] = await this.db
      .select({
        id: auditLogs.id,
        actorUserId: auditLogs.actorUserId,
        actorName: sql<string>`COALESCE(NULLIF(TRIM(${auditLogs.actorName}), ''), ${users.fullName}, 'النظام')`,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        beforeData: auditLogs.beforeData,
        afterData: auditLogs.afterData,
        metadata: auditLogs.metadata,
        ipAddress: auditLogs.ipAddress,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(eq(auditLogs.id, id))
      .limit(1);
    return row ?? null;
  }

  async findExistingRollbackForLog(
    auditLogId: string,
    executor: DrizzleDatabase | FinanceTransaction = this.db,
  ): Promise<RevertedAuditMeta | null> {
    const [row] = await executor
      .select({
        rollbackAuditLogId: auditLogs.id,
        revertedAt: auditLogs.createdAt,
        revertedByName: sql<string>`COALESCE(NULLIF(TRIM(${auditLogs.actorName}), ''), ${users.fullName}, 'النظام')`,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .where(
        and(
          eq(auditLogs.action, 'AUDIT_ROLLBACK'),
          sql`${auditLogs.metadata}->>'revertedAuditLogId' = ${auditLogId}`,
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);
    return row ?? null;
  }

  async findLaterEntityLogs(
    entityType: string,
    entityId: string,
    afterDate: Date,
    excludeLogId: string,
  ) {
    return this.db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(
        and(
          ilike(auditLogs.entityType, entityType),
          eq(auditLogs.entityId, entityId),
          ne(auditLogs.id, excludeLogId),
          ne(auditLogs.action, 'AUDIT_ROLLBACK'),
          sql`${auditLogs.createdAt} > ${afterDate}`,
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(5);
  }

  async getPaymentWithDetails(paymentId: string) {
    const [payment] = await this.db
      .select({
        id: payments.id,
        receiptNumber: payments.receiptNumber,
        studentId: payments.studentId,
        studentName: students.fullName,
        studentCode: students.studentCode,
        yearMonth: payments.yearMonth,
        amount: payments.amount,
        paymentDate: payments.paymentDate,
        paymentMethod: payments.paymentMethod,
        notes: payments.notes,
      })
      .from(payments)
      .innerJoin(students, eq(students.id, payments.studentId))
      .where(eq(payments.id, paymentId))
      .limit(1);

    if (!payment) return null;

    const allocs = await this.db
      .select({
        id: paymentAllocations.id,
        groupId: paymentAllocations.groupId,
        groupName: groups.name,
        studentMonthlyRecordId: paymentAllocations.studentMonthlyRecordId,
        allocatedAmount: paymentAllocations.allocatedAmount,
      })
      .from(paymentAllocations)
      .leftJoin(groups, eq(groups.id, paymentAllocations.groupId))
      .where(eq(paymentAllocations.paymentId, paymentId));

    const monthlyRows = await this.db
      .select()
      .from(studentMonthlyRecords)
      .where(
        and(
          eq(studentMonthlyRecords.studentId, payment.studentId),
          eq(studentMonthlyRecords.yearMonth, payment.yearMonth),
        ),
      );

    return {
      ...payment,
      amountNum: parseMoney(payment.amount),
      allocations: allocs.map((a) => ({
        ...a,
        allocatedNum: parseMoney(a.allocatedAmount),
      })),
      monthlyRows,
    };
  }

  async getTeacherPayoutWithDetails(payoutId: string) {
    const [payout] = await this.db
      .select({
        id: teacherPayouts.id,
        referenceNumber: teacherPayouts.referenceNumber,
        teacherId: teacherPayouts.teacherId,
        teacherName: teachers.fullName,
        teacherCode: teachers.teacherCode,
        yearMonth: teacherPayouts.yearMonth,
        amount: teacherPayouts.amount,
        payoutDate: teacherPayouts.payoutDate,
        paymentMethod: teacherPayouts.paymentMethod,
      })
      .from(teacherPayouts)
      .innerJoin(teachers, eq(teachers.id, teacherPayouts.teacherId))
      .where(eq(teacherPayouts.id, payoutId))
      .limit(1);

    if (!payout) return null;

    const [monthly] = await this.db
      .select()
      .from(teacherMonthlyRecords)
      .where(
        and(
          eq(teacherMonthlyRecords.teacherId, payout.teacherId),
          eq(teacherMonthlyRecords.yearMonth, payout.yearMonth),
        ),
      )
      .limit(1);

    return {
      ...payout,
      amountNum: parseMoney(payout.amount),
      monthly: monthly ?? null,
    };
  }

  async getAssistantPayoutWithDetails(payoutId: string) {
    const [payout] = await this.db
      .select({
        id: assistantPayouts.id,
        referenceNumber: assistantPayouts.referenceNumber,
        assistantId: assistantPayouts.assistantId,
        assistantName: assistants.fullName,
        assistantCode: assistants.assistantCode,
        yearMonth: assistantPayouts.yearMonth,
        amount: assistantPayouts.amount,
        payoutDate: assistantPayouts.payoutDate,
        paymentMethod: assistantPayouts.paymentMethod,
      })
      .from(assistantPayouts)
      .innerJoin(assistants, eq(assistants.id, assistantPayouts.assistantId))
      .where(eq(assistantPayouts.id, payoutId))
      .limit(1);

    if (!payout) return null;

    const [monthly] = await this.db
      .select()
      .from(assistantMonthlyRecords)
      .where(
        and(
          eq(assistantMonthlyRecords.assistantId, payout.assistantId),
          eq(assistantMonthlyRecords.yearMonth, payout.yearMonth),
        ),
      )
      .limit(1);

    return {
      ...payout,
      amountNum: parseMoney(payout.amount),
      monthly: monthly ?? null,
    };
  }

  async getExpenseById(expenseId: string) {
    const [row] = await this.db
      .select()
      .from(expenses)
      .where(eq(expenses.id, expenseId))
      .limit(1);
    return row ?? null;
  }

  async getEnrollmentWithDetails(enrollmentId: string) {
    const [row] = await this.db
      .select({
        id: enrollments.id,
        studentId: enrollments.studentId,
        studentName: students.fullName,
        studentCode: students.studentCode,
        groupId: enrollments.groupId,
        groupName: groups.name,
        groupCode: groups.groupCode,
        startDate: enrollments.startDate,
        endDate: enrollments.endDate,
        agreedMonthlyPrice: enrollments.agreedMonthlyPrice,
        agreedSessionsCount: enrollments.agreedSessionsCount,
        agreedSessionPrice: enrollments.agreedSessionPrice,
        status: enrollments.status,
        notes: enrollments.notes,
      })
      .from(enrollments)
      .innerJoin(students, eq(students.id, enrollments.studentId))
      .innerJoin(groups, eq(groups.id, enrollments.groupId))
      .where(eq(enrollments.id, enrollmentId))
      .limit(1);
    return row ?? null;
  }

  async countEnrollmentDependencies(
    studentId: string,
    groupId: string,
    startDate: string,
    endDate: string | null,
  ) {
    const startYm = startDate.slice(0, 7);
    const [payRows, attRows] = await Promise.all([
      this.db
        .select({
          allocatedAmount: paymentAllocations.allocatedAmount,
        })
        .from(paymentAllocations)
        .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
        .where(
          and(
            eq(payments.studentId, studentId),
            eq(paymentAllocations.groupId, groupId),
            gte(paymentAllocations.yearMonth, startYm),
          ),
        ),
      this.db
        .select({ id: attendance.id })
        .from(attendance)
        .innerJoin(sessions, eq(sessions.id, attendance.sessionId))
        .where(
          and(
            eq(attendance.studentId, studentId),
            eq(sessions.groupId, groupId),
            gte(sessions.sessionDate, startDate),
            endDate ? lte(sessions.sessionDate, endDate) : sql`1=1`,
          ),
        ),
    ]);

    const paymentAllocatedTotal = roundMoney(
      payRows.reduce((sum, r) => sum + parseMoney(r.allocatedAmount), 0),
    );

    return {
      paymentAllocationsCount: payRows.length,
      paymentAllocatedTotal,
      attendanceCount: attRows.length,
    };
  }

  async hasOtherActiveEnrollment(
    studentId: string,
    groupId: string,
    excludeEnrollmentId: string,
  ): Promise<boolean> {
    const [row] = await this.db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.groupId, groupId),
          eq(enrollments.status, EnrollmentStatus.ACTIVE),
          ne(enrollments.id, excludeEnrollmentId),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async getStudentById(studentId: string) {
    const [row] = await this.db
      .select()
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);
    return row ?? null;
  }

  async getSessionById(sessionId: string) {
    const [row] = await this.db
      .select({
        id: sessions.id,
        groupId: sessions.groupId,
        groupName: groups.name,
        sessionDate: sessions.sessionDate,
        yearMonth: sessions.yearMonth,
        status: sessions.status,
      })
      .from(sessions)
      .innerJoin(groups, eq(groups.id, sessions.groupId))
      .where(eq(sessions.id, sessionId))
      .limit(1);
    return row ?? null;
  }

  private async assertNotRevertedTx(tx: FinanceTransaction, auditLogId: string) {
    const dup = await this.findExistingRollbackForLog(auditLogId, tx);
    if (dup) {
      throw new ConflictException('تم التراجع عن هذه العملية مسبقاً ولا يمكن تكرار التراجع');
    }
  }

  async rollbackPaymentTx(paymentId: string, auditLogId: string) {
    const now = new Date();
    return this.db.transaction(async (tx) => {
      await this.assertNotRevertedTx(tx, auditLogId);

      const [payment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.id, paymentId))
        .limit(1);
      if (!payment) {
        throw new NotFoundException('إيصال الدفع غير موجود أو تم حذفه مسبقاً');
      }

      await lockFinanceMonths(tx, [payment.yearMonth]);

      const allocs = await tx
        .select()
        .from(paymentAllocations)
        .where(eq(paymentAllocations.paymentId, paymentId));

      const monthlyRows = await tx
        .select()
        .from(studentMonthlyRecords)
        .where(
          and(
            eq(studentMonthlyRecords.studentId, payment.studentId),
            eq(studentMonthlyRecords.yearMonth, payment.yearMonth),
          ),
        )
        .for('update');

      if (monthlyRows.some((r) => r.isClosed)) {
        throw new ConflictException(
          `الشهر المالي (${payment.yearMonth}) مغلق نهائياً ولا يمكن التراجع عن التحصيل فيه`,
        );
      }

      const recordByGroup = new Map(monthlyRows.map((r) => [r.groupId, r]));
      const allocByRecordId = new Map(monthlyRows.map((r) => [r.id, r]));

      for (const alloc of allocs) {
        const rec =
          (alloc.studentMonthlyRecordId ? allocByRecordId.get(alloc.studentMonthlyRecordId) : undefined) ??
          recordByGroup.get(alloc.groupId);
        if (!rec) continue;

        const newTotalPaid = roundMoney(
          Math.max(0, parseMoney(rec.totalPaid) - parseMoney(alloc.allocatedAmount)),
        );
        const newRemaining = roundMoney(Math.max(0, parseMoney(rec.totalDue) - newTotalPaid));
        rec.totalPaid = toMoneyString(newTotalPaid);
        rec.remainingBalance = toMoneyString(newRemaining);

        await tx
          .update(studentMonthlyRecords)
          .set({
            totalPaid: toMoneyString(newTotalPaid),
            remainingBalance: toMoneyString(newRemaining),
            updatedAt: now,
          })
          .where(eq(studentMonthlyRecords.id, rec.id));
      }

      await tx.delete(payments).where(eq(payments.id, paymentId));

      return {
        beforeData: { ...payment, allocations: allocs },
        afterData: { deletedPaymentId: payment.id, receiptNumber: payment.receiptNumber },
        affectedMonths: [payment.yearMonth],
      };
    });
  }

  async rollbackTeacherPayoutTx(payoutId: string, auditLogId: string) {
    const now = new Date();
    return this.db.transaction(async (tx) => {
      await this.assertNotRevertedTx(tx, auditLogId);

      const [payout] = await tx
        .select()
        .from(teacherPayouts)
        .where(eq(teacherPayouts.id, payoutId))
        .limit(1);
      if (!payout) {
        throw new NotFoundException('سجل صرف المدرس غير موجود أو تم حذفه مسبقاً');
      }

      await lockFinanceMonths(tx, [payout.yearMonth]);

      const [monthly] = await tx
        .select()
        .from(teacherMonthlyRecords)
        .where(
          and(
            eq(teacherMonthlyRecords.teacherId, payout.teacherId),
            eq(teacherMonthlyRecords.yearMonth, payout.yearMonth),
          ),
        )
        .for('update');

      if (monthly?.isClosed) {
        throw new ConflictException(
          `الشهر المالي (${payout.yearMonth}) مغلق نهائياً ولا يمكن التراجع عن الصرف فيه`,
        );
      }

      if (monthly) {
        const newPaidOut = roundMoney(
          Math.max(0, parseMoney(monthly.totalPaidOut) - parseMoney(payout.amount)),
        );
        const newRemaining = roundMoney(
          Math.max(0, parseMoney(monthly.totalDues) - newPaidOut),
        );
        await tx
          .update(teacherMonthlyRecords)
          .set({
            totalPaidOut: toMoneyString(newPaidOut),
            remainingBalance: toMoneyString(newRemaining),
            updatedAt: now,
          })
          .where(eq(teacherMonthlyRecords.id, monthly.id));
      }

      await tx.delete(teacherPayouts).where(eq(teacherPayouts.id, payoutId));

      return {
        beforeData: payout,
        afterData: { deletedTeacherPayoutId: payout.id, referenceNumber: payout.referenceNumber },
        affectedMonths: [payout.yearMonth],
      };
    });
  }

  async rollbackAssistantPayoutTx(payoutId: string, auditLogId: string) {
    const now = new Date();
    return this.db.transaction(async (tx) => {
      await this.assertNotRevertedTx(tx, auditLogId);

      const [payout] = await tx
        .select()
        .from(assistantPayouts)
        .where(eq(assistantPayouts.id, payoutId))
        .limit(1);
      if (!payout) {
        throw new NotFoundException('سجل صرف المساعد غير موجود أو تم حذفه مسبقاً');
      }

      await lockFinanceMonths(tx, [payout.yearMonth]);

      const [monthly] = await tx
        .select()
        .from(assistantMonthlyRecords)
        .where(
          and(
            eq(assistantMonthlyRecords.assistantId, payout.assistantId),
            eq(assistantMonthlyRecords.yearMonth, payout.yearMonth),
          ),
        )
        .for('update');

      if (monthly?.isClosed) {
        throw new ConflictException(
          `الشهر المالي (${payout.yearMonth}) مغلق نهائياً ولا يمكن التراجع عن الصرف فيه`,
        );
      }

      if (monthly) {
        const newPaidOut = roundMoney(
          Math.max(0, parseMoney(monthly.totalPaidOut) - parseMoney(payout.amount)),
        );
        const newRemaining = roundMoney(
          Math.max(0, parseMoney(monthly.totalDues) - newPaidOut),
        );
        await tx
          .update(assistantMonthlyRecords)
          .set({
            totalPaidOut: toMoneyString(newPaidOut),
            remainingBalance: toMoneyString(newRemaining),
            updatedAt: now,
          })
          .where(eq(assistantMonthlyRecords.id, monthly.id));
      }

      await tx.delete(assistantPayouts).where(eq(assistantPayouts.id, payoutId));

      return {
        beforeData: payout,
        afterData: { deletedAssistantPayoutId: payout.id, referenceNumber: payout.referenceNumber },
        affectedMonths: [payout.yearMonth],
      };
    });
  }

  async rollbackExpenseCreateTx(expenseId: string, auditLogId: string) {
    return this.db.transaction(async (tx) => {
      await this.assertNotRevertedTx(tx, auditLogId);

      const [existing] = await tx
        .select()
        .from(expenses)
        .where(eq(expenses.id, expenseId))
        .limit(1);
      if (!existing) {
        throw new NotFoundException('سجل المصروف غير موجود أو تم حذفه مسبقاً');
      }

      await lockFinanceMonths(tx, [existing.yearMonth]);
      await tx.delete(expenses).where(eq(expenses.id, expenseId));

      return {
        beforeData: existing,
        afterData: { deletedExpenseId: existing.id, title: existing.title },
        affectedMonths: [existing.yearMonth],
      };
    });
  }

  async rollbackExpenseUpdateTx(
    expenseId: string,
    beforeData: Record<string, any>,
    auditLogId: string,
  ) {
    return this.db.transaction(async (tx) => {
      await this.assertNotRevertedTx(tx, auditLogId);

      const [existing] = await tx
        .select()
        .from(expenses)
        .where(eq(expenses.id, expenseId))
        .limit(1);
      if (!existing) {
        throw new NotFoundException('سجل المصروف غير موجود');
      }

      const targetYm = String(beforeData.yearMonth || existing.yearMonth);
      const months = Array.from(new Set([existing.yearMonth, targetYm]));
      await lockFinanceMonths(tx, months);

      const patch = {
        category: String(beforeData.category ?? existing.category),
        title: String(beforeData.title ?? existing.title),
        amount: toMoneyString(roundMoney(Number(beforeData.amount ?? existing.amount))),
        expenseDate: String(beforeData.expenseDate ?? existing.expenseDate),
        yearMonth: targetYm,
        paymentMethod: String(beforeData.paymentMethod ?? existing.paymentMethod),
        notes: beforeData.notes !== undefined ? (beforeData.notes ?? null) : existing.notes,
      };

      const [updated] = await tx
        .update(expenses)
        .set(patch)
        .where(eq(expenses.id, expenseId))
        .returning();

      return {
        beforeData: existing,
        afterData: updated,
        affectedMonths: months,
      };
    });
  }

  async rollbackExpenseDeleteTx(
    expenseId: string,
    beforeData: Record<string, any>,
    auditLogId: string,
  ) {
    return this.db.transaction(async (tx) => {
      await this.assertNotRevertedTx(tx, auditLogId);

      const [existing] = await tx
        .select({ id: expenses.id })
        .from(expenses)
        .where(eq(expenses.id, expenseId))
        .limit(1);
      if (existing) {
        throw new ConflictException('سجل المصروف موجود بالفعل ولا يحتاج استعادة');
      }

      const yearMonth = String(beforeData.yearMonth || '');
      if (!yearMonth) {
        throw new BadRequestException('بيانات الشهر المالي للمصروف غير مكتملة');
      }
      await lockFinanceMonths(tx, [yearMonth]);

      const [restored] = await tx
        .insert(expenses)
        .values({
          id: expenseId,
          category: String(beforeData.category ?? 'OTHER'),
          title: String(beforeData.title ?? 'مصروف مستعاد'),
          amount: toMoneyString(roundMoney(Number(beforeData.amount ?? 0))),
          expenseDate: String(beforeData.expenseDate ?? `${yearMonth}-01`),
          yearMonth,
          paymentMethod: String(beforeData.paymentMethod ?? 'CASH'),
          recordedByUserId: beforeData.recordedByUserId ?? null,
          notes: beforeData.notes ?? null,
        })
        .returning();

      return {
        beforeData: { deletedExpenseId: expenseId },
        afterData: restored,
        affectedMonths: [yearMonth],
      };
    });
  }

  async rollbackCreateEnrollmentTx(
    enrollmentId: string,
    currentYearMonth: string,
    auditLogId: string,
  ) {
    const now = new Date();
    return this.db.transaction(async (tx) => {
      await this.assertNotRevertedTx(tx, auditLogId);

      const [existing] = await tx
        .select()
        .from(enrollments)
        .where(eq(enrollments.id, enrollmentId))
        .limit(1);
      if (!existing) {
        throw new NotFoundException('سجل الاشتراك غير موجود أو تم حذفه مسبقاً');
      }

      const startYm = existing.startDate.slice(0, 7);
      const affectedMonths = Array.from(
        new Set(
          [startYm, existing.endDate?.slice(0, 7), currentYearMonth].filter(
            (m): m is string => Boolean(m),
          ),
        ),
      );
      await lockFinanceMonths(tx, affectedMonths);

      const [linkedPayment] = await tx
        .select({ id: paymentAllocations.id })
        .from(paymentAllocations)
        .innerJoin(payments, eq(payments.id, paymentAllocations.paymentId))
        .where(
          and(
            eq(payments.studentId, existing.studentId),
            eq(paymentAllocations.groupId, existing.groupId),
            gte(paymentAllocations.yearMonth, startYm),
          ),
        )
        .limit(1);
      if (linkedPayment) {
        throw new ConflictException(
          'يوجد مدفوعات مسجلة مرتبطة بهذا الاشتراك — يرجى التراجع عن عملية التحصيل أولاً',
        );
      }

      const [closedMonthly] = await tx
        .select({ id: studentMonthlyRecords.id, yearMonth: studentMonthlyRecords.yearMonth })
        .from(studentMonthlyRecords)
        .where(
          and(
            eq(studentMonthlyRecords.studentId, existing.studentId),
            eq(studentMonthlyRecords.groupId, existing.groupId),
            gte(studentMonthlyRecords.yearMonth, startYm),
            eq(studentMonthlyRecords.isClosed, true),
          ),
        )
        .limit(1);
      if (closedMonthly) {
        throw new ConflictException(
          `الشهر المالي (${closedMonthly.yearMonth}) مغلق نهائياً ولا يمكن إلغاء الاشتراك فيه`,
        );
      }

      const [attRow] = await tx
        .select({ id: attendance.id })
        .from(attendance)
        .innerJoin(sessions, eq(sessions.id, attendance.sessionId))
        .where(
          and(
            eq(attendance.studentId, existing.studentId),
            eq(sessions.groupId, existing.groupId),
            gte(sessions.sessionDate, existing.startDate),
          ),
        )
        .limit(1);

      let afterData: unknown;
      if (attRow) {
        const [cancelled] = await tx
          .update(enrollments)
          .set({
            status: EnrollmentStatus.CANCELLED,
            endDate: existing.startDate,
            updatedAt: now,
          })
          .where(eq(enrollments.id, enrollmentId))
          .returning();
        afterData = cancelled;
      } else {
        await tx
          .delete(studentMonthlyRecords)
          .where(
            and(
              eq(studentMonthlyRecords.studentId, existing.studentId),
              eq(studentMonthlyRecords.groupId, existing.groupId),
              gte(studentMonthlyRecords.yearMonth, startYm),
              eq(studentMonthlyRecords.isClosed, false),
              sql`CAST(${studentMonthlyRecords.totalPaid} AS numeric) = 0`,
            ),
          );
        await tx.delete(enrollments).where(eq(enrollments.id, enrollmentId));
        afterData = { deletedEnrollmentId: enrollmentId };
      }

      return {
        beforeData: existing,
        afterData,
        affectedMonths,
      };
    });
  }

  async rollbackUpdateEnrollmentTx(
    enrollmentId: string,
    beforeData: Record<string, any>,
    currentYearMonth: string,
    auditLogId: string,
  ) {
    const now = new Date();
    return this.db.transaction(async (tx) => {
      await this.assertNotRevertedTx(tx, auditLogId);

      const [existing] = await tx
        .select()
        .from(enrollments)
        .where(eq(enrollments.id, enrollmentId))
        .limit(1);
      if (!existing) {
        throw new NotFoundException('سجل الاشتراك غير موجود');
      }

      const targetStatus = String(beforeData.status ?? existing.status);
      if (
        targetStatus === EnrollmentStatus.ACTIVE &&
        existing.status !== EnrollmentStatus.ACTIVE
      ) {
        const [dup] = await tx
          .select({ id: enrollments.id })
          .from(enrollments)
          .where(
            and(
              eq(enrollments.studentId, existing.studentId),
              eq(enrollments.groupId, existing.groupId),
              eq(enrollments.status, EnrollmentStatus.ACTIVE),
              ne(enrollments.id, enrollmentId),
            ),
          )
          .limit(1);
        if (dup) {
          throw new ConflictException(
            'يوجد اشتراك نشط آخر لنفس الطالب في هذه المجموعة حالياً',
          );
        }
      }

      const affectedMonths = Array.from(
        new Set(
          [
            existing.startDate.slice(0, 7),
            existing.endDate?.slice(0, 7),
            typeof beforeData.startDate === 'string' ? beforeData.startDate.slice(0, 7) : undefined,
            typeof beforeData.endDate === 'string' ? beforeData.endDate.slice(0, 7) : undefined,
            currentYearMonth,
          ].filter((m): m is string => Boolean(m)),
        ),
      );
      await lockFinanceMonths(tx, affectedMonths);

      const [restored] = await tx
        .update(enrollments)
        .set({
          status: targetStatus,
          startDate: String(beforeData.startDate ?? existing.startDate),
          endDate:
            beforeData.endDate !== undefined ? (beforeData.endDate ?? null) : existing.endDate,
          agreedMonthlyPrice:
            beforeData.agreedMonthlyPrice !== undefined
              ? toMoneyString(roundMoney(Number(beforeData.agreedMonthlyPrice)))
              : existing.agreedMonthlyPrice,
          agreedSessionsCount:
            typeof beforeData.agreedSessionsCount === 'number'
              ? beforeData.agreedSessionsCount
              : existing.agreedSessionsCount,
          agreedSessionPrice:
            beforeData.agreedSessionPrice !== undefined
              ? toMoneyString(roundMoney(Number(beforeData.agreedSessionPrice)))
              : existing.agreedSessionPrice,
          notes: beforeData.notes !== undefined ? (beforeData.notes ?? null) : existing.notes,
          updatedAt: now,
        })
        .where(eq(enrollments.id, enrollmentId))
        .returning();

      return {
        beforeData: existing,
        afterData: restored,
        affectedMonths,
      };
    });
  }

  async rollbackStudentUpdateTx(
    studentId: string,
    beforeData: Record<string, any>,
    auditLogId: string,
  ) {
    const now = new Date();
    return this.db.transaction(async (tx) => {
      await this.assertNotRevertedTx(tx, auditLogId);

      const [existing] = await tx
        .select()
        .from(students)
        .where(eq(students.id, studentId))
        .limit(1);
      if (!existing) {
        throw new NotFoundException('ملف الطالب غير موجود');
      }

      const [restored] = await tx
        .update(students)
        .set({
          fullName: String(beforeData.fullName ?? existing.fullName),
          phone: beforeData.phone !== undefined ? (beforeData.phone ?? null) : existing.phone,
          guardianPhone:
            beforeData.guardianPhone !== undefined
              ? (beforeData.guardianPhone ?? null)
              : existing.guardianPhone,
          gradeLevel: String(beforeData.gradeLevel ?? existing.gradeLevel),
          registrationDate: String(beforeData.registrationDate ?? existing.registrationDate),
          status: String(beforeData.status ?? existing.status),
          notes: beforeData.notes !== undefined ? (beforeData.notes ?? null) : existing.notes,
          updatedAt: now,
        })
        .where(eq(students.id, studentId))
        .returning();

      return {
        beforeData: existing,
        afterData: restored,
        affectedMonths: [] as string[],
      };
    });
  }

  async rollbackAttendanceOverrideTx(
    sessionId: string,
    beforeItems: Array<{ studentId: string; status: string; notes?: string | null }>,
    actorUserId: string,
    auditLogId: string,
  ) {
    const now = new Date();
    return this.db.transaction(async (tx) => {
      await this.assertNotRevertedTx(tx, auditLogId);

      const [session] = await tx
        .select()
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .limit(1);
      if (!session) {
        throw new NotFoundException('الحصة المطلوبة غير موجودة');
      }

      await lockFinanceMonths(tx, [session.yearMonth]);

      const currentRows = await tx
        .select()
        .from(attendance)
        .where(eq(attendance.sessionId, sessionId));
      const currentMap = new Map(currentRows.map((r) => [r.studentId, r]));

      const beforeRestoreSnapshot: Array<{
        studentId: string;
        status: string;
        notes: string | null;
      }> = [];

      for (const item of beforeItems) {
        const cur = currentMap.get(item.studentId);
        if (cur) {
          beforeRestoreSnapshot.push({
            studentId: cur.studentId,
            status: cur.status,
            notes: cur.notes ?? null,
          });
        }
        await tx
          .update(attendance)
          .set({
            status: item.status,
            notes: item.notes ?? null,
            updatedByUserId: actorUserId,
            updatedAt: now,
          })
          .where(
            and(
              eq(attendance.sessionId, sessionId),
              eq(attendance.studentId, item.studentId),
            ),
          );
      }

      return {
        beforeData: beforeRestoreSnapshot,
        afterData: beforeItems,
        affectedMonths: [session.yearMonth],
      };
    });
  }

  async countSessionAttendanceRows(sessionId: string): Promise<number> {
    const [{ total }] = await this.db
      .select({ total: sql<number>`COUNT(*)::int` })
      .from(attendance)
      .where(eq(attendance.sessionId, sessionId));
    return Number(total ?? 0);
  }

  async rollbackCompleteGroupSessionTx(sessionId: string, auditLogId: string) {
    const now = new Date();
    return this.db.transaction(async (tx) => {
      await this.assertNotRevertedTx(tx, auditLogId);

      const [session] = await tx
        .select()
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .for('update')
        .limit(1);
      if (!session) {
        throw new NotFoundException('الحصة المطلوبة غير موجودة');
      }

      await lockFinanceMonths(tx, [session.yearMonth]);

      if (session.status !== SessionStatus.COMPLETED) {
        throw new ConflictException('الحصة ليست في حالة مكتملة حالياً');
      }

      const [{ attendanceCount }] = await tx
        .select({ attendanceCount: sql<number>`COUNT(*)::int` })
        .from(attendance)
        .where(eq(attendance.sessionId, sessionId));

      if (Number(attendanceCount ?? 0) > 0) {
        throw new ConflictException(
          'لا يمكن التراجع عن تحضير المجموعة لأن الحصة تحتوي على سجل حضور فردي للطلاب — يجب مراجعة كشف الطلاب أولاً',
        );
      }

      const [restored] = await tx
        .update(sessions)
        .set({
          status: SessionStatus.SCHEDULED,
          updatedAt: now,
        })
        .where(eq(sessions.id, sessionId))
        .returning();

      return {
        beforeData: session,
        afterData: restored,
        affectedMonths: [session.yearMonth],
      };
    });
  }
}
