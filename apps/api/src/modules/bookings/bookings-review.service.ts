import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { BookingStatus, PERMISSIONS, SystemRole } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CacheService } from '../../common/cache/cache.module';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { BookingsRepository } from './bookings.repository';
import {
  AvailableClassroomsQueryDto,
  CancelBookingDto,
  ReviewBookingDto,
} from './dto/booking.dto';
import { computeDurationMinutes } from './validators/booking-series.helper';
import { ScheduleConflictChecker } from './validators/schedule-conflict.checker';

@Injectable()
export class BookingsReviewService {
  constructor(
    private readonly repository: BookingsRepository,
    private readonly conflictChecker: ScheduleConflictChecker,
    private readonly audit: AuditLogsService,
    @Optional() private readonly cache?: CacheService,
  ) {}

  private async invalidateCaches() {
    try {
      await Promise.all([
        this.cache?.invalidatePrefix('dashboard:summary:'),
        this.cache?.invalidatePrefix('reports:'),
      ]);
    } catch {}
  }

  async getAvailableClassrooms(
    bookingId: string,
    query: AvailableClassroomsQueryDto,
    actor?: AuthenticatedUser,
  ) {
    const booking = await this.repository.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('طلب الحجز غير موجود');
    }

    const isOwner = !actor || actor.roleCode === SystemRole.OWNER;
    const perms = actor?.permissions ?? [];
    const canSeeClassrooms =
      isOwner ||
      perms.includes(PERMISSIONS.CLASSROOMS_VIEW) ||
      perms.includes(PERMISSIONS.CLASSROOMS_MANAGE) ||
      perms.includes(PERMISSIONS.BOOKINGS_APPROVE_ADMIN);

    const effectiveDate = query.date ?? booking.requestedDate;
    const effectiveStart = query.startTime ?? booking.startTime;
    const effectiveEnd = query.endTime ?? booking.endTime;
    const effectiveAttendees = query.expectedAttendees ?? booking.expectedAttendees;

    const [roomsResult, participantConflicts] = await Promise.all([
      canSeeClassrooms
        ? this.conflictChecker.evaluateAvailableClassrooms({
            date: effectiveDate,
            startTime: effectiveStart,
            endTime: effectiveEnd,
            expectedAttendees: effectiveAttendees,
            excludeBookingId: booking.id,
          })
        : Promise.resolve({ availableClassrooms: [], unavailableClassrooms: [] }),
      this.conflictChecker.checkConflicts({
        excludeBookingId: booking.id,
        date: effectiveDate,
        startTime: effectiveStart,
        endTime: effectiveEnd,
        teacherId: booking.teacherId,
        studentId: booking.studentId,
        classroomId: null,
        expectedAttendees: effectiveAttendees,
      }),
    ]);

    return {
      bookingId: booking.id,
      date: effectiveDate,
      startTime: effectiveStart,
      endTime: effectiveEnd,
      expectedAttendees: effectiveAttendees,
      participantConflicts: participantConflicts.conflicts,
      ...roomsResult,
    };
  }

  async review(id: string, dto: ReviewBookingDto, actor: AuthenticatedUser) {
    const isAdmin =
      actor.roleCode === SystemRole.OWNER ||
      actor.permissions.includes(PERMISSIONS.BOOKINGS_APPROVE_ADMIN);
    const isTeacherApprover = actor.permissions.includes(
      PERMISSIONS.BOOKINGS_APPROVE_TEACHER,
    );

    if (!isAdmin && !isTeacherApprover) {
      throw new ForbiddenException('ليس لديك صلاحية مراجعة أو اعتماد طلبات الحجز');
    }

    if (dto.assignedClassroomId !== undefined && !isAdmin) {
      throw new ForbiddenException('تخصيص القاعات الدراسية متاح للإدارة فقط');
    }

    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('طلب الحجز غير موجود');
    }

    if (!isAdmin && isTeacherApprover) {
      const teacher = await this.repository.findTeacherById(existing.teacherId);
      if (teacher?.userId && teacher.userId !== actor.id) {
        throw new ForbiddenException('يمكن للمدرس مراجعة طلبات الحجز الخاصة به فقط');
      }
      if (teacher?.canApproveBookings === 'false') {
        throw new ForbiddenException('صلاحية اعتماد الحجوزات متوقفة لهذا المدرس');
      }
    }

    const effectiveDate = dto.requestedDate ?? existing.requestedDate;
    const effectiveStart = dto.startTime ?? existing.startTime;
    const effectiveEnd = dto.endTime ?? existing.endTime;
    const durationMinutes = computeDurationMinutes(effectiveStart, effectiveEnd);
    const effectiveAttendees = dto.expectedAttendees ?? existing.expectedAttendees;
    const effectiveClassroomId =
      dto.assignedClassroomId !== undefined
        ? dto.assignedClassroomId
        : existing.assignedClassroomId;

    const isModified =
      effectiveDate !== existing.requestedDate ||
      effectiveStart !== existing.startTime ||
      effectiveEnd !== existing.endTime ||
      effectiveClassroomId !== existing.assignedClassroomId;

    if (dto.status === BookingStatus.CONFIRMED) {
      await this.conflictChecker.assertNoConflicts({
        excludeBookingId: existing.id,
        date: effectiveDate,
        startTime: effectiveStart,
        endTime: effectiveEnd,
        teacherId: existing.teacherId,
        studentId: existing.studentId,
        classroomId: effectiveClassroomId,
        expectedAttendees: effectiveAttendees,
      });
    }

    const decision =
      dto.status === BookingStatus.REJECTED
        ? 'REJECTED'
        : isModified
          ? 'MODIFIED'
          : 'APPROVED';

    const updated = await this.repository.applyReviewDecision({
      bookingId: id,
      actorUserId: actor.id,
      decision,
      comment: dto.comment,
      updates: {
        status: dto.status,
        requestedDate: effectiveDate,
        startTime: effectiveStart,
        endTime: effectiveEnd,
        durationMinutes,
        expectedAttendees: effectiveAttendees,
        assignedClassroomId:
          dto.status === BookingStatus.CONFIRMED ? effectiveClassroomId : null,
      },
      classroomAllocation:
        dto.status === BookingStatus.CONFIRMED && effectiveClassroomId
          ? {
              classroomId: effectiveClassroomId,
              bookingDate: effectiveDate,
              startTime: effectiveStart,
              endTime: effectiveEnd,
              title: existing.purpose,
            }
          : null,
    });

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: `REVIEW_BOOKING_${dto.status}`,
      entityType: 'BOOKING_REQUEST',
      entityId: id,
      beforeData: existing,
      afterData: updated,
    });

    await this.invalidateCaches();
    return updated;
  }

  async cancelSingle(id: string, dto: CancelBookingDto, actor: AuthenticatedUser) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('طلب الحجز غير موجود');
    }
    if (existing.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('هذا الموعد ملغي بالفعل');
    }

    const isAdmin =
      actor.roleCode === SystemRole.OWNER ||
      actor.permissions.includes(PERMISSIONS.BOOKINGS_APPROVE_ADMIN);
    if (!isAdmin) {
      const teacher = await this.repository.findTeacherById(existing.teacherId);
      const isOwnTeacher = Boolean(teacher?.userId && teacher.userId === actor.id);
      const isRequester = existing.createdByUserId === actor.id;
      if (!isOwnTeacher && !isRequester) {
        throw new ForbiddenException('لا يمكنك إلغاء حجز لا يخصك');
      }
    }

    const updated = await this.repository.cancelSingleOccurrence(id, actor.id, dto.comment);

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'CANCEL_SINGLE_BOOKING',
      entityType: 'BOOKING_REQUEST',
      entityId: id,
      beforeData: existing,
      afterData: updated,
    });

    await this.invalidateCaches();
    return updated;
  }

  async complete(id: string, actor: AuthenticatedUser) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException('طلب الحجز غير موجود');
    }
    if (existing.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('لا يمكن إكمال سوى الحجوزات المؤكدة');
    }

    const isAdmin =
      actor.roleCode === SystemRole.OWNER ||
      actor.permissions.includes(PERMISSIONS.BOOKINGS_APPROVE_ADMIN);
    if (!isAdmin) {
      const teacher = await this.repository.findTeacherById(existing.teacherId);
      if (!teacher?.userId || teacher.userId !== actor.id) {
        throw new ForbiddenException('يمكن للمدرس إكمال حجوزاته الخاصة فقط');
      }
    }

    const updated = await this.repository.markCompleted(id);

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'COMPLETE_BOOKING',
      entityType: 'BOOKING_REQUEST',
      entityId: id,
      beforeData: existing,
      afterData: updated,
    });

    await this.invalidateCaches();
    return updated;
  }
}
