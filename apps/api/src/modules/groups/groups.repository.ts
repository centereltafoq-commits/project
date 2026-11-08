import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, ne, or, sql, SQL } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  assistants,
  classrooms,
  enrollments,
  financialPolicies,
  groupAssistants,
  groups,
  groupTeachers,
  students,
  teachers,
} from '../../database/schemas';
import { normalizePagination } from '../../common/utils/pagination.util';
import { GroupQueryDto } from './dto/group.dto';

@Injectable()
export class GroupsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async findPaginated(query: GroupQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const conditions: SQL[] = [];

    if (query.primaryTeacherId) {
      conditions.push(eq(groups.primaryTeacherId, query.primaryTeacherId));
    }
    if (query.gradeLevel) {
      conditions.push(eq(groups.gradeLevel, query.gradeLevel));
    }
    if (query.isActive === 'true' || query.isActive === 'false') {
      conditions.push(eq(groups.isActive, query.isActive === 'true'));
    }
    if (query.search) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(groups.name, pattern),
          ilike(groups.groupCode, pattern),
          ilike(groups.subject, pattern),
          ilike(groups.gradeLevel, pattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const activeStudentsSq = sql<number>`(
      SELECT COUNT(*)::int
      FROM ${enrollments} e
      WHERE e.group_id = ${groups.id} AND e.status = 'ACTIVE'
    )`.as('active_students_count');

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: groups.id,
          groupCode: groups.groupCode,
          name: groups.name,
          subject: groups.subject,
          gradeLevel: groups.gradeLevel,
          primaryTeacherId: groups.primaryTeacherId,
          primaryTeacherName: teachers.fullName,
          defaultClassroomId: groups.defaultClassroomId,
          defaultClassroomName: classrooms.name,
          monthlySessionsCount: groups.monthlySessionsCount,
          monthlyPrice: groups.monthlyPrice,
          calculatedSessionPrice: groups.calculatedSessionPrice,
          scheduleSlots: groups.scheduleSlots,
          maxStudents: groups.maxStudents,
          isActive: groups.isActive,
          notes: groups.notes,
          activeStudentsCount: activeStudentsSq,
          revenueSplitMethod: financialPolicies.revenueSplitMethod,
          teacherSharePerStudent: financialPolicies.teacherSharePerStudent,
          centerSharePerStudent: financialPolicies.centerSharePerStudent,
          teacherPercentage: financialPolicies.teacherPercentage,
          fullMonthAbsencePolicy: financialPolicies.fullMonthAbsencePolicy,
          chargeExcusedAbsence: financialPolicies.chargeExcusedAbsence,
          createdAt: groups.createdAt,
        })
        .from(groups)
        .innerJoin(teachers, eq(groups.primaryTeacherId, teachers.id))
        .leftJoin(classrooms, eq(groups.defaultClassroomId, classrooms.id))
        .leftJoin(financialPolicies, eq(financialPolicies.groupId, groups.id))
        .where(whereClause)
        .orderBy(desc(groups.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(groups).where(whereClause),
    ]);

    return { rows, total: Number(total), page, limit };
  }

  async findByCode(groupCode: string) {
    const [row] = await this.db
      .select({ id: groups.id })
      .from(groups)
      .where(eq(groups.groupCode, groupCode))
      .limit(1);
    return row ?? null;
  }

  async findDetailById(id: string) {
    const activeStudentsSq = sql<number>`(
      SELECT COUNT(*)::int FROM ${enrollments} e WHERE e.group_id = ${groups.id} AND e.status = 'ACTIVE'
    )`.as('active_students_count');

    const [groupRow] = await this.db
      .select({
        id: groups.id,
        groupCode: groups.groupCode,
        name: groups.name,
        subject: groups.subject,
        gradeLevel: groups.gradeLevel,
        primaryTeacherId: groups.primaryTeacherId,
        primaryTeacherName: teachers.fullName,
        defaultClassroomId: groups.defaultClassroomId,
        defaultClassroomName: classrooms.name,
        monthlySessionsCount: groups.monthlySessionsCount,
        monthlyPrice: groups.monthlyPrice,
        calculatedSessionPrice: groups.calculatedSessionPrice,
        scheduleSlots: groups.scheduleSlots,
        maxStudents: groups.maxStudents,
        isActive: groups.isActive,
        notes: groups.notes,
        activeStudentsCount: activeStudentsSq,
        createdAt: groups.createdAt,
        updatedAt: groups.updatedAt,
      })
      .from(groups)
      .innerJoin(teachers, eq(groups.primaryTeacherId, teachers.id))
      .leftJoin(classrooms, eq(groups.defaultClassroomId, classrooms.id))
      .where(eq(groups.id, id))
      .limit(1);

    if (!groupRow) return null;

    const [[policy], linkedTeachers, linkedAssistants] = await Promise.all([
      this.db.select().from(financialPolicies).where(eq(financialPolicies.groupId, id)).limit(1),
      this.db
        .select({
          teacherId: teachers.id,
          fullName: teachers.fullName,
          specialization: teachers.specialization,
          isPrimary: groupTeachers.isPrimary,
        })
        .from(groupTeachers)
        .innerJoin(teachers, eq(groupTeachers.teacherId, teachers.id))
        .where(eq(groupTeachers.groupId, id)),
      this.db
        .select({
          linkId: groupAssistants.id,
          assistantId: assistants.id,
          fullName: assistants.fullName,
          assistantCode: assistants.assistantCode,
          defaultMethod: assistants.calculationMethod,
          defaultRate: assistants.rateValue,
          overrideCalculationMethod: groupAssistants.overrideCalculationMethod,
          overrideRateValue: groupAssistants.overrideRateValue,
        })
        .from(groupAssistants)
        .innerJoin(assistants, eq(groupAssistants.assistantId, assistants.id))
        .where(eq(groupAssistants.groupId, id)),
    ]);

    return {
      ...groupRow,
      financialPolicy: policy ?? null,
      teachers: linkedTeachers,
      assistants: linkedAssistants,
    };
  }

  async getLookups() {
    const [teacherList, assistantList, studentList] = await Promise.all([
      this.db
        .select({
          id: teachers.id,
          teacherCode: teachers.teacherCode,
          fullName: teachers.fullName,
          specialization: teachers.specialization,
        })
        .from(teachers)
        .where(eq(teachers.employmentStatus, 'ACTIVE'))
        .orderBy(asc(teachers.fullName))
        .limit(1000),
      this.db
        .select({
          id: assistants.id,
          assistantCode: assistants.assistantCode,
          fullName: assistants.fullName,
          calculationMethod: assistants.calculationMethod,
          rateValue: assistants.rateValue,
        })
        .from(assistants)
        .where(eq(assistants.status, 'ACTIVE'))
        .orderBy(asc(assistants.fullName))
        .limit(1000),
      this.db
        .select({
          id: students.id,
          studentCode: students.studentCode,
          fullName: students.fullName,
          phone: students.phone,
          gradeLevel: students.gradeLevel,
        })
        .from(students)
        .where(eq(students.status, 'ACTIVE'))
        .orderBy(asc(students.fullName))
        .limit(2000),
    ]);

    return {
      teachers: teacherList,
      assistants: assistantList,
      students: studentList,
    };
  }

  async findActiveGroupsByTeacher(teacherId: string, excludeGroupId?: string) {
    const conditions: SQL[] = [
      eq(groups.isActive, true),
      eq(groups.primaryTeacherId, teacherId),
    ];
    if (excludeGroupId) {
      conditions.push(ne(groups.id, excludeGroupId));
    }

    return this.db
      .select({
        id: groups.id,
        name: groups.name,
        scheduleSlots: groups.scheduleSlots,
      })
      .from(groups)
      .where(and(...conditions));
  }
}
