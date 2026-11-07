import { ARABIC_DAYS, formatDateAr } from '@/lib/formatters';

export type CalendarViewMode = 'day' | 'week' | 'month';

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
    classrooms: Array<{
      id: string;
      roomNumber: string;
      name: string;
      maxCapacity: number;
      status: string;
    }>;
  };
}

export const EVENT_CATEGORY_STYLES: Record<
  CalendarEventCategory,
  {
    label: string;
    pillClass: string;
    dotClass: string;
    badgeVariant: 'info' | 'success' | 'warning' | 'danger';
  }
> = {
  GROUP_SESSION: {
    label: 'حصص المجموعات',
    pillClass:
      'border-blue-500/40 bg-blue-500/15 text-blue-800 dark:text-blue-200 hover:bg-blue-500/25',
    dotClass: 'bg-blue-500',
    badgeVariant: 'info',
  },
  CONFIRMED_BOOKING: {
    label: 'الحجوزات المعتمدة والقاعات المشغولة',
    pillClass:
      'border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/25',
    dotClass: 'bg-emerald-500',
    badgeVariant: 'success',
  },
  PENDING_BOOKING: {
    label: 'طلبات الحجز المعلقة',
    pillClass:
      'border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200 hover:bg-amber-500/25',
    dotClass: 'bg-amber-500',
    badgeVariant: 'warning',
  },
  CLASSROOM_MAINTENANCE: {
    label: 'مواعيد صيانة القاعات',
    pillClass:
      'border-rose-500/40 bg-rose-500/15 text-rose-800 dark:text-rose-200 hover:bg-rose-500/25',
    dotClass: 'bg-rose-500',
    badgeVariant: 'danger',
  },
};

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
