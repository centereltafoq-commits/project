import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql, SQL } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  assistants,
  classrooms,
  enrollments,
  financialPolicies,
  gradeLevels,
  groupAssistants,
  groups,
  groupTeachers,
  students,
  teachers,
} from '../../database/schemas';
import { normalizePagination } from '../../common/utils/pagination.util';
import { GroupExportQueryDto } from './dto/group-excel.dto';
import { GroupQueryDto } from './dto/group.dto';

@Injectable()
export class GroupsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  private buildWhereClause(
    query: Pick<GroupQueryDto, 'primaryTeacherId' | 'gradeLevel' | 'isActive' | 'search'>,
  ): SQL | undefined {
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

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  private getActiveStudentsCountSubquery() {
    return sql<number>`(
      SELECT COUNT(*)::int
      FROM ${enrollments} e
      WHERE e.group_id = ${groups.id} AND e.status = 'ACTIVE'
    )`.as('active_students_count');
  }

  async findPaginated(query: GroupQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const whereClause = this.buildWhereClause(query);
    const activeStudentsSq = this.getActiveStudentsCountSubquery();

    const [rows, [{ total }], [groupCounts], [enrollmentCounts]] = await Promise.all([
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
      this.db
        .select({
          totalGroups: sql<number>`COUNT(*)::int`,
          activeGroups: sql<number>`COUNT(*) FILTER (WHERE ${groups.isActive} = true)::int`,
          inactiveGroups: sql<number>`COUNT(*) FILTER (WHERE ${groups.isActive} = false)::int`,
        })
        .from(groups),
      this.db
        .select({
          totalActiveEnrollments: sql<number>`COUNT(*)::int`,
        })
        .from(enrollments)
        .where(eq(enrollments.status, 'ACTIVE')),
    ]);

    return {
      rows,
      total: Number(total),
      page,
      limit,
      summary: {
        totalGroups: Number(groupCounts?.totalGroups ?? 0),
        activeGroups: Number(groupCounts?.activeGroups ?? 0),
        inactiveGroups: Number(groupCounts?.inactiveGroups ?? 0),
        totalActiveEnrollments: Number(enrollmentCounts?.totalActiveEnrollments ?? 0),
      },
    };
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
    const [teacherList, assistantList, studentList, groupList] = await Promise.all([
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
      this.db
        .select({
          id: groups.id,
          groupCode: groups.groupCode,
          name: groups.name,
          gradeLevel: groups.gradeLevel,
        })
        .from(groups)
        .where(eq(groups.isActive, true))
        .orderBy(asc(groups.name))
        .limit(1000),
    ]);

    return {
      teachers: teacherList,
      assistants: assistantList,
      students: studentList,
      groups: groupList,
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

  async findAllForExport(query: GroupExportQueryDto) {
    const whereClause = this.buildWhereClause(query);
    const activeStudentsSq = this.getActiveStudentsCountSubquery();

    return this.db
      .select({
        id: groups.id,
        groupCode: groups.groupCode,
        name: groups.name,
        subject: groups.subject,
        gradeLevel: groups.gradeLevel,
        primaryTeacherId: groups.primaryTeacherId,
        primaryTeacherName: teachers.fullName,
        primaryTeacherCode: teachers.teacherCode,
        defaultClassroomName: classrooms.name,
        monthlySessionsCount: groups.monthlySessionsCount,
        monthlyPrice: groups.monthlyPrice,
        calculatedSessionPrice: groups.calculatedSessionPrice,
        maxStudents: groups.maxStudents,
        activeStudentsCount: activeStudentsSq,
        revenueSplitMethod: financialPolicies.revenueSplitMethod,
        teacherSharePerStudent: financialPolicies.teacherSharePerStudent,
        centerSharePerStudent: financialPolicies.centerSharePerStudent,
        teacherPercentage: financialPolicies.teacherPercentage,
        fullMonthAbsencePolicy: financialPolicies.fullMonthAbsencePolicy,
        fullAbsenceFixedFee: financialPolicies.fullAbsenceFixedFee,
        chargeExcusedAbsence: financialPolicies.chargeExcusedAbsence,
        isActive: groups.isActive,
        notes: groups.notes,
      })
      .from(groups)
      .innerJoin(teachers, eq(groups.primaryTeacherId, teachers.id))
      .leftJoin(classrooms, eq(groups.defaultClassroomId, classrooms.id))
      .leftJoin(financialPolicies, eq(financialPolicies.groupId, groups.id))
      .where(whereClause)
      .orderBy(desc(groups.createdAt))
      .limit(10_000);
  }

  async findActiveGradeLevelNames(): Promise<string[]> {
    const rows = await this.db
      .select({ name: gradeLevels.name })
      .from(gradeLevels)
      .where(eq(gradeLevels.isActive, true))
      .orderBy(asc(gradeLevels.orderIndex), asc(gradeLevels.name));
    return rows.map((r) => r.name);
  }

  async findAllGradeLevelRecords(): Promise<Array<{ name: string; isActive: boolean }>> {
    return this.db
      .select({ name: gradeLevels.name, isActive: gradeLevels.isActive })
      .from(gradeLevels)
      .orderBy(asc(gradeLevels.orderIndex), asc(gradeLevels.name));
  }

  async findAllTeachersForExcel(): Promise<
    Array<{ id: string; teacherCode: string; fullName: string; employmentStatus: string }>
  > {
    return this.db
      .select({
        id: teachers.id,
        teacherCode: teachers.teacherCode,
        fullName: teachers.fullName,
        employmentStatus: teachers.employmentStatus,
      })
      .from(teachers)
      .orderBy(asc(teachers.fullName));
  }

  async findExistingCodesAndGroupKeys(
    codes: string[],
    teacherIds: string[],
  ): Promise<{ existingCodes: Set<string>; existingGroupKeys: Set<string> }> {
    const uniqueCodes = Array.from(new Set(codes.filter(Boolean)));
    const uniqueTeacherIds = Array.from(new Set(teacherIds.filter(Boolean)));

    const [codeRows, groupRows] = await Promise.all([
      uniqueCodes.length > 0
        ? this.db
            .select({ groupCode: groups.groupCode })
            .from(groups)
            .where(inArray(groups.groupCode, uniqueCodes))
        : Promise.resolve([]),
      uniqueTeacherIds.length > 0
        ? this.db
            .select({
              name: groups.name,
              gradeLevel: groups.gradeLevel,
              primaryTeacherId: groups.primaryTeacherId,
            })
            .from(groups)
            .where(inArray(groups.primaryTeacherId, uniqueTeacherIds))
        : Promise.resolve([]),
    ]);

    const existingCodes = new Set(codeRows.map((row) => row.groupCode.trim().toUpperCase()));
    const existingGroupKeys = new Set(
      groupRows.map(
        (row) =>
          `${row.name.trim().toLowerCase()}|${row.gradeLevel.trim().toLowerCase()}|${row.primaryTeacherId}`,
      ),
    );

    return { existingCodes, existingGroupKeys };
  }
}
