import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  systemSettings,
  attendance,
  makeupSessions,
  sessions,
  studentMonthlyRecords,
  teacherMonthlyRecords,
  assistantMonthlyRecords,
  teacherDues,
  assistantDues,
  payments,
  paymentAllocations,
  teacherPayouts,
  assistantPayouts,
  expenses,
  bookingSeries,
  bookingRequests,
  bookingApprovals,
  classroomBookings,
  enrollments,
  groupTeachers,
  groupAssistants,
  financialPolicies,
  groups,
  students,
} from '../../database/schemas';
import { UpdateSettingsDto } from './dto/settings.dto';

export type SystemSettingsRecord = typeof systemSettings.$inferSelect;

@Injectable()
export class SettingsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async getSettings(): Promise<SystemSettingsRecord> {
    const [row] = await this.db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.id, 'default'))
      .limit(1);

    if (row) {
      return row;
    }

    const [created] = await this.db
      .insert(systemSettings)
      .values({ id: 'default' })
      .onConflictDoUpdate({
        target: systemSettings.id,
        set: { updatedAt: new Date() },
      })
      .returning();

    return created;
  }

  async upsertSettings(
    dto: UpdateSettingsDto,
    actorUserId?: string,
  ): Promise<SystemSettingsRecord> {
    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
      ...(actorUserId ? { updatedBy: actorUserId } : {}),
    };

    if (dto.centerName !== undefined) updatePayload.centerName = dto.centerName;
    if (dto.centerSubtitle !== undefined)
      updatePayload.centerSubtitle = dto.centerSubtitle ? dto.centerSubtitle.trim() : null;
    if (dto.logoUrl !== undefined)
      updatePayload.logoUrl = dto.logoUrl ? dto.logoUrl.trim() : null;
    if (dto.phone !== undefined)
      updatePayload.phone = dto.phone ? dto.phone.trim() : null;
    if (dto.address !== undefined)
      updatePayload.address = dto.address ? dto.address.trim() : null;
    if (dto.academicYear !== undefined) updatePayload.academicYear = dto.academicYear;
    if (dto.currencySymbol !== undefined) updatePayload.currencySymbol = dto.currencySymbol;

    const [result] = await this.db
      .insert(systemSettings)
      .values({
        id: 'default',
        ...updatePayload,
      })
      .onConflictDoUpdate({
        target: systemSettings.id,
        set: updatePayload,
      })
      .returning();

    return result;
  }

  async clearOperationalData(purgeStudents: boolean): Promise<{
    success: boolean;
    purgedStudents: boolean;
  }> {
    await this.db.transaction(async (tx) => {
      // 1. Attendance & makeup records
      await tx.delete(makeupSessions);
      await tx.delete(attendance);

      // 2. Financial transactions and allocations
      await tx.delete(paymentAllocations);
      await tx.delete(payments);
      await tx.delete(studentMonthlyRecords);
      await tx.delete(teacherDues);
      await tx.delete(assistantDues);
      await tx.delete(teacherPayouts);
      await tx.delete(assistantPayouts);
      await tx.delete(teacherMonthlyRecords);
      await tx.delete(assistantMonthlyRecords);
      await tx.delete(expenses);

      // 3. Room bookings and requests
      await tx.delete(classroomBookings);
      await tx.delete(bookingApprovals);
      await tx.delete(bookingRequests);
      await tx.delete(bookingSeries);

      // 4. Enrollments and class sessions
      await tx.delete(enrollments);
      await tx.delete(sessions);

      // 5. Optional student profiles & group definitions
      if (purgeStudents) {
        await tx.delete(groupTeachers);
        await tx.delete(groupAssistants);
        await tx.delete(financialPolicies);
        await tx.delete(groups);
        await tx.delete(students);
      }
    });

    return {
      success: true,
      purgedStudents: purgeStudents,
    };
  }
}
