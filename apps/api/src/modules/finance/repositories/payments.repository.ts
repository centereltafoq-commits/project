import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { EnrollmentStatus } from '@edu-center/shared';
import { DRIZZLE_DB, DrizzleDatabase } from '../../../database/database.module';
import {
  enrollments,
  groups,
  paymentAllocations,
  payments,
  studentMonthlyRecords,
  students,
} from '../../../database/schemas';
import { parseMoney, roundMoney, toMoneyString } from '../utils/money.util';

export interface CreatePaymentTxInput {
  receiptNumber: string;
  studentId: string;
  yearMonth: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  receivedByUserId: string;
  notes?: string;
  explicitAllocations?: Array<{ groupId: string; amount: number }>;
}

@Injectable()
export class PaymentsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async createPaymentWithAllocations(input: CreatePaymentTxInput) {
    const now = new Date();

    return this.db.transaction(async (tx) => {
      const [student] = await tx
        .select()
        .from(students)
        .where(eq(students.id, input.studentId))
        .limit(1);
      if (!student) {
        throw new NotFoundException('الطالب غير موجود');
      }

      const [existingReceipt] = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.receiptNumber, input.receiptNumber))
        .limit(1);
      if (existingReceipt) {
        throw new ConflictException('رقم الإيصال مستخدم مسبقاً، يرجى المحاولة مرة أخرى');
      }

      const monthlyRows = await tx
        .select()
        .from(studentMonthlyRecords)
        .where(
          and(
            eq(studentMonthlyRecords.studentId, input.studentId),
            eq(studentMonthlyRecords.yearMonth, input.yearMonth),
          ),
        )
        .for('update');

      const isClosedMonth = monthlyRows.some((r) => r.isClosed);
      if (isClosedMonth && monthlyRows.length === 0) {
        throw new ConflictException(
          'هذا الشهر المالي مغلق ولا توجد مستحقات مسجلة على الطالب فيه',
        );
      }

      const totalRemaining = roundMoney(
        monthlyRows.reduce((sum, r) => sum + parseMoney(r.remainingBalance), 0),
      );

      if (monthlyRows.length > 0 && totalRemaining <= 0) {
        throw new BadRequestException(
          'لا توجد مبالغ متبقية مستحقة على الطالب لهذا الشهر (خالص بالكامل)',
        );
      }

      if (monthlyRows.length > 0 && input.amount > totalRemaining) {
        throw new BadRequestException(
          `المبلغ المدفوع (${input.amount} ج.م) يتجاوز إجمالي المستحق المتبقي على الطالب لهذا الشهر (${totalRemaining} ج.م)`,
        );
      }

      const recordByGroup = new Map(monthlyRows.map((r) => [r.groupId, r]));
      const plannedAllocations: Array<{
        groupId: string;
        studentMonthlyRecordId: string | null;
        amount: number;
      }> = [];

      if (input.explicitAllocations && input.explicitAllocations.length > 0) {
        const merged = new Map<string, number>();
        for (const item of input.explicitAllocations) {
          merged.set(item.groupId, roundMoney((merged.get(item.groupId) ?? 0) + item.amount));
        }
        for (const [groupId, allocAmt] of merged) {
          const rec = recordByGroup.get(groupId);
          if (rec) {
            const groupRem = parseMoney(rec.remainingBalance);
            if (allocAmt > groupRem) {
              throw new BadRequestException(
                `المبلغ المخصص للمجموعة (${allocAmt} ج.م) يتجاوز المستحق المتبقي عليها (${groupRem} ج.م)`,
              );
            }
          }
          plannedAllocations.push({
            groupId,
            studentMonthlyRecordId: rec?.id ?? null,
            amount: allocAmt,
          });
        }
      } else {
        let remainingToAllocate = roundMoney(input.amount);
        const unpaidSorted = [...monthlyRows]
          .filter((r) => parseMoney(r.remainingBalance) > 0)
          .sort((a, b) => parseMoney(b.remainingBalance) - parseMoney(a.remainingBalance));

        for (const rec of unpaidSorted) {
          if (remainingToAllocate <= 0) break;
          const rem = parseMoney(rec.remainingBalance);
          const take = roundMoney(Math.min(remainingToAllocate, rem));
          if (take > 0) {
            plannedAllocations.push({
              groupId: rec.groupId,
              studentMonthlyRecordId: rec.id,
              amount: take,
            });
            remainingToAllocate = roundMoney(remainingToAllocate - take);
          }
        }

        if (remainingToAllocate > 0) {
          if (monthlyRows.length > 0) {
            const firstRec = monthlyRows[0]!;
            const existingIdx = plannedAllocations.findIndex(
              (p) => p.groupId === firstRec.groupId,
            );
            if (existingIdx >= 0) {
              plannedAllocations[existingIdx]!.amount = roundMoney(
                plannedAllocations[existingIdx]!.amount + remainingToAllocate,
              );
            } else {
              plannedAllocations.push({
                groupId: firstRec.groupId,
                studentMonthlyRecordId: firstRec.id,
                amount: remainingToAllocate,
              });
            }
          } else {
            const [fallbackEnrollment] = await tx
              .select({ groupId: enrollments.groupId })
              .from(enrollments)
              .where(
                and(
                  eq(enrollments.studentId, input.studentId),
                  ne(enrollments.status, EnrollmentStatus.CANCELLED),
                ),
              )
              .limit(1);
            if (!fallbackEnrollment) {
              throw new BadRequestException(
                'لا توجد مجموعات أو مستحقات مسجلة لهذا الطالب لتوزيع الدفعة عليها',
              );
            }
            plannedAllocations.push({
              groupId: fallbackEnrollment.groupId,
              studentMonthlyRecordId: null,
              amount: remainingToAllocate,
            });
          }
        }
      }

      const [createdPayment] = await tx
        .insert(payments)
        .values({
          receiptNumber: input.receiptNumber,
          studentId: input.studentId,
          yearMonth: input.yearMonth,
          amount: toMoneyString(input.amount),
          paymentDate: input.paymentDate,
          paymentMethod: input.paymentMethod,
          receivedByUserId: input.receivedByUserId,
          notes: input.notes ?? null,
        })
        .returning();

      for (const alloc of plannedAllocations) {
        await tx.insert(paymentAllocations).values({
          paymentId: createdPayment!.id,
          studentMonthlyRecordId: alloc.studentMonthlyRecordId,
          groupId: alloc.groupId,
          yearMonth: input.yearMonth,
          allocatedAmount: toMoneyString(alloc.amount),
        });

        const rec = recordByGroup.get(alloc.groupId);
        if (rec) {
          const newTotalPaid = roundMoney(parseMoney(rec.totalPaid) + alloc.amount);
          const newRemaining = roundMoney(
            Math.max(0, parseMoney(rec.totalDue) - newTotalPaid),
          );
          await tx
            .update(studentMonthlyRecords)
            .set({
              totalPaid: toMoneyString(newTotalPaid),
              remainingBalance: toMoneyString(newRemaining),
              updatedAt: now,
            })
            .where(eq(studentMonthlyRecords.id, rec.id));
        }
      }

      const groupIds = plannedAllocations.map((a) => a.groupId);
      const groupInfoRows =
        groupIds.length > 0
          ? await tx
              .select({ id: groups.id, name: groups.name, groupCode: groups.groupCode })
              .from(groups)
              .where(inArray(groups.id, groupIds))
          : [];
      const groupInfoMap = new Map(groupInfoRows.map((g) => [g.id, g]));

      return {
        id: createdPayment!.id,
        receiptNumber: createdPayment!.receiptNumber,
        studentId: student.id,
        studentCode: student.studentCode,
        studentName: student.fullName,
        studentPhone: student.phone,
        guardianPhone: student.guardianPhone,
        yearMonth: createdPayment!.yearMonth,
        amount: parseMoney(createdPayment!.amount),
        paymentDate: createdPayment!.paymentDate,
        paymentMethod: createdPayment!.paymentMethod,
        notes: createdPayment!.notes,
        createdAt: createdPayment!.createdAt,
        allocations: plannedAllocations.map((a) => ({
          groupId: a.groupId,
          groupName: groupInfoMap.get(a.groupId)?.name ?? '—',
          groupCode: groupInfoMap.get(a.groupId)?.groupCode ?? '',
          allocatedAmount: a.amount,
        })),
      };
    });
  }
}
