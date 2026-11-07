import { Building2, Clock, User } from 'lucide-react';
import { Card } from '@/design-system';
import { cn } from '@/lib/cn';
import { ARABIC_DAYS, formatTimeAr, formatTimeRangeAr } from '@/lib/formatters';
import {
  EVENT_CATEGORY_STYLES,
  toIsoDate,
  UnifiedCalendarEvent,
} from './calendar.types';

const EGYPT_WEEK_HEADERS = [
  ARABIC_DAYS[6], // السبت
  ARABIC_DAYS[0], // الأحد
  ARABIC_DAYS[1], // الإثنين
  ARABIC_DAYS[2], // الثلاثاء
  ARABIC_DAYS[3], // الأربعاء
  ARABIC_DAYS[4], // الخميس
  ARABIC_DAYS[5], // الجمعة
];

interface ViewProps {
  days: Date[];
  anchorMonth: number;
  eventsByDate: Map<string, UnifiedCalendarEvent[]>;
  onSelectEvent: (ev: UnifiedCalendarEvent) => void;
}

export function DailyTimelineView({
  days,
  eventsByDate,
  onSelectEvent,
}: Omit<ViewProps, 'anchorMonth'>) {
  const iso = toIsoDate(days[0]);
  const dayEvents = eventsByDate.get(iso) ?? [];

  if (dayEvents.length === 0) {
    return (
      <Card className="p-12 text-center text-sm text-muted-foreground">
        لا توجد حصص أو حجوزات أو مواعيد صيانة مسجلة في هذا اليوم.
      </Card>
    );
  }

  return (
    <Card className="divide-y divide-border overflow-hidden">
      {dayEvents.map((ev) => {
        const meta = EVENT_CATEGORY_STYLES[ev.category];
        return (
          <button
            key={ev.id}
            type="button"
            onClick={() => onSelectEvent(ev)}
            className="flex w-full flex-col gap-2 p-4 text-right transition-colors hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="flex w-36 shrink-0 items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-bold text-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" />
                {formatTimeRangeAr(ev.startTime, ev.endTime)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn('h-2.5 w-2.5 rounded-full', meta.dotClass)} />
                  <span className="font-bold text-foreground">{ev.title}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{ev.subtitle}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {ev.teacherName && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 text-foreground">
                  <User className="h-3 w-3" />
                  {ev.teacherName}
                </span>
              )}
              {ev.classroomName && (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 text-foreground">
                  <Building2 className="h-3 w-3" />
                  {ev.classroomName} ({ev.roomNumber})
                </span>
              )}
              <span className={cn('rounded-full border px-2.5 py-0.5 font-semibold', meta.pillClass)}>
                {meta.label}
              </span>
            </div>
          </button>
        );
      })}
    </Card>
  );
}

export function WeeklyGridView({
  days,
  eventsByDate,
  onSelectEvent,
}: Omit<ViewProps, 'anchorMonth'>) {
  const todayIso = toIsoDate(new Date());

  return (
    <Card className="overflow-x-auto">
      <div className="grid min-w-[900px] grid-cols-7 divide-x divide-x-reverse divide-border">
        {days.map((d, idx) => {
          const iso = toIsoDate(d);
          const isToday = iso === todayIso;
          const items = eventsByDate.get(iso) ?? [];

          return (
            <div key={iso} className="flex min-h-[420px] flex-col">
              <div
                className={cn(
                  'border-b border-border p-3 text-center',
                  isToday ? 'bg-primary/10' : 'bg-muted/40',
                )}
              >
                <div className="text-xs font-bold text-muted-foreground">
                  {EGYPT_WEEK_HEADERS[idx]}
                </div>
                <div
                  className={cn(
                    'mt-0.5 text-base font-extrabold',
                    isToday ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {d.getDate()}/{d.getMonth() + 1}
                </div>
              </div>

              <div className="flex-1 space-y-2 p-2">
                {items.length === 0 ? (
                  <p className="pt-6 text-center text-[11px] text-muted-foreground/60">
                    لا توجد مواعيد
                  </p>
                ) : (
                  items.map((ev) => {
                    const style = EVENT_CATEGORY_STYLES[ev.category];
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => onSelectEvent(ev)}
                        className={cn(
                          'w-full rounded-lg border p-2 text-right text-xs transition-all',
                          style.pillClass,
                        )}
                      >
                        <div className="font-bold">
                          {formatTimeRangeAr(ev.startTime, ev.endTime)}
                        </div>
                        <div className="mt-0.5 line-clamp-2 font-semibold">{ev.title}</div>
                        {ev.classroomName && (
                          <div className="mt-1 truncate text-[10px] opacity-85">
                            قاعة: {ev.classroomName}
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function MonthlyGridView({
  days,
  anchorMonth,
  eventsByDate,
  onSelectEvent,
}: ViewProps) {
  const todayIso = toIsoDate(new Date());

  return (
    <Card className="overflow-x-auto">
      <div className="min-w-[840px]">
        <div className="grid grid-cols-7 border-b border-border bg-muted/50 text-center text-xs font-bold text-muted-foreground">
          {EGYPT_WEEK_HEADERS.map((h) => (
            <div key={h} className="py-2.5">
              {h}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-x-reverse divide-border">
          {days.map((d) => {
            const iso = toIsoDate(d);
            const isCurrentMonth = d.getMonth() === anchorMonth;
            const isToday = iso === todayIso;
            const items = eventsByDate.get(iso) ?? [];

            return (
              <div
                key={iso}
                className={cn(
                  'min-h-[120px] p-2 transition-colors',
                  !isCurrentMonth && 'bg-muted/25 opacity-60',
                  isToday && 'bg-primary/5',
                )}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                      isToday
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground',
                    )}
                  >
                    {d.getDate()}
                  </span>
                  {items.length > 0 && (
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {items.length} حدث
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {items.slice(0, 3).map((ev) => {
                    const style = EVENT_CATEGORY_STYLES[ev.category];
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => onSelectEvent(ev)}
                        className={cn(
                          'block w-full truncate rounded border px-1.5 py-0.5 text-right text-[11px] font-semibold',
                          style.pillClass,
                        )}
                      >
                        {formatTimeAr(ev.startTime)} {ev.title}
                      </button>
                    );
                  })}
                  {items.length > 3 && (
                    <button
                      type="button"
                      onClick={() => onSelectEvent(items[3])}
                      className="w-full text-right text-[11px] font-bold text-primary hover:underline"
                    >
                      +{items.length - 3} مواعيد أخرى
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
