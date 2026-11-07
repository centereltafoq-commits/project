import { Injectable } from '@nestjs/common';
import { BookingStatus } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { BookingsRepository } from './bookings.repository';
import {
  BookingQueryDto,
  CreateBookingDto,
  CreateBookingSeriesDto,
} from './dto/booking.dto';
import {
  assertValidBookingParticipant,
  computeDurationMinutes,
  generateSeriesOccurrenceDates,
} from './validators/booking-series.helper';
import { ScheduleConflictChecker } from './validators/schedule-conflict.checker';

@Injectable()
export class BookingsService {
  constructor(
    private readonly repository: BookingsRepository,
    private readonly conflictChecker: ScheduleConflictChecker,
    private readonly audit: AuditLogsService,
  ) {}

  async getLookups() {
    return this.repository.getLookups();
  }

  async list(query: BookingQueryDto) {
    const { rows, total, page, limit } = await this.repository.findPaginated(query);
    return createPaginatedResult(rows, total, page, limit);
  }

  async createOneTime(dto: CreateBookingDto, actor: AuthenticatedUser) {
    assertValidBookingParticipant(dto.requestType, dto.studentId);
    const durationMinutes = computeDurationMinutes(dto.startTime, dto.endTime);
    const expectedAttendees = dto.expectedAttendees ?? 1;

    const created = await this.repository.createSingle({
      requestType: dto.requestType,
      teacherId: dto.teacherId,
      studentId: dto.studentId ?? null,
      purpose: dto.purpose,
      requestedDate: dto.requestedDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      durationMinutes,
      requestedClassroomId: dto.requestedClassroomId ?? null,
      assignedClassroomId: null,
      expectedAttendees,
      status: BookingStatus.PENDING,
      createdByUserId: actor.id,
      notes: dto.notes ?? null,
    });

    const conflictPreview = await this.conflictChecker.checkConflicts({
      excludeBookingId: created.id,
      date: created.requestedDate,
      startTime: created.startTime,
      endTime: created.endTime,
      teacherId: created.teacherId,
      studentId: created.studentId,
      classroomId: created.requestedClassroomId,
      expectedAttendees: created.expectedAttendees,
    });

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'CREATE_BOOKING_REQUEST',
      entityType: 'BOOKING_REQUEST',
      entityId: created.id,
      afterData: created,
    });

    return { ...created, ...conflictPreview };
  }

  async createSeries(dto: CreateBookingSeriesDto, actor: AuthenticatedUser) {
    assertValidBookingParticipant(dto.requestType, dto.studentId);
    const durationMinutes = computeDurationMinutes(dto.startTime, dto.endTime);
    const dates = generateSeriesOccurrenceDates(dto.startDate, dto.endDate, dto.dayOfWeek);
    const expectedAttendees = dto.expectedAttendees ?? 1;

    const { series, occurrences } = await this.repository.createSeriesWithOccurrences(
      {
        requestType: dto.requestType,
        teacherId: dto.teacherId,
        studentId: dto.studentId ?? null,
        dayOfWeek: dto.dayOfWeek,
        startDate: dto.startDate,
        endDate: dto.endDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        purpose: dto.purpose,
        requestedClassroomId: dto.requestedClassroomId ?? null,
        createdByUserId: actor.id,
        notes: dto.notes ?? null,
      },
      dates.map((requestedDate) => ({
        requestType: dto.requestType,
        teacherId: dto.teacherId,
        studentId: dto.studentId ?? null,
        purpose: dto.purpose,
        requestedDate,
        startTime: dto.startTime,
        endTime: dto.endTime,
        durationMinutes,
        requestedClassroomId: dto.requestedClassroomId ?? null,
        assignedClassroomId: null,
        expectedAttendees,
        status: BookingStatus.PENDING,
        createdByUserId: actor.id,
        notes: dto.notes ?? null,
      })),
    );

    const evaluatedOccurrences = await Promise.all(
      occurrences.map(async (occ) => {
        const check = await this.conflictChecker.checkConflicts({
          excludeBookingId: occ.id,
          date: occ.requestedDate,
          startTime: occ.startTime,
          endTime: occ.endTime,
          teacherId: occ.teacherId,
          studentId: occ.studentId,
          classroomId: occ.requestedClassroomId,
          expectedAttendees: occ.expectedAttendees,
        });
        return { ...occ, hasConflict: check.hasConflict, conflicts: check.conflicts };
      }),
    );

    const conflictsCount = evaluatedOccurrences.filter((o) => o.hasConflict).length;

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'CREATE_BOOKING_SERIES',
      entityType: 'BOOKING_SERIES',
      entityId: series.id,
      afterData: {
        seriesId: series.id,
        occurrencesCount: evaluatedOccurrences.length,
        conflictsCount,
      },
    });

    return {
      series,
      occurrencesCount: evaluatedOccurrences.length,
      conflictsCount,
      occurrences: evaluatedOccurrences,
    };
  }
}
