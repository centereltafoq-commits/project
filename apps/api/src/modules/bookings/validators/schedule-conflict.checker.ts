import { ConflictException, Injectable } from '@nestjs/common';
import { ClassroomStatus } from '@edu-center/shared';
import { BookingsConflictRepository } from '../bookings-conflict.repository';
import { computeDurationMinutes, isTimeOverlapping } from './booking-series.helper';

export type ConflictRuleCode =
  | 'TEACHER_CONFLICT'
  | 'STUDENT_CONFLICT'
  | 'CLASSROOM_UNAVAILABLE'
  | 'CLASSROOM_OCCUPIED'
  | 'CLASSROOM_CAPACITY_EXCEEDED';

export interface ConflictDetail {
  rule: ConflictRuleCode;
  message: string;
}

export interface CheckBookingConflictInput {
  excludeBookingId?: string;
  date: string;
  startTime: string;
  endTime: string;
  teacherId: string;
  studentId?: string | null;
  classroomId?: string | null;
  expectedAttendees: number;
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflicts: ConflictDetail[];
}

function buildUtcDateTime(date: string, hhmm: string): Date {
  const normalized = hhmm.length === 5 ? `${hhmm}:00` : hhmm;
  return new Date(`${date}T${normalized}Z`);
}

@Injectable()
export class ScheduleConflictChecker {
  constructor(private readonly conflictRepo: BookingsConflictRepository) {}

  async checkConflicts(input: CheckBookingConflictInput): Promise<ConflictCheckResult> {
    computeDurationMinutes(input.startTime, input.endTime);

    const ctx = await this.conflictRepo.fetchConflictContext({
      date: input.date,
      teacherId: input.teacherId,
      studentId: input.studentId,
      classroomId: input.classroomId,
    });

    const conflicts: ConflictDetail[] = [];

    // Rule 1: Teacher has no overlapping confirmed booking or scheduled group session
    for (const b of ctx.teacherConfirmedBookings) {
      if (input.excludeBookingId && b.id === input.excludeBookingId) continue;
      if (isTimeOverlapping(input.startTime, input.endTime, b.startTime, b.endTime)) {
        conflicts.push({
          rule: 'TEACHER_CONFLICT',
          message: `تعارض في جدول المدرس: لديه حجز مؤكد (${b.label}) من ${b.startTime} إلى ${b.endTime}`,
        });
      }
    }
    for (const s of ctx.teacherSessions) {
      if (isTimeOverlapping(input.startTime, input.endTime, s.startTime, s.endTime)) {
        conflicts.push({
          rule: 'TEACHER_CONFLICT',
          message: `تعارض في جدول المدرس: لديه حصة مجموعة (${s.label}) من ${s.startTime} إلى ${s.endTime}`,
        });
      }
    }

    // Rule 2: Student has no overlapping confirmed booking or active enrolled group session
    if (input.studentId) {
      for (const b of ctx.studentConfirmedBookings) {
        if (input.excludeBookingId && b.id === input.excludeBookingId) continue;
        if (isTimeOverlapping(input.startTime, input.endTime, b.startTime, b.endTime)) {
          conflicts.push({
            rule: 'STUDENT_CONFLICT',
            message: `تعارض في جدول الطالب: لديه حجز مؤكد (${b.label}) من ${b.startTime} إلى ${b.endTime}`,
          });
        }
      }
      for (const s of ctx.studentGroupSessions) {
        if (isTimeOverlapping(input.startTime, input.endTime, s.startTime, s.endTime)) {
          conflicts.push({
            rule: 'STUDENT_CONFLICT',
            message: `تعارض في جدول الطالب: لديه حصة دراسية بالمجموعة (${s.label}) من ${s.startTime} إلى ${s.endTime}`,
          });
        }
      }
    }

    // Rules 3, 4 & 5: Classroom status/maintenance, occupancy, and maxCapacity
    if (input.classroomId) {
      if (!ctx.classroom) {
        conflicts.push({
          rule: 'CLASSROOM_UNAVAILABLE',
          message: 'القاعة الدراسية المحددة غير موجودة',
        });
      } else {
        // Rule 3a: Status check (not MAINTENANCE / INACTIVE)
        if (
          ctx.classroom.status === ClassroomStatus.MAINTENANCE ||
          ctx.classroom.status === ClassroomStatus.INACTIVE ||
          ctx.classroom.status !== ClassroomStatus.AVAILABLE
        ) {
          conflicts.push({
            rule: 'CLASSROOM_UNAVAILABLE',
            message: `القاعة (${ctx.classroom.name}) غير متاحة حالياً (الحالة: ${ctx.classroom.status})`,
          });
        }

        // Rule 3b: Maintenance window overlap
        const reqStart = buildUtcDateTime(input.date, input.startTime).getTime();
        const reqEnd = buildUtcDateTime(input.date, input.endTime).getTime();
        for (const m of ctx.classroomMaintenances) {
          if (m.startAt.getTime() < reqEnd && m.endAt.getTime() > reqStart) {
            conflicts.push({
              rule: 'CLASSROOM_UNAVAILABLE',
              message: `القاعة (${ctx.classroom.name}) في فترة صيانة مجدولة (${m.reason})`,
            });
          }
        }

        // Rule 4a: Overlapping classroom_bookings
        for (const cb of ctx.classroomBookings) {
          if (input.excludeBookingId && cb.bookingRequestId === input.excludeBookingId) {
            continue;
          }
          if (isTimeOverlapping(input.startTime, input.endTime, cb.startTime, cb.endTime)) {
            conflicts.push({
              rule: 'CLASSROOM_OCCUPIED',
              message: `القاعة (${ctx.classroom.name}) محجوزة لموعد آخر (${cb.label}) من ${cb.startTime} إلى ${cb.endTime}`,
            });
          }
        }

        // Rule 4b: Overlapping group sessions in that classroom
        for (const cs of ctx.classroomSessions) {
          if (isTimeOverlapping(input.startTime, input.endTime, cs.startTime, cs.endTime)) {
            conflicts.push({
              rule: 'CLASSROOM_OCCUPIED',
              message: `القاعة (${ctx.classroom.name}) مشغولة بحصة المجموعة (${cs.label}) من ${cs.startTime} إلى ${cs.endTime}`,
            });
          }
        }

        // Rule 5: Expected attendees <= classroom.maxCapacity
        if (input.expectedAttendees > ctx.classroom.maxCapacity) {
          conflicts.push({
            rule: 'CLASSROOM_CAPACITY_EXCEEDED',
            message: `عدد الحضور المتوقع (${input.expectedAttendees}) يتجاوز السعة القصوى للقاعة (${ctx.classroom.maxCapacity})`,
          });
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
    };
  }

  async assertNoConflicts(input: CheckBookingConflictInput): Promise<void> {
    const result = await this.checkConflicts(input);
    if (result.hasConflict) {
      throw new ConflictException({
        message: result.conflicts[0].message,
        conflicts: result.conflicts,
      });
    }
  }

  async evaluateAvailableClassrooms(params: {
    date: string;
    startTime: string;
    endTime: string;
    expectedAttendees: number;
    excludeBookingId?: string;
  }) {
    computeDurationMinutes(params.startTime, params.endTime);

    const { allClassrooms, maintenances, roomBookings, roomSessions } =
      await this.conflictRepo.fetchAllClassroomsDayContext(params.date);

    const reqStart = buildUtcDateTime(params.date, params.startTime).getTime();
    const reqEnd = buildUtcDateTime(params.date, params.endTime).getTime();

    const availableClassrooms: typeof allClassrooms = [];
    const unavailableClassrooms: Array<
      (typeof allClassrooms)[number] & { reasons: string[] }
    > = [];

    for (const room of allClassrooms) {
      const reasons: string[] = [];

      if (room.status !== ClassroomStatus.AVAILABLE) {
        reasons.push(
          room.status === ClassroomStatus.MAINTENANCE ? 'القاعة في وضع صيانة' : 'القاعة غير نشطة',
        );
      }

      if (params.expectedAttendees > room.maxCapacity) {
        reasons.push(`السعة القصوى (${room.maxCapacity}) أقل من العدد المطلوب (${params.expectedAttendees})`);
      }

      for (const m of maintenances) {
        if (
          m.classroomId === room.id &&
          m.startAt.getTime() < reqEnd &&
          m.endAt.getTime() > reqStart
        ) {
          reasons.push(`صيانة مجدولة: ${m.reason}`);
        }
      }

      for (const cb of roomBookings) {
        if (cb.classroomId !== room.id) continue;
        if (params.excludeBookingId && cb.bookingRequestId === params.excludeBookingId) continue;
        if (isTimeOverlapping(params.startTime, params.endTime, cb.startTime, cb.endTime)) {
          reasons.push(`محجوزة (${cb.title}: ${cb.startTime}-${cb.endTime})`);
        }
      }

      for (const rs of roomSessions) {
        if (rs.classroomId !== room.id) continue;
        if (isTimeOverlapping(params.startTime, params.endTime, rs.startTime, rs.endTime)) {
          reasons.push(`مشغولة بحصة (${rs.groupName}: ${rs.startTime}-${rs.endTime})`);
        }
      }

      if (reasons.length === 0) {
        availableClassrooms.push(room);
      } else {
        unavailableClassrooms.push({ ...room, reasons });
      }
    }

    return { availableClassrooms, unavailableClassrooms };
  }
}
