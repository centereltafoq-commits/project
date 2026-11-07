import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  gt,
  ilike,
  or,
  SQL,
} from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../../database/database.module';
import {
  groups,
  studentMonthlyRecords,
  students,
} from '../../../database/schemas';
import { normalizePagination } from '../../../common/utils/pagination.util';
import { StudentRecordsQueryDto } from '../dto/settlement.dto';
import { parseMoney } from '../utils/money.util';

@Injectable()
export class StudentRecordsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async findStudentRecordsPaginated(query: StudentRecordsQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const conditions: SQL[] = [];

    if (query.yearMonth) {
      conditions.push(eq(studentMonthlyRecords.yearMonth, query.yearMonth));
    }
    if (query.groupId) {
      conditions.push(eq(studentMonthlyRecords.groupId, query.groupId));
    }
    if (query.studentId) {
      conditions.push(eq(studentMonthlyRecords.studentId, query.studentId));
    }
    if (query.onlyUnpaid) {
      conditions.push(gt(studentMonthlyRecords.remainingBalance, '0.00'));
    }
    if (query.search) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(students.fullName, pattern),
          ilike(students.studentCode, pattern),
          ilike(students.phone, pattern),
          ilike(groups.name, pattern),
          ilike(groups.groupCode, pattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: studentMonthlyRecords.id,
          studentId: studentMonthlyRecords.studentId,
          studentCode: students.studentCode,
          studentName: students.fullName,
          studentPhone: students.phone,
          guardianPhone: students.guardianPhone,
          groupId: studentMonthlyRecords.groupId,
          groupCode: groups.groupCode,
          groupName: groups.name,
          yearMonth: studentMonthlyRecords.yearMonth,
          totalGroupSessions: studentMonthlyRecords.totalGroupSessions,
          eligibleSessions: studentMonthlyRecords.eligibleSessions,
          presentCount: studentMonthlyRecords.presentCount,
          absentCount: studentMonthlyRecords.absentCount,
          excusedCount: studentMonthlyRecords.excusedCount,
          makeupAttendedCount: studentMonthlyRecords.makeupAttendedCount,
          sessionPriceSnapshot: studentMonthlyRecords.sessionPriceSnapshot,
          extraMakeupFees: studentMonthlyRecords.extraMakeupFees,
          totalDue: studentMonthlyRecords.totalDue,
          totalPaid: studentMonthlyRecords.totalPaid,
          remainingBalance: studentMonthlyRecords.remainingBalance,
          isClosed: studentMonthlyRecords.isClosed,
          closedAt: studentMonthlyRecords.closedAt,
          updatedAt: studentMonthlyRecords.updatedAt,
        })
        .from(studentMonthlyRecords)
        .innerJoin(students, eq(students.id, studentMonthlyRecords.studentId))
        .innerJoin(groups, eq(groups.id, studentMonthlyRecords.groupId))
        .where(whereClause)
        .orderBy(desc(studentMonthlyRecords.remainingBalance), students.fullName)
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(studentMonthlyRecords)
        .innerJoin(students, eq(students.id, studentMonthlyRecords.studentId))
        .innerJoin(groups, eq(groups.id, studentMonthlyRecords.groupId))
        .where(whereClause),
    ]);

    const mapped = rows.map((r) => ({
      ...r,
      sessionPriceSnapshot: parseMoney(r.sessionPriceSnapshot),
      extraMakeupFees: parseMoney(r.extraMakeupFees),
      totalDue: parseMoney(r.totalDue),
      totalPaid: parseMoney(r.totalPaid),
      remainingBalance: parseMoney(r.remainingBalance),
    }));

    return { rows: mapped, total: Number(total), page, limit };
  }
}
