import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Clock, Layers, Users } from 'lucide-react';
import { Badge, Button, DatePicker, Modal } from '@/design-system';
import { apiClient } from '@/lib/api-client';
import { ARABIC_DAYS, formatDateAr, formatTimeRangeAr, getTodayIsoDate } from '@/lib/formatters';
import { ClassroomRow, ClassroomScheduleData } from './classrooms.types';

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface ClassroomScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroom: ClassroomRow | null;
  onOpenAllocation?: () => void;
}

export function ClassroomScheduleModal({
  open,
  onOpenChange,
  classroom,
  onOpenAllocation,
}: ClassroomScheduleModalProps) {
  const [tab, setTab] = React.useState<'weekly' | 'dated' | 'groups'>('weekly');
  const [from, setFrom] = React.useState(getTodayIsoDate());
  const [to, setTo] = React.useState(() => addDaysIso(getTodayIsoDate(), 6));

  const { data, isLoading } = useQuery<ClassroomScheduleData>({
    queryKey: ['classroom-schedule', classroom?.id, from, to],
    enabled: Boolean(open && classroom?.id && from && to),
    queryFn: async () => {
      const res = await apiClient.get(`/classrooms/${classroom!.id}/schedule`, {
        params: { from, to },
      });
      return res.data;
    },
  });

  const allocatedGroups = data?.allocatedGroups ?? [];

  React.useEffect(() => {
    if (open) {
      setTab('weekly');
    }
  }, [open, classroom?.id]);

  // Group recurring slots by day of week (0 to 6)
  const slotsByDay = React.useMemo(() => {
    const map = new Map<
      number,
      Array<{
        groupId: string;
        groupName: string;
        groupCode: string;
        subject: string;
        teacherName: string;
        startTime: string;
        endTime: string;
      }>
    >();

    for (let d = 0; d < 7; d++) {
      map.set(d, []);
    }

    if (!classroom) return map;

    for (const group of allocatedGroups) {
      const rawSlots = group.slotsForThisRoom?.length
        ? group.slotsForThisRoom
        : group.scheduleSlots;
      const slots = Array.isArray(rawSlots) ? rawSlots : [];
      for (const slot of slots) {
        if (!slot) continue;
        const day = Number(slot.dayOfWeek);
        if (Number.isNaN(day) || day < 0 || day > 6) continue;
        const arr = map.get(day) ?? [];
        arr.push({
          groupId: group.id,
          groupName: group.name,
          groupCode: group.groupCode,
          subject: group.subject,
          teacherName: group.teacherName,
          startTime: slot.startTime || '',
          endTime: slot.endTime || '',
        });
        map.set(day, arr);
      }
    }

    // Sort each day's slots by startTime
    for (let d = 0; d < 7; d++) {
      const arr = map.get(d) ?? [];
      arr.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
      map.set(d, arr);
    }

    return map;
  }, [allocatedGroups, classroom]);

  // Total recurring slots count
  const totalWeeklySlots = React.useMemo(() => {
    let count = 0;
    slotsByDay.forEach((arr) => {
      count += arr.length;
    });
    return count;
  }, [slotsByDay]);

  if (!classroom) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={`جدول القاعة وإشغال المجموعات: ${classroom.name} (قاعة #${classroom.roomNumber})`}
      description="متابعة الجدول الأسبوعي الثابت، المجموعات المسكنة بالقاعة، والحصص والحجوزات المؤرخة"
    >
      <div className="space-y-4">
        {/* Navigation Tabs & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={tab === 'weekly' ? 'primary' : 'outline'}
              onClick={() => setTab('weekly')}
              className="gap-1 text-xs"
            >
              <Calendar className="h-3.5 w-3.5" />
              الجدول الأسبوعي الثابت ({totalWeeklySlots})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === 'dated' ? 'primary' : 'outline'}
              onClick={() => setTab('dated')}
              className="gap-1 text-xs"
            >
              <Clock className="h-3.5 w-3.5" />
              الحصص المؤرخة ({data ? (data.sessions?.length ?? 0) : 0})
            </Button>
            <Button
              type="button"
              size="sm"
              variant={tab === 'groups' ? 'primary' : 'outline'}
              onClick={() => setTab('groups')}
              className="gap-1 text-xs"
            >
              <Users className="h-3.5 w-3.5" />
              المجموعات المسكنة ({allocatedGroups.length})
            </Button>
          </div>

          {onOpenAllocation && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onOpenAllocation();
              }}
              className="gap-1 text-xs font-bold text-primary hover:bg-primary/10"
            >
              <Layers className="h-3.5 w-3.5" />
              تسكين وتنظيم المجموعات
            </Button>
          )}
        </div>

        {/* Tab 1: Weekly Recurring Timetable */}
        {tab === 'weekly' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>يعرض المواعيد الثابتة للمجموعات المنظمة في هذه القاعة على مدار الأسبوع</span>
              <span>السعة القصوى: <strong className="text-foreground">{classroom.maxCapacity} طالب</strong></span>
            </div>

            {totalWeeklySlots === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                <Calendar className="mx-auto mb-2 h-8 w-8 opacity-40 text-muted-foreground" />
                لا توجد مواعيد أسبوعية ثابتة مسكنة في هذه القاعة بعد.
                {onOpenAllocation && (
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        onOpenChange(false);
                        onOpenAllocation();
                      }}
                    >
                      تسكين أول مجموعة الآن
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {/* Days: 6=Saturday, 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday */}
                {[6, 0, 1, 2, 3, 4, 5].map((dayIdx) => {
                  const daySlots = slotsByDay.get(dayIdx) ?? [];
                  const isToday = new Date().getDay() === dayIdx;

                  return (
                    <div
                      key={dayIdx}
                      className={`rounded-xl border p-3 ${
                        isToday
                          ? 'border-primary/50 bg-primary/5'
                          : daySlots.length > 0
                          ? 'border-border bg-card'
                          : 'border-border/40 bg-muted/10 opacity-70'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-extrabold text-sm text-foreground">
                          {ARABIC_DAYS[dayIdx]}
                          {isToday && (
                            <span className="mr-1.5 text-[10px] text-primary font-bold">(اليوم)</span>
                          )}
                        </span>
                        <Badge variant={daySlots.length > 0 ? 'info' : 'neutral'} className="text-[10px]">
                          {daySlots.length} مواعيد
                        </Badge>
                      </div>

                      {daySlots.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">القاعة شاغرة طوال اليوم</p>
                      ) : (
                        <div className="space-y-1.5">
                          {daySlots.map((slot, sIdx) => (
                            <div
                              key={sIdx}
                              className="rounded-lg border border-border/80 bg-background/80 p-2 text-xs"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-foreground truncate max-w-[140px]">
                                  {slot.groupName}
                                </span>
                                <Badge variant="info" className="text-[10px] py-0 px-1">
                                  {formatTimeRangeAr(slot.startTime, slot.endTime)}
                                </Badge>
                              </div>
                              <p className="mt-1 text-[11px] text-muted-foreground truncate">
                                {slot.teacherName} • {slot.subject}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Dated Sessions */}
        {tab === 'dated' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/20 p-3">
              <DatePicker label="من تاريخ" value={from} onChange={setFrom} />
              <DatePicker label="إلى تاريخ" value={to} onChange={setTo} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = getTodayIsoDate();
                  setFrom(today);
                  setTo(addDaysIso(today, 6));
                }}
              >
                الأسبوع الحالي
              </Button>
            </div>

            {isLoading || !data ? (
              <div className="h-40 animate-pulse rounded-xl bg-muted" />
            ) : (
              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 text-sm font-extrabold">
                    الحصص الدراسية الفعلية المجدولة ({data.sessions?.length ?? 0})
                  </h4>
                  {(data.sessions?.length ?? 0) === 0 ? (
                    <p className="text-xs text-muted-foreground">لا توجد حصص مجدولة في هذه الفترة</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {(data.sessions ?? []).map((s) => (
                        <div key={s.id} className="rounded-lg border border-border p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-bold">{s.groupName}</span>
                            <Badge variant="info">{formatDateAr(s.sessionDate)}</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            المدرس: {s.teacherName} • الوقت:{' '}
                            <span>{formatTimeRangeAr(s.startTime, s.endTime)}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {(data.maintenances?.length ?? 0) > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-extrabold text-amber-600">
                      نوافذ الصيانة ({data.maintenances?.length ?? 0})
                    </h4>
                    <div className="space-y-1.5">
                      {(data.maintenances ?? []).map((m) => (
                        <div
                          key={m.id}
                          className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs"
                        >
                          <strong>{m.reason}</strong> — من {formatDateAr(m.startAt)} إلى{' '}
                          {formatDateAr(m.endAt)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Allocated Groups */}
        {tab === 'groups' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>جميع المجموعات المرتبطة بهذه القاعة كقاعة افتراضية أو بمواعيد أسبوعية</span>
              {onOpenAllocation && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenAllocation();
                  }}
                  className="gap-1 text-xs"
                >
                  <Users className="h-3.5 w-3.5 text-primary" />
                  إدارة التسكين والتنظيم
                </Button>
              )}
            </div>

            {allocatedGroups.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
                لا توجد مجموعات مسكنة في هذه القاعة حالياً
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {allocatedGroups.map((g) => (
                  <div key={g.id} className="rounded-xl border border-border p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm">{g.name}</span>
                        <span className="font-mono text-muted-foreground">({g.groupCode})</span>
                        <Badge variant="neutral">{g.subject} - {g.gradeLevel}</Badge>
                      </div>
                      <Badge variant="neutral">المدرس: {g.teacherName}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(g.slotsForThisRoom?.length ? g.slotsForThisRoom : g.scheduleSlots ?? []).map((s, idx) => (
                        <Badge key={idx} variant="info">
                          {ARABIC_DAYS[s.dayOfWeek]}: {formatTimeRangeAr(s.startTime, s.endTime)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
