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
  buildSeedStudents32,
  SEED_ASSISTANTS,
  SEED_CLASSROOMS,
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
          status: c.status,
          equipment: c.equipment,
        },
      })
      .returning({ id: classrooms.id });
    classroomsByCode.set(c.roomNumber, row.id);
  }

  const defaultGrades = [
    { name: 'الصف الأول الثانوي', code: 'SEC-1', orderIndex: 1 },
    { name: 'الصف الثاني الثانوي', code: 'SEC-2', orderIndex: 2 },
    { name: 'الصف الثالث الثانوي', code: 'SEC-3', orderIndex: 3 },
  ];
  for (const g of defaultGrades) {
    await db
      .insert(gradeLevels)
      .values(g)
      .onConflictDoUpdate({
        target: gradeLevels.name,
        set: { code: g.code, orderIndex: g.orderIndex, isActive: true },
      });
  }

  const teachersByCode = new Map<string, string>();
  for (const t of SEED_TEACHERS) {
    const linkedUserId = t.teacherCode === 'TCH-001' ? teacherUserId : null;
    const [row] = await db
      .insert(teachers)
      .values({ ...t, userId: linkedUserId })
      .onConflictDoUpdate({
        target: teachers.teacherCode,
        set: { fullName: t.fullName, specialization: t.specialization, userId: linkedUserId },
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
        },
      })
      .returning({ id: assistants.id });
    assistantsByCode.set(a.assistantCode, row.id);
  }

  const studentIds: string[] = [];
  for (const s of buildSeedStudents32()) {
    const [row] = await db
      .insert(students)
      .values(s)
      .onConflictDoUpdate({
        target: students.studentCode,
        set: { fullName: s.fullName, gradeLevel: s.gradeLevel, status: s.status },
      })
      .returning({ id: students.id });
    studentIds.push(row.id);
  }

  const groupsList: SeedGroupRef[] = [];
  for (const g of SEED_GROUPS) {
    const primaryTeacherId = teachersByCode.get(g.teacherCode)!;
    const defaultClassroomId = classroomsByCode.get(g.roomNumber)!;
    const assistantId = assistantsByCode.get(g.assistantCode)!;

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
        scheduleSlots: g.scheduleSlots,
        maxStudents: g.maxStudents,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: groups.groupCode,
        set: {
          name: g.name,
          primaryTeacherId,
          defaultClassroomId,
          monthlySessionsCount: g.monthlySessionsCount,
          monthlyPrice: g.monthlyPrice,
          calculatedSessionPrice: g.calculatedSessionPrice,
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

    await db
      .insert(groupAssistants)
      .values({ groupId: grpRow.id, assistantId })
      .onConflictDoNothing({ target: [groupAssistants.groupId, groupAssistants.assistantId] });

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
