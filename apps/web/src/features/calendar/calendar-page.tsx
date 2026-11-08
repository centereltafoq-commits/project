import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Wrench,
} from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { Button, Card, PageHeader, Select, StatCard } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { CalendarEventModal } from './calendar-event-modal';
import {
  CalendarEventCategory,
  CalendarResponse,
  CalendarViewMode,
  computeViewRange,
  EVENT_CATEGORY_STYLES,
  shiftAnchorDate,
  UnifiedCalendarEvent,
} from './calendar.types';
import { DailyTimelineView, MonthlyGridView, WeeklyGridView } from './calendar-views';

export function CalendarPage() {
  const { hasPermission } = useAuth();
  const canViewClassrooms = hasPermission(PERMISSIONS.CLASSROOMS_VIEW);
  const canViewTeachers = hasPermission(PERMISSIONS.TEACHERS_VIEW);
  const canViewBookings = hasPermission(PERMISSIONS.BOOKINGS_VIEW);

  const [viewMode, setViewMode] = React.useState<CalendarViewMode>('week');
  const [anchorDate, setAnchorDate] = React.useState<Date>(() => new Date());
  const [teacherId, setTeacherId] = React.useState('');
  const [classroomId, setClassroomId] = React.useState('');
  const [selectedEvent, setSelectedEvent] =
    React.useState<UnifiedCalendarEvent | null>(null);

  const rangeInfo = React.useMemo(
    () => computeViewRange(anchorDate, viewMode),
    [anchorDate, viewMode],
  );

  const { data, isLoading } = useQuery<CalendarResponse>({
    queryKey: ['calendar-events', rangeInfo.from, rangeInfo.to, teacherId, classroomId],
    queryFn: async () =>
      (
        await apiClient.get('/calendar/events', {
          params: {
            from: rangeInfo.from,
            to: rangeInfo.to,
            teacherId: teacherId || undefined,
            classroomId: classroomId || undefined,
          },
        })
      ).data,
  });

  const eventsByDate = React.useMemo(() => {
    const map = new Map<string, UnifiedCalendarEvent[]>();
    for (const ev of data?.events ?? []) {
      const arr = map.get(ev.date) ?? [];
      arr.push(ev);
      map.set(ev.date, arr);
    }
    return map;
  }, [data?.events]);

  const summary = data?.classroomsSummary;

  return (
    <div className="space-y-5">
      <PageHeader
        title="التقويم الموحد وحالة القاعات الدراسية"
        description="متابعة شاملة لحصص المجموعات، الحجوزات المعتمدة، الطلبات المعلقة، وصيانة القاعات لحظياً"
      />

      {canViewClassrooms && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="إجمالي القاعات الدراسية"
            value={summary?.total ?? 0}
            subtitle="قاعات مسجلة بالسنتر"
            icon={Building2}
            tone="primary"
          />
          <StatCard
            title="قاعات متاحة بالكامل"
            value={summary?.available ?? 0}
            subtitle="خالية في النطاق المعروض"
            icon={CheckCircle2}
            tone="success"
          />
          <StatCard
            title="قاعات بها حصص / حجوزات"
            value={summary?.occupied ?? 0}
            subtitle="مشغولة بجدول نشط"
            icon={Clock}
            tone="purple"
          />
          <StatCard
            title="قاعات قيد الصيانة / متوقفة"
            value={summary?.maintenance ?? 0}
            subtitle="مغلقة للصيانة أو غير نشطة"
            icon={Wrench}
            tone="danger"
          />
        </div>
      )}

      <Card className="space-y-4 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
              {(
                [
                  { id: 'day', label: 'عرض يومي' },
                  { id: 'week', label: 'عرض أسبوعي' },
                  { id: 'month', label: 'عرض شهري' },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setViewMode(m.id)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-bold transition-all',
                    viewMode === m.id
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAnchorDate((d) => shiftAnchorDate(d, viewMode, -1))}
              >
                <ChevronRight className="h-4 w-4" />
                السابق
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setAnchorDate(new Date())}
              >
                اليوم
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAnchorDate((d) => shiftAnchorDate(d, viewMode, 1))}
              >
                التالي
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>

            <span className="inline-flex items-center gap-1.5 px-2 text-sm font-extrabold text-foreground">
              <CalendarIcon className="h-4 w-4 text-primary" />
              {rangeInfo.label}
            </span>
          </div>

          {(canViewTeachers || canViewClassrooms) && (
            <div className="flex flex-wrap items-center gap-2">
              {canViewTeachers && (
                <Select
                  searchable
                  clearable
                  searchPlaceholder="ابحث باسم المدرس..."
                  placeholder="كل المدرسين"
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  options={(data?.filters.teachers ?? []).map((t) => ({
                    value: t.id,
                    label: t.fullName,
                  }))}
                  className="w-48"
                />
              )}
              {canViewClassrooms && (
                <Select
                  searchable
                  clearable
                  searchPlaceholder="ابحث باسم أو رقم القاعة..."
                  placeholder="كل القاعات"
                  value={classroomId}
                  onChange={(e) => setClassroomId(e.target.value)}
                  options={(data?.filters.classrooms ?? []).map((c) => ({
                    value: c.id,
                    label: `${c.name} (${c.roomNumber})`,
                  }))}
                  className="w-48"
                />
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-border pt-3 text-xs">
          {(Object.keys(EVENT_CATEGORY_STYLES) as CalendarEventCategory[])
            .filter((cat) => {
              if (!canViewBookings && (cat === 'PENDING_BOOKING' || cat === 'CONFIRMED_BOOKING')) {
                return false;
              }
              if (!canViewClassrooms && cat === 'CLASSROOM_MAINTENANCE') {
                return false;
              }
              return true;
            })
            .map((cat) => {
              const st = EVENT_CATEGORY_STYLES[cat];
              return (
                <div key={cat} className="flex items-center gap-1.5">
                  <span className={cn('h-2.5 w-2.5 rounded-full', st.dotClass)} />
                  <span className="font-semibold text-muted-foreground">{st.label}</span>
                </div>
              );
            })}
        </div>
      </Card>

      {isLoading ? (
        <Card className="p-14 text-center text-sm text-muted-foreground">
          جاري تحميل أحداث التقويم الموحد...
        </Card>
      ) : viewMode === 'day' ? (
        <DailyTimelineView
          days={rangeInfo.days}
          eventsByDate={eventsByDate}
          onSelectEvent={setSelectedEvent}
        />
      ) : viewMode === 'week' ? (
        <WeeklyGridView
          days={rangeInfo.days}
          eventsByDate={eventsByDate}
          onSelectEvent={setSelectedEvent}
        />
      ) : (
        <MonthlyGridView
          days={rangeInfo.days}
          anchorMonth={anchorDate.getMonth()}
          eventsByDate={eventsByDate}
          onSelectEvent={setSelectedEvent}
        />
      )}

      <CalendarEventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
    </div>
  );
}
