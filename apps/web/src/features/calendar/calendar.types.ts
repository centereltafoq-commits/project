import { ARABIC_DAYS, formatDateAr, formatTimeRangeAr } from '@/lib/formatters';

export type CalendarViewMode = 'day' | 'week' | 'month';

export type CalendarEventCategory =
  | 'GROUP_SESSION'
  | 'CLASSROOM_MAINTENANCE';

export type CalendarSessionVisualState =
  | 'NEEDS_CLASSROOM'
  | 'READY_SCHEDULED'
  | 'COMPLETED';

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
  studentName?: string | null;
  classroomId?: string | null;
  classroomName?: string | null;
  roomNumber?: string | null;
}

export interface CalendarClassroomFilterOption {
  id: string;
  roomNumber: string;
  name: string;
  maxCapacity: number;
  status: string;
}

export interface CalendarResponse {
  range: { from: string; to: string };
  events: UnifiedCalendarEvent[];
  classroomsSummary: {
    total: number;
    available: number;
    occupied: number;
    maintenance: number;
    rooms: Array<{
      id: string;
      roomNumber: string;
      name: string;
      maxCapacity: number;
      status: string;
      state: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'INACTIVE';
      eventsCount: number;
    }>;
  };
  filters: {
    teachers: Array<{ id: string; fullName: string; specialization: string }>;
    classrooms: CalendarClassroomFilterOption[];
  };
}

export interface EventVisualStyle {
  label: string;
  badgeLabel: string;
  pillClass: string;
  dotClass: string;
  badgeVariant: 'info' | 'success' | 'warning' | 'danger';
}

export const EVENT_CATEGORY_STYLES: Record<
  CalendarEventCategory,
  EventVisualStyle
> = {
  GROUP_SESSION: {
    label: 'حصص المجموعات',
    badgeLabel: 'حصة مجدولة',
    pillClass:
      'border-blue-500/40 bg-blue-500/15 text-blue-800 dark:text-blue-200 hover:bg-blue-500/25',
    dotClass: 'bg-blue-500',
    badgeVariant: 'info',
  },
  CLASSROOM_MAINTENANCE: {
    label: 'مواعيد صيانة القاعات',
    badgeLabel: 'صيانة',
    pillClass:
      'border-rose-500/40 bg-rose-500/15 text-rose-800 dark:text-rose-200 hover:bg-rose-500/25',
    dotClass: 'bg-rose-500',
    badgeVariant: 'danger',
  },
};

export const SESSION_VISUAL_STATE_STYLES: Record<
  CalendarSessionVisualState,
  EventVisualStyle
> = {
  NEEDS_CLASSROOM: {
    label: 'موعد مجموعة (بدون قاعة)',
    badgeLabel: 'اختر القاعة',
    pillClass:
      'border-dashed border-amber-500/60 bg-amber-500/15 text-amber-900 dark:text-amber-200 hover:bg-amber-500/25',
    dotClass: 'bg-amber-500',
    badgeVariant: 'warning',
  },
  READY_SCHEDULED: {
    label: 'حصة محددة القاعة',
    badgeLabel: 'مجدولة بقاعة',
    pillClass:
      'border-blue-500/40 bg-blue-500/15 text-blue-800 dark:text-blue-200 hover:bg-blue-500/25',
    dotClass: 'bg-blue-500',
    badgeVariant: 'info',
  },
  COMPLETED: {
    label: 'حصة مكتملة (تم الحضور)',
    badgeLabel: 'تم الحضور ✓',
    pillClass:
      'border-emerald-500/50 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-500/25',
    dotClass: 'bg-emerald-500',
    badgeVariant: 'success',
  },
};

export function resolveEventVisualState(
  ev: UnifiedCalendarEvent,
): CalendarSessionVisualState {
  if (ev.visualState) return ev.visualState;
  if (ev.status === 'COMPLETED') return 'COMPLETED';
  if (ev.classroomId) return 'READY_SCHEDULED';
  return 'NEEDS_CLASSROOM';
}

export function getEventVisualStyle(ev: UnifiedCalendarEvent): EventVisualStyle {
  if (ev.category === 'CLASSROOM_MAINTENANCE') {
    return EVENT_CATEGORY_STYLES.CLASSROOM_MAINTENANCE;
  }
  return SESSION_VISUAL_STATE_STYLES[resolveEventVisualState(ev)];
}

export function findClassroomConflictReason(params: {
  room: CalendarClassroomFilterOption;
  dayEvents: UnifiedCalendarEvent[];
  currentEventId: string;
  startTime: string;
  endTime: string;
}): string | null {
  const { room, dayEvents, currentEventId, startTime, endTime } = params;
  if (room.status === 'MAINTENANCE') return 'قيد الصيانة العامة';
  if (room.status === 'INACTIVE') return 'غير مفعلة';

  for (const ev of dayEvents) {
    if (ev.id === currentEventId) continue;
    if (ev.classroomId !== room.id) continue;

    const overlaps = ev.startTime < endTime && ev.endTime > startTime;
    if (!overlaps) continue;

    if (ev.category === 'CLASSROOM_MAINTENANCE') {
      return `صيانة مجدولة (${formatTimeRangeAr(ev.startTime, ev.endTime)})`;
    }
    if (ev.category === 'GROUP_SESSION') {
      return `مشغولة: ${ev.groupName ?? ev.title} (${formatTimeRangeAr(ev.startTime, ev.endTime)})`;
    }
  }

  return null;
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function computeViewRange(anchor: Date, mode: CalendarViewMode): {
  from: string;
  to: string;
  days: Date[];
  label: string;
} {
  if (mode === 'day') {
    const iso = toIsoDate(anchor);
    return {
      from: iso,
      to: iso,
      days: [new Date(anchor)],
      label: `${ARABIC_DAYS[anchor.getDay()]}، ${formatDateAr(iso)}`,
    };
  }

  if (mode === 'week') {
    const start = new Date(anchor);
    const diffToSat = (anchor.getDay() + 1) % 7; // Start week on Saturday (Egyptian standard)
    start.setDate(anchor.getDate() - diffToSat);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    const from = toIsoDate(days[0]);
    const to = toIsoDate(days[6]);
    return {
      from,
      to,
      days,
      label: `${formatDateAr(from)} — ${formatDateAr(to)}`,
    };
  }

  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lastOfMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);

  const gridStart = new Date(firstOfMonth);
  const startOffset = (firstOfMonth.getDay() + 1) % 7;
  gridStart.setDate(firstOfMonth.getDate() - startOffset);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
    if (i >= 34 && d > lastOfMonth && (i + 1) % 7 === 0) break;
  }

  return {
    from: toIsoDate(days[0]),
    to: toIsoDate(days[days.length - 1]),
    days,
    label: firstOfMonth.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' }),
  };
}

export function shiftAnchorDate(
  anchor: Date,
  mode: CalendarViewMode,
  direction: -1 | 1,
): Date {
  const next = new Date(anchor);
  if (mode === 'day') next.setDate(next.getDate() + direction);
  else if (mode === 'week') next.setDate(next.getDate() + direction * 7);
  else next.setMonth(next.getMonth() + direction);
  return next;
}
