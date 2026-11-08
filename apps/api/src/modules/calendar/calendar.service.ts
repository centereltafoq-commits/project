import { Injectable } from '@nestjs/common';
import { BookingStatus, ClassroomStatus, PERMISSIONS, SystemRole } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CalendarRepository } from './calendar.repository';
import { CalendarEventsQueryDto } from './dto/calendar-query.dto';
import {
  expandMaintenanceDays,
  resolveAndValidateCalendarRange,
} from './validators/calendar-range.validator';

export type CalendarEventCategory =
  | 'GROUP_SESSION'
  | 'PENDING_BOOKING'
  | 'CONFIRMED_BOOKING'
  | 'CLASSROOM_MAINTENANCE';

export interface UnifiedCalendarEvent {
  id: string;
  sourceId: string;
  category: CalendarEventCategory;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  subtitle: string;
  status: string;
  teacherId?: string | null;
  teacherName?: string | null;
  studentName?: string | null;
  classroomId?: string | null;
  classroomName?: string | null;
  roomNumber?: string | null;
}

@Injectable()
export class CalendarService {
  constructor(private readonly repository: CalendarRepository) {}

  async getEvents(query: CalendarEventsQueryDto, actor?: AuthenticatedUser) {
    const isOwner = !actor || actor.roleCode === SystemRole.OWNER;
    const perms = actor?.permissions ?? [];
    const canViewBookings = isOwner || perms.includes(PERMISSIONS.BOOKINGS_VIEW);
    const canViewClassrooms = isOwner || perms.includes(PERMISSIONS.CLASSROOMS_VIEW);
    const canViewTeachers = isOwner || perms.includes(PERMISSIONS.TEACHERS_VIEW);

    const { fromDate, toDate, rangeStartUtc, rangeEndUtc } = resolveAndValidateCalendarRange(
      query.from,
      query.to,
    );

    const data = await this.repository.fetchUnifiedRangeData({
      fromDate,
      toDate,
      rangeStartUtc,
      rangeEndUtc,
      teacherId: canViewTeachers ? query.teacherId : undefined,
      classroomId: canViewClassrooms ? query.classroomId : undefined,
    });

    const events: UnifiedCalendarEvent[] = [];
    const occupiedRoomIds = new Set<string>();
    const maintenanceRoomIds = new Set<string>();
    const eventsCountByRoom = new Map<string, number>();

    const incrementRoomEvents = (roomId?: string | null) => {
      if (!roomId) return;
      eventsCountByRoom.set(roomId, (eventsCountByRoom.get(roomId) ?? 0) + 1);
    };

    for (const s of data.groupSessions) {
      if (s.classroomId) occupiedRoomIds.add(s.classroomId);
      incrementRoomEvents(s.classroomId);

      events.push({
        id: `session-${s.id}`,
        sourceId: s.id,
        category: 'GROUP_SESSION',
        date: s.sessionDate,
        startTime: s.startTime,
        endTime: s.endTime,
        title: `${s.groupName} (${s.subject})`,
        subtitle: s.topic ? `${s.teacherName} — ${s.topic}` : s.teacherName,
        status: s.status,
        teacherId: s.teacherId,
        teacherName: s.teacherName,
        classroomId: s.classroomId,
        classroomName: s.classroomName,
        roomNumber: s.roomNumber,
      });
    }

    if (canViewBookings) {
      for (const b of data.bookings) {
        const isPending = b.status === BookingStatus.PENDING;
        const roomId = b.assignedClassroomId ?? b.requestedClassroomId;
        const roomName = b.assignedClassroomName ?? b.requestedClassroomName;
        const roomNum = b.assignedRoomNumber ?? b.requestedRoomNumber;

        if (!isPending && b.assignedClassroomId) {
          occupiedRoomIds.add(b.assignedClassroomId);
          incrementRoomEvents(b.assignedClassroomId);
        }

        events.push({
          id: `booking-${b.id}`,
          sourceId: b.id,
          category: isPending ? 'PENDING_BOOKING' : 'CONFIRMED_BOOKING',
          date: b.requestedDate,
          startTime: b.startTime,
          endTime: b.endTime,
          title: b.purpose,
          subtitle: b.studentName ? `${b.teacherName} مع ${b.studentName}` : b.teacherName,
          status: b.status,
          teacherId: b.teacherId,
          teacherName: b.teacherName,
          studentName: b.studentName,
          classroomId: roomId,
          classroomName: roomName,
          roomNumber: roomNum,
        });
      }
    }

    if (canViewClassrooms) {
      for (const rb of data.standaloneRoomBookings) {
        occupiedRoomIds.add(rb.classroomId);
        incrementRoomEvents(rb.classroomId);

        events.push({
          id: `room-booking-${rb.id}`,
          sourceId: rb.id,
          category: 'CONFIRMED_BOOKING',
          date: rb.bookingDate,
          startTime: rb.startTime,
          endTime: rb.endTime,
          title: rb.title,
          subtitle: `حجز قاعة (${rb.classroomName})`,
          status: rb.status,
          classroomId: rb.classroomId,
          classroomName: rb.classroomName,
          roomNumber: rb.roomNumber,
        });
      }

      for (const m of data.maintenances) {
        maintenanceRoomIds.add(m.classroomId);
        const segments = expandMaintenanceDays({
          startAt: m.startAt,
          endAt: m.endAt,
          fromDate,
          toDate,
        });

        for (const seg of segments) {
          events.push({
            id: `maint-${m.id}-${seg.date}`,
            sourceId: m.id,
            category: 'CLASSROOM_MAINTENANCE',
            date: seg.date,
            startTime: seg.startTime,
            endTime: seg.endTime,
            title: `صيانة: ${m.classroomName}`,
            subtitle: m.reason,
            status: ClassroomStatus.MAINTENANCE,
            classroomId: m.classroomId,
            classroomName: m.classroomName,
            roomNumber: m.roomNumber,
          });
        }
      }
    }

    events.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });

    const classroomBreakdown = canViewClassrooms
      ? data.allClassrooms.map((room) => {
          const inMaint =
            room.status === ClassroomStatus.MAINTENANCE || maintenanceRoomIds.has(room.id);
          const isInactive = room.status === ClassroomStatus.INACTIVE;
          const hasOccupiedSlots = occupiedRoomIds.has(room.id);

          const state: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'INACTIVE' = isInactive
            ? 'INACTIVE'
            : inMaint
              ? 'MAINTENANCE'
              : hasOccupiedSlots
                ? 'OCCUPIED'
                : 'AVAILABLE';

          return {
            ...room,
            state,
            eventsCount: eventsCountByRoom.get(room.id) ?? 0,
          };
        })
      : [];

    const classroomsSummary = {
      total: classroomBreakdown.length,
      available: classroomBreakdown.filter((c) => c.state === 'AVAILABLE').length,
      occupied: classroomBreakdown.filter((c) => c.state === 'OCCUPIED').length,
      maintenance: classroomBreakdown.filter(
        (c) => c.state === 'MAINTENANCE' || c.state === 'INACTIVE',
      ).length,
      rooms: classroomBreakdown,
    };

    return {
      range: { from: fromDate, to: toDate },
      events,
      classroomsSummary,
      filters: {
        teachers: canViewTeachers ? data.allTeachers : [],
        classrooms: canViewClassrooms ? data.allClassrooms : [],
      },
    };
  }
}
