import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { FullMonthAbsencePolicy } from '@edu-center/shared';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  financialPolicies,
  groupAssistants,
  groups,
  GroupScheduleSlot,
  groupTeachers,
} from '../../database/schemas';
import { FinancialPolicyInputDto, GroupAssistantAssignmentDto } from './dto/group-policy.dto';

@Injectable()
export class GroupsMutationRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async createWithRelations(input: {
    groupData: {
      groupCode: string;
      name: string;
      subject: string;
      gradeLevel: string;
      primaryTeacherId: string;
      defaultClassroomId: string | null;
      monthlySessionsCount: number;
      monthlyPrice: string;
      calculatedSessionPrice: string;
      scheduleSlots: GroupScheduleSlot[];
      maxStudents: number;
      isActive: boolean;
      notes: string | null;
    };
    policy: FinancialPolicyInputDto;
    coTeacherIds: string[];
    assistants: GroupAssistantAssignmentDto[];
  }) {
    return this.db.transaction(async (tx) => {
      const [created] = await tx.insert(groups).values(input.groupData).returning();

      await tx.insert(financialPolicies).values({
        groupId: created.id,
        revenueSplitMethod: input.policy.revenueSplitMethod,
        teacherSharePerStudent: input.policy.teacherSharePerStudent.toFixed(2),
        centerSharePerStudent: input.policy.centerSharePerStudent.toFixed(2),
        teacherPercentage: (input.policy.teacherPercentage ?? 0).toFixed(2),
        fullMonthAbsencePolicy:
          input.policy.fullMonthAbsencePolicy ?? FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
        fullAbsenceFixedFee: (input.policy.fullAbsenceFixedFee ?? 0).toFixed(2),
        chargeExcusedAbsence: input.policy.chargeExcusedAbsence ?? false,
      });

      const uniqueCoTeachers = Array.from(new Set(input.coTeacherIds)).filter(
        (tid) => tid !== input.groupData.primaryTeacherId,
      );
      await tx.insert(groupTeachers).values([
        { groupId: created.id, teacherId: input.groupData.primaryTeacherId, isPrimary: true },
        ...uniqueCoTeachers.map((tid) => ({ groupId: created.id, teacherId: tid, isPrimary: false })),
      ]);

      if (input.assistants.length > 0) {
        await tx.insert(groupAssistants).values(
          input.assistants.map((a) => ({
            groupId: created.id,
            assistantId: a.assistantId,
            overrideCalculationMethod: a.overrideCalculationMethod ?? null,
            overrideRateValue:
              a.overrideRateValue !== undefined ? a.overrideRateValue.toFixed(2) : null,
          })),
        );
      }

      return created;
    });
  }

  async updateWithRelations(
    id: string,
    groupUpdates: Record<string, unknown>,
    policy?: FinancialPolicyInputDto,
    primaryTeacherIdForSync?: string,
    coTeacherIds?: string[],
    assistantLinks?: GroupAssistantAssignmentDto[],
  ) {
    return this.db.transaction(async (tx) => {
      if (Object.keys(groupUpdates).length > 0) {
        await tx
          .update(groups)
          .set({ ...groupUpdates, updatedAt: new Date() })
          .where(eq(groups.id, id));
      }

      if (policy) {
        const policyValues = {
          revenueSplitMethod: policy.revenueSplitMethod,
          teacherSharePerStudent: policy.teacherSharePerStudent.toFixed(2),
          centerSharePerStudent: policy.centerSharePerStudent.toFixed(2),
          teacherPercentage: (policy.teacherPercentage ?? 0).toFixed(2),
          fullMonthAbsencePolicy:
            policy.fullMonthAbsencePolicy ?? FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
          fullAbsenceFixedFee: (policy.fullAbsenceFixedFee ?? 0).toFixed(2),
          chargeExcusedAbsence: policy.chargeExcusedAbsence ?? false,
        };
        await tx
          .insert(financialPolicies)
          .values({ groupId: id, ...policyValues })
          .onConflictDoUpdate({
            target: financialPolicies.groupId,
            set: { ...policyValues, updatedAt: new Date() },
          });
      }

      if (primaryTeacherIdForSync && coTeacherIds !== undefined) {
        await tx.delete(groupTeachers).where(eq(groupTeachers.groupId, id));
        const uniqueCo = Array.from(new Set(coTeacherIds)).filter(
          (tid) => tid !== primaryTeacherIdForSync,
        );
        await tx.insert(groupTeachers).values([
          { groupId: id, teacherId: primaryTeacherIdForSync, isPrimary: true },
          ...uniqueCo.map((tid) => ({ groupId: id, teacherId: tid, isPrimary: false })),
        ]);
      } else if (primaryTeacherIdForSync) {
        await tx
          .update(groupTeachers)
          .set({ isPrimary: false })
          .where(eq(groupTeachers.groupId, id));
        await tx
          .insert(groupTeachers)
          .values({ groupId: id, teacherId: primaryTeacherIdForSync, isPrimary: true })
          .onConflictDoUpdate({
            target: [groupTeachers.groupId, groupTeachers.teacherId],
            set: { isPrimary: true },
          });
      }

      if (assistantLinks !== undefined) {
        await tx.delete(groupAssistants).where(eq(groupAssistants.groupId, id));
        if (assistantLinks.length > 0) {
          await tx.insert(groupAssistants).values(
            assistantLinks.map((a) => ({
              groupId: id,
              assistantId: a.assistantId,
              overrideCalculationMethod: a.overrideCalculationMethod ?? null,
              overrideRateValue:
                a.overrideRateValue !== undefined ? a.overrideRateValue.toFixed(2) : null,
            })),
          );
        }
      }
    });
  }
}
