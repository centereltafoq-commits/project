import { SessionStatus } from '@edu-center/shared';
import { GroupScheduleSlot } from '../../../database/schemas/groups.schema';

export type CalendarSessionVisualState =
  | 'NEEDS_CLASSROOM'
  | 'READY_SCHEDULED'
  | 'COMPLETED';

export type CalendarEventCategory =
  | 'GROUP_SESSION'
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
  visualState?: CalendarSessionVisualState;
  isVirtualSlot?: boolean;
  sessionId?: string | null;
  groupId?: string | null;
  groupName?: string | null;
  subject?: string | null;
  topic?: string | null;
  slotDayOfWeek?: number | null;
  originalSlotStartTime?: string | null;
  teacherId?: string | null;
  teacherName?: string | null;
  classroomId?: string | null;
  classroomName?: string | null;
  roomNumber?: string | null;
}

export interface CalendarRealSessionRow {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: string;
  topic: string | null;
  groupId: string;
  groupName: string;
  groupCode: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  classroomId: string | null;
  classroomName: string | null;
  roomNumber: string | null;
}

export interface CalendarActiveGroupRow {
  id: string;
  name: string;
  groupCode: string;
  subject: string;
  primaryTeacherId: string;
  teacherName: string;
  defaultClassroomId: string | null;
  scheduleSlots: GroupScheduleSlot[];
}

export interface ClassroomLookupItem {
  id: string;
  name: string;
  roomNumber: string;
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function normalizeHHmm(time: string): string {
  const trimmed = time.trim();
  return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
}

export function resolveSessionVisualState(
  status: string,
  classroomId?: string | null,
): CalendarSessionVisualState {
  if (status === SessionStatus.COMPLETED) {
    return 'COMPLETED';
  }
  if (classroomId) {
    return 'READY_SCHEDULED';
  }
  return 'NEEDS_CLASSROOM';
}

export function expandAndMergeGroupScheduleEvents(params: {
  fromDate: string;
  toDate: string;
  existingSessions: CalendarRealSessionRow[];
  activeGroups: CalendarActiveGroupRow[];
  classroomsMap: Map<string, ClassroomLookupItem>;
  teacherFilterId?: string;
  classroomFilterId?: string;
}): UnifiedCalendarEvent[] {
  const events: UnifiedCalendarEvent[] = [];
  const realSessionsByGroupDate = new Map<string, CalendarRealSessionRow[]>();

  for (const s of params.existingSessions) {
    const key = `${s.groupId}|${s.sessionDate}`;
    const list = realSessionsByGroupDate.get(key) ?? [];
    list.push(s);
    realSessionsByGroupDate.set(key, list);

    const matchesTeacher = !params.teacherFilterId || s.teacherId === params.teacherFilterId;
    const matchesClassroom =
      !params.classroomFilterId || s.classroomId === params.classroomFilterId;

    if (!matchesTeacher || !matchesClassroom) {
      continue;
    }

    const [y, m, d] = s.sessionDate.split('-').map(Number);
    const dayOfWeek = new Date(y!, m! - 1, d!).getDay();
    const startTime = normalizeHHmm(s.startTime);
    const endTime = normalizeHHmm(s.endTime);

    events.push({
      id: `session-${s.id}`,
      sourceId: s.id,
      category: 'GROUP_SESSION',
      date: s.sessionDate,
      startTime,
      endTime,
      title: `${s.groupName} (${s.subject})`,
      subtitle: s.topic ? `${s.teacherName} — ${s.topic}` : s.teacherName,
      status: s.status,
      visualState: resolveSessionVisualState(s.status, s.classroomId),
      isVirtualSlot: false,
      sessionId: s.id,
      groupId: s.groupId,
      groupName: s.groupName,
      subject: s.subject,
      topic: s.topic,
      slotDayOfWeek: dayOfWeek,
      originalSlotStartTime: startTime,
      teacherId: s.teacherId,
      teacherName: s.teacherName,
      classroomId: s.classroomId,
      classroomName: s.classroomName,
      roomNumber: s.roomNumber,
    });
  }

  const [fy, fm, fd] = params.fromDate.split('-').map(Number);
  const [ty, tm, td] = params.toDate.split('-').map(Number);
  const cursor = new Date(fy!, fm! - 1, fd!);
  const endCursor = new Date(ty!, tm! - 1, td!);

  while (cursor <= endCursor) {
    const dateStr = formatYmd(cursor);
    const dayOfWeek = cursor.getDay();

    for (const group of params.activeGroups) {
      if (params.teacherFilterId && group.primaryTeacherId !== params.teacherFilterId) {
        continue;
      }

      const matchingSlots = (group.scheduleSlots ?? []).filter(
        (slot) => Number(slot.dayOfWeek) === dayOfWeek,
      );
      if (matchingSlots.length === 0) continue;

      const existingForDay = realSessionsByGroupDate.get(`${group.id}|${dateStr}`) ?? [];
      const usedRealSessionIds = new Set<string>();

      for (const slot of matchingSlots) {
        const slotStart = normalizeHHmm(slot.startTime);
        const slotEnd = normalizeHHmm(slot.endTime);

        let matchedReal = existingForDay.find(
          (r) => !usedRealSessionIds.has(r.id) && normalizeHHmm(r.startTime) === slotStart,
        );
        if (!matchedReal && existingForDay.length <= matchingSlots.length) {
          matchedReal = existingForDay.find((r) => !usedRealSessionIds.has(r.id));
        }

        if (matchedReal) {
          usedRealSessionIds.add(matchedReal.id);
          continue;
        }

        const effectiveClassroomId = slot.classroomId ?? group.defaultClassroomId ?? null;
        if (
          params.classroomFilterId &&
          effectiveClassroomId !== params.classroomFilterId
        ) {
          continue;
        }

        const roomInfo = effectiveClassroomId
          ? params.classroomsMap.get(effectiveClassroomId)
          : undefined;

        events.push({
          id: `slot-${group.id}-${dateStr}-${slotStart}`,
          sourceId: group.id,
          category: 'GROUP_SESSION',
          date: dateStr,
          startTime: slotStart,
          endTime: slotEnd,
          title: `${group.name} (${group.subject})`,
          subtitle: group.teacherName,
          status: SessionStatus.SCHEDULED,
          visualState: resolveSessionVisualState(
            SessionStatus.SCHEDULED,
            effectiveClassroomId,
          ),
          isVirtualSlot: true,
          sessionId: null,
          groupId: group.id,
          groupName: group.name,
          subject: group.subject,
          topic: null,
          slotDayOfWeek: dayOfWeek,
          originalSlotStartTime: slotStart,
          teacherId: group.primaryTeacherId,
          teacherName: group.teacherName,
          classroomId: effectiveClassroomId,
          classroomName: roomInfo?.name ?? null,
          roomNumber: roomInfo?.roomNumber ?? null,
        });
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return events;
}
