import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Pin,
} from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { Badge, Button, Input, Modal, Select, useToast } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { formatDateAr, formatTimeRangeAr } from '@/lib/formatters';
import {
  CalendarClassroomFilterOption,
  findClassroomConflictReason,
  getEventVisualStyle,
  resolveEventVisualState,
  UnifiedCalendarEvent,
} from './calendar.types';

interface CalendarEventModalProps {
  event: UnifiedCalendarEvent | null;
  classrooms: CalendarClassroomFilterOption[];
  dayEvents: UnifiedCalendarEvent[];
  onClose: () => void;
  onSaved?: () => void;
}

export function CalendarEventModal({
  event,
  classrooms,
  dayEvents,
  onClose,
  onSaved,
}: CalendarEventModalProps) {
  const { notify } = useToast();
  const { hasPermission } = useAuth();

  const canManageQuickSession =
    hasPermission(PERMISSIONS.SESSIONS_MANAGE) ||
    hasPermission(PERMISSIONS.ATTENDANCE_RECORD) ||
    hasPermission(PERMISSIONS.CLASSROOMS_MANAGE);

  const canCompleteGroupAttendance =
    hasPermission(PERMISSIONS.ATTENDANCE_RECORD) ||
    hasPermission(PERMISSIONS.SESSIONS_MANAGE);

  const [classroomId, setClassroomId] = React.useState('');
  const [startTime, setStartTime] = React.useState('16:00');
  const [endTime, setEndTime] = React.useState('18:00');
  const [topic, setTopic] = React.useState('');
  const [pinToGroupSchedule, setPinToGroupSchedule] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!event) return;
    setClassroomId(event.classroomId ?? '');
    setStartTime(event.startTime.slice(0, 5));
    setEndTime(event.endTime.slice(0, 5));
    setTopic(event.topic ?? '');
    setPinToGroupSchedule(false);
    setErrorMsg(null);
  }, [event]);

  const mutation = useMutation({
    mutationFn: async (completeGroupAttendance: boolean) => {
      if (!event || !event.groupId) {
        throw new Error('بيانات المجموعة غير مكتملة');
      }
      const res = await apiClient.post('/calendar/quick-session', {
        sessionId: event.sessionId ?? undefined,
        groupId: event.groupId,
        sessionDate: event.date,
        startTime,
        endTime,
        classroomId: classroomId || null,
        topic: topic.trim() || null,
        pinToGroupSchedule,
        completeGroupAttendance,
        originalSlotStartTime: event.originalSlotStartTime ?? event.startTime,
      });
      return res.data as {
        groupPinned: boolean;
        attendanceCompleted: boolean;
      };
    },
    onSuccess: (res) => {
      if (res.attendanceCompleted && res.groupPinned) {
        notify('تم حفظ القاعة وتثبيتها للمجموعة وتأكيد حضور المجموعة بنجاح');
      } else if (res.attendanceCompleted) {
        notify('تم حفظ القاعة والموعد وتأكيد حضور المجموعة بنجاح');
      } else if (res.groupPinned) {
        notify('تم حفظ حصة اليوم وتثبيت القاعة والموعد كجدول ثابت للمجموعة');
      } else {
        notify('تم حفظ قاعة وموعد حصة اليوم بنجاح');
      }
      onSaved?.();
      onClose();
    },
    onError: (err) => {
      setErrorMsg(extractErrorMessage(err));
    },
  });

  const visualStyle = event ? getEventVisualStyle(event) : null;
  const visualState =
    event && event.category === 'GROUP_SESSION'
      ? resolveEventVisualState(event)
      : null;

  const classroomOptions = React.useMemo(() => {
    if (!event) return [];
    return classrooms.map((room) => {
      const conflictReason = findClassroomConflictReason({
        room,
        dayEvents,
        currentEventId: event.id,
        startTime,
        endTime,
      });
      return {
        value: room.id,
        label: `${room.name} (${room.roomNumber}) — سعة ${room.maxCapacity}`,
        sublabel: conflictReason ? `⚠️ ${conflictReason}` : 'متاحة في هذا التوقيت ✓',
        disabled:
          room.status === 'INACTIVE' ||
          room.status === 'MAINTENANCE',
      };
    });
  }, [classrooms, dayEvents, endTime, event, startTime]);

  const selectedRoomConflict = React.useMemo(() => {
    if (!event || !classroomId) return null;
    const room = classrooms.find((c) => c.id === classroomId);
    if (!room) return null;
    return findClassroomConflictReason({
      room,
      dayEvents,
      currentEventId: event.id,
      startTime,
      endTime,
    });
  }, [classroomId, classrooms, dayEvents, endTime, event, startTime]);

  const handleSubmit = (completeGroupAttendance: boolean) => {
    setErrorMsg(null);
    if (startTime >= endTime) {
      setErrorMsg('وقت نهاية الحصة يجب أن يكون بعد وقت البداية');
      return;
    }
    mutation.mutate(completeGroupAttendance);
  };

  return (
    <Modal
      open={Boolean(event)}
      onOpenChange={(open) => !open && onClose()}
      title={event?.title ?? 'تفاصيل الحدث'}
      description={event ? formatDateAr(event.date) : undefined}
      size="md"
    >
      {event && visualStyle && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 p-3">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-muted-foreground">
                {event.category === 'GROUP_SESSION'
                  ? `المدرس: ${event.teacherName ?? '—'}`
                  : 'التصنيف: صيانة قاعة'}
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" />
                {formatTimeRangeAr(event.startTime, event.endTime)}
                {event.classroomName && (
                  <span className="text-muted-foreground">
                    • {event.classroomName} ({event.roomNumber})
                  </span>
                )}
              </div>
            </div>
            <Badge variant={visualStyle.badgeVariant}>{visualStyle.badgeLabel}</Badge>
          </div>

          {event.category === 'CLASSROOM_MAINTENANCE' || !canManageQuickSession || !event.groupId ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">التفاصيل:</span>
                <span className="font-semibold text-foreground">{event.subtitle}</span>
              </div>
              {event.classroomName && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">القاعة:</span>
                  <span className="font-semibold text-foreground">
                    {event.classroomName} ({event.roomNumber})
                  </span>
                </div>
              )}
              <div className="flex justify-end pt-3">
                <Button variant="outline" onClick={onClose}>
                  إغلاق
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {errorMsg && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <Select
                  searchable
                  clearable
                  label="قاعة حصة اليوم"
                  placeholder="اختر القاعة الدراسية لحصة النهارده..."
                  searchPlaceholder="ابحث باسم القاعة أو رقمها..."
                  emptyText="لا توجد قاعات مطابقة"
                  value={classroomId}
                  onChange={(e) => setClassroomId(e.target.value)}
                  options={classroomOptions}
                />
                {selectedRoomConflict && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    تنبيه: القاعة المحددة {selectedRoomConflict}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  type="time"
                  label="من الساعة"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
                <Input
                  type="time"
                  label="إلى الساعة"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>

              <Input
                label="موضوع الحصة (اختياري)"
                placeholder="مثال: مراجعة الفصل الأول..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />

              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-muted/20 p-3 transition-colors hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={pinToGroupSchedule}
                  onChange={(e) => setPinToGroupSchedule(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Pin className="h-3.5 w-3.5 text-primary" />
                    تثبيت هذه القاعة والموعد كجدول ثابت للمجموعة
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    عند التفعيل، سيتم اعتماد هذه القاعة والتوقيت تلقائياً لنفس هذا اليوم في الأسابيع القادمة.
                  </p>
                </div>
              </label>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={mutation.isPending}
                >
                  إلغاء
                </Button>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant={visualState === 'COMPLETED' ? 'primary' : 'secondary'}
                    isLoading={mutation.isPending && mutation.variables === false}
                    disabled={mutation.isPending}
                    onClick={() => handleSubmit(false)}
                  >
                    <Building2 className="h-4 w-4" />
                    {visualState === 'COMPLETED'
                      ? 'حفظ تعديل القاعة والموعد'
                      : 'حفظ القاعة والموعد'}
                  </Button>

                  {canCompleteGroupAttendance && visualState !== 'COMPLETED' && (
                    <Button
                      type="button"
                      variant="primary"
                      isLoading={mutation.isPending && mutation.variables === true}
                      disabled={mutation.isPending}
                      onClick={() => handleSubmit(true)}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      حفظ وتأكيد حضور المجموعة
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
