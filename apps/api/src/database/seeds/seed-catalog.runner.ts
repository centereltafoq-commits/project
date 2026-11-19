import { eq } from 'drizzle-orm';
import { DrizzleDatabase } from '../database.module';
import {
  assistants,
  classrooms,
  financialPolicies,
  gradeLevels,
  groupAssistants,
  groups,
  groupTeachers,
  students,
  teachers,
} from '../schemas';
import {
  buildSeedStudents24,
  SEED_ASSISTANTS,
  SEED_CLASSROOMS,
  SEED_GRADE_LEVELS,
  SEED_TEACHERS,
} from './seed-catalog.data';
import { SEED_GROUPS } from './seed-groups.data';
import { SeedGroupRef } from './seed-operations.runner';

export async function seedCatalogEntities(
  db: DrizzleDatabase,
  teacherUserId: string,
): Promise<{
  classroomsByCode: Map<string, string>;
  teachersByCode: Map<string, string>;
  assistantsByCode: Map<string, string>;
  studentIds: string[];
  groupsList: SeedGroupRef[];
}> {
  const classroomsByCode = new Map<string, string>();
  for (const c of SEED_CLASSROOMS) {
    const [row] = await db
      .insert(classrooms)
      .values(c)
      .onConflictDoUpdate({
        target: classrooms.roomNumber,
        set: {
          name: c.name,
          maxCapacity: c.maxCapacity,
          seatsCount: c.seatsCount,
          status: c.status,
          equipment: c.equipment,
          notes: c.notes,
        },
      })
      .returning({ id: classrooms.id });
    classroomsByCode.set(c.roomNumber, row.id);
  }

  for (const g of SEED_GRADE_LEVELS) {
    const [existingGrade] = await db
      .select({ id: gradeLevels.id })
      .from(gradeLevels)
      .where(eq(gradeLevels.name, g.name))
      .limit(1);

    if (existingGrade) {
      await db
        .update(gradeLevels)
        .set({ code: g.code, orderIndex: g.orderIndex, isActive: true })
        .where(eq(gradeLevels.id, existingGrade.id));
    } else {
      await db.insert(gradeLevels).values(g);
    }
  }

  const teachersByCode = new Map<string, string>();
  for (const t of SEED_TEACHERS) {
    const linkedUserId = t.teacherCode === 'TCH-2026' ? teacherUserId : null;
    const [row] = await db
      .insert(teachers)
      .values({ ...t, userId: linkedUserId })
      .onConflictDoUpdate({
        target: teachers.teacherCode,
        set: {
          fullName: t.fullName,
          specialization: t.specialization,
          employmentStatus: t.employmentStatus,
          userId: linkedUserId,
        },
      })
      .returning({ id: teachers.id });
    teachersByCode.set(t.teacherCode, row.id);
  }

  const assistantsByCode = new Map<string, string>();
  for (const a of SEED_ASSISTANTS) {
    const [row] = await db
      .insert(assistants)
      .values(a)
      .onConflictDoUpdate({
        target: assistants.assistantCode,
        set: {
          fullName: a.fullName,
          calculationMethod: a.calculationMethod,
          rateValue: a.rateValue,
          status: a.status,
        },
      })
      .returning({ id: assistants.id });
    assistantsByCode.set(a.assistantCode, row.id);
  }

  const studentIds: string[] = [];
  for (const s of buildSeedStudents24()) {
    const [row] = await db
      .insert(students)
      .values(s)
      .onConflictDoUpdate({
        target: students.studentCode,
        set: {
          fullName: s.fullName,
          phone: s.phone,
          guardianPhone: s.guardianPhone,
          gradeLevel: s.gradeLevel,
          status: s.status,
          notes: s.notes,
        },
      })
      .returning({ id: students.id });
    studentIds.push(row.id);
  }

  const groupsList: SeedGroupRef[] = [];
  for (const g of SEED_GROUPS) {
    const primaryTeacherId = teachersByCode.get(g.teacherCode)!;
    const defaultClassroomId = g.roomNumber ? classroomsByCode.get(g.roomNumber) ?? null : null;
    const assistantId = g.assistantCode ? assistantsByCode.get(g.assistantCode) ?? null : null;

    // Populate classroomId inside each schedule slot when the group is allocated to a classroom
    const resolvedSlots = g.scheduleSlots.map((slot) => ({
      ...slot,
      classroomId: defaultClassroomId,
    }));

    const [grpRow] = await db
      .insert(groups)
      .values({
        groupCode: g.groupCode,
        name: g.name,
        subject: g.subject,
        gradeLevel: g.gradeLevel,
        primaryTeacherId,
        defaultClassroomId,
        monthlySessionsCount: g.monthlySessionsCount,
        monthlyPrice: g.monthlyPrice,
        calculatedSessionPrice: g.calculatedSessionPrice,
        scheduleSlots: resolvedSlots,
        maxStudents: g.maxStudents,
        isActive: g.isActive,
        notes: g.notes ?? null,
      })
      .onConflictDoUpdate({
        target: groups.groupCode,
        set: {
          name: g.name,
          gradeLevel: g.gradeLevel,
          primaryTeacherId,
          defaultClassroomId,
          monthlySessionsCount: g.monthlySessionsCount,
          monthlyPrice: g.monthlyPrice,
          calculatedSessionPrice: g.calculatedSessionPrice,
          scheduleSlots: resolvedSlots,
          isActive: g.isActive,
          notes: g.notes ?? null,
        },
      })
      .returning({ id: groups.id });

    await db
      .insert(financialPolicies)
      .values({
        groupId: grpRow.id,
        revenueSplitMethod: g.revenueSplitMethod,
        teacherSharePerStudent: g.teacherSharePerStudent,
        centerSharePerStudent: g.centerSharePerStudent,
        fullMonthAbsencePolicy: g.fullMonthAbsencePolicy,
      })
      .onConflictDoUpdate({
        target: financialPolicies.groupId,
        set: {
          teacherSharePerStudent: g.teacherSharePerStudent,
          centerSharePerStudent: g.centerSharePerStudent,
        },
      });

    await db
      .insert(groupTeachers)
      .values({ groupId: grpRow.id, teacherId: primaryTeacherId, isPrimary: true })
      .onConflictDoNothing({ target: [groupTeachers.groupId, groupTeachers.teacherId] });

    if (assistantId) {
      await db
        .insert(groupAssistants)
        .values({ groupId: grpRow.id, assistantId })
        .onConflictDoNothing({ target: [groupAssistants.groupId, groupAssistants.assistantId] });
    }

    groupsList.push({
      id: grpRow.id,
      groupCode: g.groupCode,
      teacherId: primaryTeacherId,
      classroomId: defaultClassroomId,
      monthlySessionsCount: g.monthlySessionsCount,
      monthlyPrice: Number(g.monthlyPrice),
      sessionPrice: Number(g.calculatedSessionPrice),
      teacherShare: Number(g.teacherSharePerStudent),
      centerShare: Number(g.centerSharePerStudent),
    });
  }

  return { classroomsByCode, teachersByCode, assistantsByCode, studentIds, groupsList };
}
