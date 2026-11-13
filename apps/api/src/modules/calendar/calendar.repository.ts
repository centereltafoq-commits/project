import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, lte, ne, SQL } from 'drizzle-orm';
import { SessionStatus } from '@edu-center/shared';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  classroomMaintenances,
  classrooms,
  groups,
  sessions,
  teachers,
} from '../../database/schemas';

@Injectable()
export class CalendarRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async fetchUnifiedRangeData(params: {
    fromDate: string;
    toDate: string;
    rangeStartUtc: Date;
    rangeEndUtc: Date;
    teacherId?: string;
    classroomId?: string;
  }) {
    const sessionConditions: SQL[] = [
      gte(sessions.sessionDate, params.fromDate),
      lte(sessions.sessionDate, params.toDate),
      ne(sessions.status, SessionStatus.CANCELLED),
    ];
    if (params.teacherId) sessionConditions.push(eq(sessions.teacherId, params.teacherId));
    if (params.classroomId) {
      sessionConditions.push(eq(sessions.classroomId, params.classroomId));
    }

    const maintConditions: SQL[] = [
      lte(classroomMaintenances.startAt, params.rangeEndUtc),
      gte(classroomMaintenances.endAt, params.rangeStartUtc),
    ];
    if (params.classroomId) {
      maintConditions.push(eq(classroomMaintenances.classroomId, params.classroomId));
    }

    const [
      groupSessions,
      maintenances,
      allClassrooms,
      allTeachers,
    ] = await Promise.all([
      this.db
        .select({
          id: sessions.id,
          sessionDate: sessions.sessionDate,
          startTime: sessions.startTime,
          endTime: sessions.endTime,
          status: sessions.status,
          topic: sessions.topic,
          groupId: groups.id,
          groupName: groups.name,
          groupCode: groups.groupCode,
          subject: groups.subject,
          teacherId: teachers.id,
          teacherName: teachers.fullName,
          classroomId: classrooms.id,
          classroomName: classrooms.name,
          roomNumber: classrooms.roomNumber,
        })
        .from(sessions)
        .innerJoin(groups, eq(sessions.groupId, groups.id))
        .innerJoin(teachers, eq(sessions.teacherId, teachers.id))
        .leftJoin(classrooms, eq(sessions.classroomId, classrooms.id))
        .where(and(...sessionConditions))
        .orderBy(asc(sessions.sessionDate), asc(sessions.startTime)),
      this.db
        .select({
          id: classroomMaintenances.id,
          startAt: classroomMaintenances.startAt,
          endAt: classroomMaintenances.endAt,
          reason: classroomMaintenances.reason,
          classroomId: classrooms.id,
          classroomName: classrooms.name,
          roomNumber: classrooms.roomNumber,
        })
        .from(classroomMaintenances)
        .innerJoin(classrooms, eq(classroomMaintenances.classroomId, classrooms.id))
        .where(and(...maintConditions)),
      this.db
        .select({
          id: classrooms.id,
          roomNumber: classrooms.roomNumber,
          name: classrooms.name,
          maxCapacity: classrooms.maxCapacity,
          status: classrooms.status,
        })
        .from(classrooms)
        .orderBy(asc(classrooms.roomNumber)),
      this.db
        .select({
          id: teachers.id,
          fullName: teachers.fullName,
          specialization: teachers.specialization,
        })
        .from(teachers)
        .orderBy(asc(teachers.fullName)),
    ]);

    return {
      groupSessions,
      maintenances,
      allClassrooms,
      allTeachers,
    };
  }
}
