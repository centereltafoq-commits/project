import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  SQL,
} from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../../database/database.module';
import {
  assistantDues,
  assistantMonthlyRecords,
  assistants,
  groups,
  teacherDues,
  teacherMonthlyRecords,
  teachers,
} from '../../../database/schemas';
import { normalizePagination } from '../../../common/utils/pagination.util';
import {
  AssistantRecordsQueryDto,
  TeacherRecordsQueryDto,
} from '../dto/settlement.dto';
import { parseMoney } from '../utils/money.util';

@Injectable()
export class StaffRecordsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async findTeacherRecordsPaginated(query: TeacherRecordsQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const conditions: SQL[] = [];

    if (query.yearMonth) {
      conditions.push(eq(teacherMonthlyRecords.yearMonth, query.yearMonth));
    }
    if (query.teacherId) {
      conditions.push(eq(teacherMonthlyRecords.teacherId, query.teacherId));
    }
    if (query.search) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(teachers.fullName, pattern),
          ilike(teachers.teacherCode, pattern),
          ilike(teachers.phone, pattern),
          ilike(teachers.specialization, pattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: teacherMonthlyRecords.id,
          teacherId: teacherMonthlyRecords.teacherId,
          teacherCode: teachers.teacherCode,
          teacherName: teachers.fullName,
          teacherPhone: teachers.phone,
          specialization: teachers.specialization,
          yearMonth: teacherMonthlyRecords.yearMonth,
          groupsCount: teacherMonthlyRecords.groupsCount,
          executedSessionsCount: teacherMonthlyRecords.executedSessionsCount,
          totalDues: teacherMonthlyRecords.totalDues,
          totalPaidOut: teacherMonthlyRecords.totalPaidOut,
          remainingBalance: teacherMonthlyRecords.remainingBalance,
          isClosed: teacherMonthlyRecords.isClosed,
          updatedAt: teacherMonthlyRecords.updatedAt,
        })
        .from(teacherMonthlyRecords)
        .innerJoin(teachers, eq(teachers.id, teacherMonthlyRecords.teacherId))
        .where(whereClause)
        .orderBy(desc(teacherMonthlyRecords.remainingBalance), teachers.fullName)
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(teacherMonthlyRecords)
        .innerJoin(teachers, eq(teachers.id, teacherMonthlyRecords.teacherId))
        .where(whereClause),
    ]);

    const teacherIds = [...new Set(rows.map((r) => r.teacherId))];
    const months = [...new Set(rows.map((r) => r.yearMonth))];
    const duesRows =
      teacherIds.length > 0
        ? await this.db
            .select({
              teacherId: teacherDues.teacherId,
              yearMonth: teacherDues.yearMonth,
              groupId: teacherDues.groupId,
              groupName: groups.name,
              groupCode: groups.groupCode,
              executedSessionsCount: teacherDues.executedSessionsCount,
              studentsCount: teacherDues.studentsCount,
              grossGroupRevenue: teacherDues.grossGroupRevenue,
              teacherAmount: teacherDues.teacherAmount,
              centerAmount: teacherDues.centerAmount,
              calculationBreakdown: teacherDues.calculationBreakdown,
            })
            .from(teacherDues)
            .innerJoin(groups, eq(groups.id, teacherDues.groupId))
            .where(
              and(
                inArray(teacherDues.teacherId, teacherIds),
                inArray(teacherDues.yearMonth, months),
              ),
            )
        : [];

    const mapped = rows.map((r) => ({
      ...r,
      totalDues: parseMoney(r.totalDues),
      totalPaidOut: parseMoney(r.totalPaidOut),
      remainingBalance: parseMoney(r.remainingBalance),
      groupBreakdown: duesRows
        .filter((d) => d.teacherId === r.teacherId && d.yearMonth === r.yearMonth)
        .map((d) => ({
          ...d,
          grossGroupRevenue: parseMoney(d.grossGroupRevenue),
          teacherAmount: parseMoney(d.teacherAmount),
          centerAmount: parseMoney(d.centerAmount),
        })),
    }));

    return { rows: mapped, total: Number(total), page, limit };
  }

  async findAssistantRecordsPaginated(query: AssistantRecordsQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const conditions: SQL[] = [];

    if (query.yearMonth) {
      conditions.push(eq(assistantMonthlyRecords.yearMonth, query.yearMonth));
    }
    if (query.assistantId) {
      conditions.push(eq(assistantMonthlyRecords.assistantId, query.assistantId));
    }
    if (query.search) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(assistants.fullName, pattern),
          ilike(assistants.assistantCode, pattern),
          ilike(assistants.phone, pattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: assistantMonthlyRecords.id,
          assistantId: assistantMonthlyRecords.assistantId,
          assistantCode: assistants.assistantCode,
          assistantName: assistants.fullName,
          assistantPhone: assistants.phone,
          yearMonth: assistantMonthlyRecords.yearMonth,
          calculationMethodSnapshot: assistantMonthlyRecords.calculationMethodSnapshot,
          totalDues: assistantMonthlyRecords.totalDues,
          totalPaidOut: assistantMonthlyRecords.totalPaidOut,
          remainingBalance: assistantMonthlyRecords.remainingBalance,
          detailsNote: assistantMonthlyRecords.detailsNote,
          isClosed: assistantMonthlyRecords.isClosed,
          updatedAt: assistantMonthlyRecords.updatedAt,
        })
        .from(assistantMonthlyRecords)
        .innerJoin(assistants, eq(assistants.id, assistantMonthlyRecords.assistantId))
        .where(whereClause)
        .orderBy(desc(assistantMonthlyRecords.remainingBalance), assistants.fullName)
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: count() })
        .from(assistantMonthlyRecords)
        .innerJoin(assistants, eq(assistants.id, assistantMonthlyRecords.assistantId))
        .where(whereClause),
    ]);

    const assistantIds = [...new Set(rows.map((r) => r.assistantId))];
    const months = [...new Set(rows.map((r) => r.yearMonth))];
    const duesRows =
      assistantIds.length > 0
        ? await this.db
            .select({
              assistantId: assistantDues.assistantId,
              yearMonth: assistantDues.yearMonth,
              groupId: assistantDues.groupId,
              groupName: groups.name,
              calculationMethod: assistantDues.calculationMethod,
              sessionsCount: assistantDues.sessionsCount,
              studentsCount: assistantDues.studentsCount,
              amount: assistantDues.amount,
              calculationBreakdown: assistantDues.calculationBreakdown,
            })
            .from(assistantDues)
            .leftJoin(groups, eq(groups.id, assistantDues.groupId))
            .where(
              and(
                inArray(assistantDues.assistantId, assistantIds),
                inArray(assistantDues.yearMonth, months),
              ),
            )
        : [];

    const mapped = rows.map((r) => ({
      ...r,
      totalDues: parseMoney(r.totalDues),
      totalPaidOut: parseMoney(r.totalPaidOut),
      remainingBalance: parseMoney(r.remainingBalance),
      duesBreakdown: duesRows
        .filter((d) => d.assistantId === r.assistantId && d.yearMonth === r.yearMonth)
        .map((d) => ({ ...d, amount: parseMoney(d.amount) })),
    }));

    return { rows: mapped, total: Number(total), page, limit };
  }
}
