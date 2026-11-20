import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
  SQL,
} from 'drizzle-orm';
import { ClassroomStatus, EnrollmentStatus, SessionStatus } from '@edu-center/shared';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  attendance,
  classroomMaintenances,
  classrooms,
  enrollments,
  groups,
  sessions,
  students,
  teachers,
} from '../../database/schemas';
import { normalizePagination } from '../../common/utils/pagination.util';
import { SessionQueryDto } from './dto/session.dto';

@Injectable()
export class AttendanceRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async getLookups() {
    const [groupList, teacherList, classroomList, studentList] = await Promise.all([
      this.db
        .select({
          id: groups.id,
          groupCode: groups.groupCode,
          name: groups.name,
          subject: groups.subject,
          gradeLevel: groups.gradeLevel,
          primaryTeacherId: groups.primaryTeacherId,
          defaultClassroomId: groups.defaultClassroomId,
        })
        .from(groups)
        .where(eq(groups.isActive, true))
        .orderBy(asc(groups.name)),
      this.db
        .select({ id: teachers.id, fullName: teachers.fullName, teacherCode: teachers.teacherCode })
        .from(teachers)
        .orderBy(asc(teachers.fullName)),
      this.db
        .select({
          id: classrooms.id,
          roomNumber: classrooms.roomNumber,
          name: classrooms.name,
          maxCapacity: classrooms.maxCapacity,
        })
        .from(classrooms)
        .orderBy(asc(classrooms.roomNumber)),
      this.db
        .select({
          id: students.id,
          studentCode: students.studentCode,
          fullName: students.fullName,
          gradeLevel: students.gradeLevel,
        })
        .from(students)
        .orderBy(asc(students.fullName))
        .limit(500),
    ]);

    return {
      groups: groupList,
      teachers: teacherList,
      classrooms: classroomList,
      students: studentList,
    };
  }

  async findSessionsPaginated(query: SessionQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const conditions: SQL[] = [];

    if (query.groupId) conditions.push(eq(sessions.groupId, query.groupId));
    if (query.teacherId) conditions.push(eq(sessions.teacherId, query.teacherId));
    if (query.yearMonth) conditions.push(eq(sessions.yearMonth, query.yearMonth));
    if (query.sessionDate) conditions.push(eq(sessions.sessionDate, query.sessionDate));
    if (query.status) conditions.push(eq(sessions.status, query.status));
    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(
        or(
          ilike(groups.name, pattern),
          ilike(groups.groupCode, pattern),
          ilike(teachers.fullName, pattern),
          ilike(sessions.topic, pattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: sessions.id,
          groupId: sessions.groupId,
          groupName: groups.name,
          groupCode: groups.groupCode,
          subject: groups.subject,
          monthlySessionsCount: groups.monthlySessionsCount,
          teacherId: sessions.teacherId,
          teacherName: teachers.fullName,
          classroomId: sessions.classroomId,
          classroomName: classrooms.name,
          roomNumber: classrooms.roomNumber,
          sessionDate: sessions.sessionDate,
          yearMonth: sessions.yearMonth,
          startTime: sessions.startTime,
          endTime: sessions.endTime,
          status: sessions.status,
          topic: sessions.topic,
          notes: sessions.notes,
        })
        .from(sessions)
        .innerJoin(groups, eq(sessions.groupId, groups.id))
        .innerJoin(teachers, eq(sessions.teacherId, teachers.id))
        .leftJoin(classrooms, eq(sessions.classroomId, classrooms.id))
        .where(whereClause)
        .orderBy(desc(sessions.sessionDate), desc(sessions.startTime))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(sessions)
        .innerJoin(groups, eq(sessions.groupId, groups.id))
        .innerJoin(teachers, eq(sessions.teacherId, teachers.id))
        .where(whereClause),
    ]);

    const sessionIds = rows.map((r) => r.id);
    const statsMap = new Map<string, { presentCount: number; recordedCount: number }>();
    const groupEnrollmentsMap = new Map<
      string,
      Array<{ studentId: string; startDate: string; endDate: string | null }>
    >();
    let completedCountByGroupMonth = new Map<string, number>();
    let sequenceBySessionId = new Map<string, number>();

    if (sessionIds.length > 0) {
      const groupIds = Array.from(new Set(rows.map((r) => r.groupId)));
      const yearMonths = Array.from(new Set(rows.map((r) => r.yearMonth)));
      const [counts, groupEnrollments, monthSessionRows] = await Promise.all([
        this.db
          .select({
            sessionId: attendance.sessionId,
            recordedCount: count(),
            presentCount: sql<number>`count(*) filter (where ${attendance.status} = 'PRESENT')`,
          })
          .from(attendance)
          .where(inArray(attendance.sessionId, sessionIds))
          .groupBy(attendance.sessionId),
        groupIds.length > 0
          ? this.db
              .select({
                groupId: enrollments.groupId,
                studentId: enrollments.studentId,
                startDate: enrollments.startDate,
                endDate: enrollments.endDate,
              })
              .from(enrollments)
              .where(
                and(
                  inArray(enrollments.groupId, groupIds),
                  ne(enrollments.status, EnrollmentStatus.CANCELLED),
                ),
              )
          : Promise.resolve([]),
        groupIds.length > 0 && yearMonths.length > 0
          ? this.db
              .select({
                id: sessions.id,
                groupId: sessions.groupId,
                yearMonth: sessions.yearMonth,
                status: sessions.status,
                hasAttendance: sql<boolean>`EXISTS (SELECT 1 FROM attendance a WHERE a.session_id = ${sessions.id})`,
              })
              .from(sessions)
              .where(
                and(
                  inArray(sessions.groupId, groupIds),
                  inArray(sessions.yearMonth, yearMonths),
                  ne(sessions.status, SessionStatus.CANCELLED),
                ),
              )
              .orderBy(asc(sessions.sessionDate), asc(sessions.startTime), asc(sessions.id))
          : Promise.resolve([]),
      ]);

      for (const c of counts) {
        statsMap.set(c.sessionId, {
          presentCount: Number(c.presentCount),
          recordedCount: Number(c.recordedCount),
        });
      }

      for (const enr of groupEnrollments) {
        const list = groupEnrollmentsMap.get(enr.groupId) ?? [];
        list.push({
          studentId: enr.studentId,
          startDate: enr.startDate,
          endDate: enr.endDate,
        });
        groupEnrollmentsMap.set(enr.groupId, list);
      }

      const progressMaps = this.buildGroupMonthProgressMaps(monthSessionRows);
      completedCountByGroupMonth = progressMaps.completedCountByGroupMonth;
      sequenceBySessionId = progressMaps.sequenceBySessionId;
    }

    const enriched = rows.map((r) => {
      const stats = statsMap.get(r.id) ?? { presentCount: 0, recordedCount: 0 };
      const candidates = groupEnrollmentsMap.get(r.groupId) ?? [];
      const enrolledStudentIds = new Set<string>();
      for (const enr of candidates) {
        if (enr.startDate <= r.sessionDate && (!enr.endDate || enr.endDate >= r.sessionDate)) {
          enrolledStudentIds.add(enr.studentId);
        }
      }
      const enrolledCount = Math.max(enrolledStudentIds.size, stats.recordedCount);
      const groupMonthKey = `${r.groupId}|${r.yearMonth}`;

      return {
        ...r,
        monthlySessionsCount: Math.max(1, Number(r.monthlySessionsCount || 4)),
        completedSessionsInMonth: completedCountByGroupMonth.get(groupMonthKey) ?? 0,
        sessionSequenceInMonth: sequenceBySessionId.get(r.id) ?? null,
        presentCount: stats.presentCount,
        recordedCount: stats.recordedCount,
        enrolledCount,
      };
    });

    return { rows: enriched, total: Number(total), page, limit };
  }

  private buildGroupMonthProgressMaps(
    rows: Array<{
      id: string;
      groupId: string;
      yearMonth: string;
      status: string;
      hasAttendance: boolean;
    }>,
  ) {
    const completedCountByGroupMonth = new Map<string, number>();
    const sequenceBySessionId = new Map<string, number>();

    for (const row of rows) {
      const isExecuted = row.status === SessionStatus.COMPLETED || Boolean(row.hasAttendance);
      if (!isExecuted) continue;

      const key = `${row.groupId}|${row.yearMonth}`;
      const nextSeq = (completedCountByGroupMonth.get(key) ?? 0) + 1;
      completedCountByGroupMonth.set(key, nextSeq);
      sequenceBySessionId.set(row.id, nextSeq);
    }

    return { completedCountByGroupMonth, sequenceBySessionId };
  }

  async getGroupMonthSessionProgress(
    groupId: string,
    yearMonth: string,
    targetSessionId: string,
  ): Promise<{
    monthlySessionsCount: number;
    completedSessionsInMonth: number;
    sessionSequenceInMonth: number | null;
  }> {
    const [[groupRow], monthSessionRows] = await Promise.all([
      this.db
        .select({ monthlySessionsCount: groups.monthlySessionsCount })
        .from(groups)
        .where(eq(groups.id, groupId))
        .limit(1),
      this.db
        .select({
          id: sessions.id,
          groupId: sessions.groupId,
          yearMonth: sessions.yearMonth,
          status: sessions.status,
          hasAttendance: sql<boolean>`EXISTS (SELECT 1 FROM attendance a WHERE a.session_id = ${sessions.id})`,
        })
        .from(sessions)
        .where(
          and(
            eq(sessions.groupId, groupId),
            eq(sessions.yearMonth, yearMonth),
            ne(sessions.status, SessionStatus.CANCELLED),
          ),
        )
        .orderBy(asc(sessions.sessionDate), asc(sessions.startTime), asc(sessions.id)),
    ]);

    const { completedCountByGroupMonth, sequenceBySessionId } =
      this.buildGroupMonthProgressMaps(monthSessionRows);

    return {
      monthlySessionsCount: Math.max(1, Number(groupRow?.monthlySessionsCount || 4)),
      completedSessionsInMonth: completedCountByGroupMonth.get(`${groupId}|${yearMonth}`) ?? 0,
      sessionSequenceInMonth: sequenceBySessionId.get(targetSessionId) ?? null,
    };
  }

  async findGroupById(groupId: string) {
    const [row] = await this.db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
    return row ?? null;
  }

  async findSessionById(sessionId: string) {
    const [row] = await this.db
      .select({
        id: sessions.id,
        groupId: sessions.groupId,
        groupName: groups.name,
        groupCode: groups.groupCode,
        subject: groups.subject,
        gradeLevel: groups.gradeLevel,
        teacherId: sessions.teacherId,
        teacherName: teachers.fullName,
        classroomId: sessions.classroomId,
        classroomName: classrooms.name,
        roomNumber: classrooms.roomNumber,
        sessionDate: sessions.sessionDate,
        yearMonth: sessions.yearMonth,
        startTime: sessions.startTime,
        endTime: sessions.endTime,
        status: sessions.status,
        topic: sessions.topic,
        notes: sessions.notes,
      })
      .from(sessions)
      .innerJoin(groups, eq(sessions.groupId, groups.id))
      .innerJoin(teachers, eq(sessions.teacherId, teachers.id))
      .leftJoin(classrooms, eq(sessions.classroomId, classrooms.id))
      .where(eq(sessions.id, sessionId))
      .limit(1);
    return row ?? null;
  }

  async createSession(input: typeof sessions.$inferInsert) {
    const [created] = await this.db.insert(sessions).values(input).returning();
    return created;
  }

  async findExistingGroupSessionsInMonth(groupId: string, yearMonth: string) {
    return this.db
      .select({ sessionDate: sessions.sessionDate, startTime: sessions.startTime })
      .from(sessions)
      .where(and(eq(sessions.groupId, groupId), eq(sessions.yearMonth, yearMonth)));
  }

  async checkSessionConflicts(params: {
    date: string;
    startTime: string;
    endTime: string;
    teacherId: string;
    classroomId?: string | null;
    excludeSessionId?: string;
  }): Promise<{ hasConflict: boolean; message?: string }> {
    // 1. Check teacher overlapping session
    const teacherOverlap = await this.db
      .select({
        id: sessions.id,
        startTime: sessions.startTime,
        endTime: sessions.endTime,
        groupName: groups.name,
      })
      .from(sessions)
      .innerJoin(groups, eq(sessions.groupId, groups.id))
      .where(
        and(
          eq(sessions.teacherId, params.teacherId),
          eq(sessions.sessionDate, params.date),
          ne(sessions.status, SessionStatus.CANCELLED),
          params.excludeSessionId ? ne(sessions.id, params.excludeSessionId) : sql`1=1`,
          lt(sessions.startTime, params.endTime),
          gt(sessions.endTime, params.startTime),
        ),
      )
      .limit(1);

    if (teacherOverlap.length > 0) {
      return {
        hasConflict: true,
        message: `تعارض في جدول المدرس: لديه حصة أخرى (${teacherOverlap[0].groupName}) من ${teacherOverlap[0].startTime} إلى ${teacherOverlap[0].endTime}`,
      };
    }

    // 2. If classroom is specified, check classroom status, maintenances, and other sessions
    if (params.classroomId) {
      const [room] = await this.db
        .select()
        .from(classrooms)
        .where(eq(classrooms.id, params.classroomId))
        .limit(1);

      if (!room) {
        return { hasConflict: true, message: 'القاعة الدراسية المحددة غير موجودة' };
      }

      if (room.status !== ClassroomStatus.AVAILABLE) {
        return {
          hasConflict: true,
          message: `القاعة (${room.name}) غير متاحة حالياً (الحالة: ${room.status === 'MAINTENANCE' ? 'تحت الصيانة' : 'غير مفعلة'})`,
        };
      }

      // Check maintenance window
      const normStart =
        params.startTime.length === 5 ? `${params.startTime}:00` : params.startTime.slice(0, 8);
      const normEnd =
        params.endTime.length === 5 ? `${params.endTime}:00` : params.endTime.slice(0, 8);
      const reqStart = new Date(`${params.date}T${normStart}`);
      const reqEnd = new Date(`${params.date}T${normEnd}`);

      const maintOverlap = await this.db
        .select({ id: classroomMaintenances.id, reason: classroomMaintenances.reason })
        .from(classroomMaintenances)
        .where(
          and(
            eq(classroomMaintenances.classroomId, params.classroomId),
            lt(classroomMaintenances.startAt, reqEnd),
            gt(classroomMaintenances.endAt, reqStart),
          ),
        )
        .limit(1);

      if (maintOverlap.length > 0) {
        return {
          hasConflict: true,
          message: `القاعة (${room.name}) في فترة صيانة مجدولة (${maintOverlap[0].reason})`,
        };
      }

      // Check overlapping session in same classroom
      const roomSessionOverlap = await this.db
        .select({
          id: sessions.id,
          startTime: sessions.startTime,
          endTime: sessions.endTime,
          groupName: groups.name,
        })
        .from(sessions)
        .innerJoin(groups, eq(sessions.groupId, groups.id))
        .where(
          and(
            eq(sessions.classroomId, params.classroomId),
            eq(sessions.sessionDate, params.date),
            ne(sessions.status, SessionStatus.CANCELLED),
            params.excludeSessionId ? ne(sessions.id, params.excludeSessionId) : sql`1=1`,
            lt(sessions.startTime, params.endTime),
            gt(sessions.endTime, params.startTime),
          ),
        )
        .limit(1);

      if (roomSessionOverlap.length > 0) {
        return {
          hasConflict: true,
          message: `القاعة (${room.name}) مشغولة بحصة (${roomSessionOverlap[0].groupName}) من ${roomSessionOverlap[0].startTime} إلى ${roomSessionOverlap[0].endTime}`,
        };
      }
    }

    return { hasConflict: false };
  }

  async insertSessionsBatch(rows: Array<typeof sessions.$inferInsert>) {
    if (rows.length === 0) return [];
    return this.db.insert(sessions).values(rows).returning();
  }

  async findStudentActiveGroupsForDate(studentId: string, sessionDate: string) {
    return this.db
      .select({
        enrollmentId: enrollments.id,
        groupId: groups.id,
        groupCode: groups.groupCode,
        groupName: groups.name,
        subject: groups.subject,
        gradeLevel: groups.gradeLevel,
        primaryTeacherId: groups.primaryTeacherId,
        teacherName: teachers.fullName,
        defaultClassroomId: groups.defaultClassroomId,
        classroomName: classrooms.name,
        roomNumber: classrooms.roomNumber,
        scheduleSlots: groups.scheduleSlots,
      })
      .from(enrollments)
      .innerJoin(groups, eq(enrollments.groupId, groups.id))
      .innerJoin(teachers, eq(groups.primaryTeacherId, teachers.id))
      .leftJoin(classrooms, eq(groups.defaultClassroomId, classrooms.id))
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.status, EnrollmentStatus.ACTIVE),
          eq(groups.isActive, true),
          lte(enrollments.startDate, sessionDate),
          or(isNull(enrollments.endDate), gte(enrollments.endDate, sessionDate))!,
        ),
      )
      .orderBy(asc(groups.name));
  }

  async findSessionsByGroupsAndDateForStudent(
    groupIds: string[],
    studentId: string,
    sessionDate: string,
  ) {
    if (groupIds.length === 0) return [];

    return this.db
      .select({
        sessionId: sessions.id,
        groupId: sessions.groupId,
        groupCode: groups.groupCode,
        groupName: groups.name,
        subject: groups.subject,
        teacherId: sessions.teacherId,
        teacherName: teachers.fullName,
        classroomId: sessions.classroomId,
        classroomName: classrooms.name,
        roomNumber: classrooms.roomNumber,
        sessionDate: sessions.sessionDate,
        yearMonth: sessions.yearMonth,
        startTime: sessions.startTime,
        endTime: sessions.endTime,
        sessionStatus: sessions.status,
        attendanceId: attendance.id,
        attendanceStatus: attendance.status,
        recordedAt: attendance.recordedAt,
      })
      .from(sessions)
      .innerJoin(groups, eq(sessions.groupId, groups.id))
      .innerJoin(teachers, eq(sessions.teacherId, teachers.id))
      .leftJoin(classrooms, eq(sessions.classroomId, classrooms.id))
      .leftJoin(
        attendance,
        and(eq(attendance.sessionId, sessions.id), eq(attendance.studentId, studentId)),
      )
      .where(
        and(
          inArray(sessions.groupId, groupIds),
          eq(sessions.sessionDate, sessionDate),
          ne(sessions.status, SessionStatus.CANCELLED),
        ),
      )
      .orderBy(asc(sessions.startTime));
  }
}
