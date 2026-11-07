import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, DatePicker, Modal } from '@/design-system';
import { apiClient } from '@/lib/api-client';
import { formatDateAr, formatTimeRangeAr, getTodayIsoDate } from '@/lib/formatters';
import { ClassroomRow, ClassroomScheduleData } from './classrooms.types';

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface ClassroomScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroom: ClassroomRow | null;
}

export function ClassroomScheduleModal({
  open,
  onOpenChange,
  classroom,
}: ClassroomScheduleModalProps) {
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

  if (!classroom) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={`جدول إشغال القاعة الأسبوعي: ${classroom.name} (${classroom.roomNumber})`}
      description="يعرض جميع الحصص الدراسية، الحجوزات المؤكدة، وفترات الصيانة خلال الفترة المحددة"
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/20 p-3">
          <DatePicker
            label="من تاريخ"
            value={from}
            onChange={setFrom}
          />
          <DatePicker
            label="إلى تاريخ"
            value={to}
            onChange={setTo}
          />
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
                الحصص الدراسية المجدولة ({data.sessions.length})
              </h4>
              {data.sessions.length === 0 ? (
                <p className="text-xs text-muted-foreground">لا توجد حصص مجدولة في هذه الفترة</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {data.sessions.map((s) => (
                    <div key={s.id} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{s.groupName}</span>
                        <Badge variant="info">{formatDateAr(s.sessionDate)}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        المدرس: {s.teacherName} • الوقت:{' '}
                        <span>
                          {formatTimeRangeAr(s.startTime, s.endTime)}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="mb-2 text-sm font-extrabold">
                الحجوزات الإضافية المؤكدة ({data.bookings.length})
              </h4>
              {data.bookings.length === 0 ? (
                <p className="text-xs text-muted-foreground">لا توجد حجوزات إضافية في هذه الفترة</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {data.bookings.map((b) => (
                    <div key={b.id} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{b.title}</span>
                        <Badge variant="purple">{formatDateAr(b.bookingDate)}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatTimeRangeAr(b.startTime, b.endTime)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {data.maintenances.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-extrabold text-amber-600">
                  نوافذ الصيانة ({data.maintenances.length})
                </h4>
                <div className="space-y-1.5">
                  {data.maintenances.map((m) => (
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
    </Modal>
  );
}
