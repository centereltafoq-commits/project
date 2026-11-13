import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Select, useToast } from '@/design-system';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { ARABIC_DAYS } from '@/lib/formatters';
import { TeacherAvailabilitySlot } from './teachers.types';

interface TeacherAvailabilityTabProps {
  teacherId: string;
  initialSlots: TeacherAvailabilitySlot[];
  canEdit?: boolean;
}

export function TeacherAvailabilityTab({
  teacherId,
  initialSlots,
  canEdit = false,
}: TeacherAvailabilityTabProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [slots, setSlots] = React.useState<TeacherAvailabilitySlot[]>(initialSlots);

  React.useEffect(() => {
    setSlots(initialSlots);
  }, [initialSlots]);

  const validationError = React.useMemo(() => {
    for (let i = 0; i < slots.length; i++) {
      const a = slots[i];
      const aStart = a.startTime.slice(0, 5);
      const aEnd = a.endTime.slice(0, 5);
      if (!aStart || !aEnd || aStart >= aEnd) {
        const dayLabel = ARABIC_DAYS[Number(a.dayOfWeek)] ?? String(a.dayOfWeek);
        return `وقت النهاية يجب أن يكون بعد وقت البداية ليوم ${dayLabel}.`;
      }
      for (let j = i + 1; j < slots.length; j++) {
        const b = slots[j];
        if (Number(a.dayOfWeek) !== Number(b.dayOfWeek)) continue;
        const bStart = b.startTime.slice(0, 5);
        const bEnd = b.endTime.slice(0, 5);
        const dayLabel = ARABIC_DAYS[Number(a.dayOfWeek)] ?? String(a.dayOfWeek);
        if (aStart === bStart && aEnd === bEnd) {
          return `لا يمكن تكرار نفس فترة الإتاحة مرتين (يوم ${dayLabel}: ${aStart} - ${aEnd}).`;
        }
        if (aStart < bEnd && aEnd > bStart) {
          return `يوجد تداخل بين فترتي إتاحة في يوم ${dayLabel} (${aStart} - ${aEnd} و ${bStart} - ${bEnd}).`;
        }
      }
    }
    return null;
  }, [slots]);

  const saveMutation = useMutation({
    mutationFn: async () =>
      apiClient.put(`/teachers/${teacherId}/availability`, {
        slots: slots.map((s) => ({
          dayOfWeek: Number(s.dayOfWeek),
          startTime: s.startTime.slice(0, 5),
          endTime: s.endTime.slice(0, 5),
          isActive: s.isActive,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-profile', teacherId] });
      notify('تم حفظ أوقات إتاحة المدرس بنجاح', 'success');
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const handleSave = () => {
    if (validationError) {
      notify(validationError, 'error');
      return;
    }
    saveMutation.mutate();
  };

  const addSlot = () => {
    const usedDays = new Set(slots.map((s) => Number(s.dayOfWeek)));
    const nextDay = [0, 1, 2, 3, 4, 5, 6].find((d) => !usedDays.has(d)) ?? 0;
    setSlots((prev) => [
      ...prev,
      { dayOfWeek: nextDay, startTime: '14:00', endTime: '18:00', isActive: true },
    ]);
  };

  const updateSlot = (idx: number, patch: Partial<TeacherAvailabilitySlot>) => {
    setSlots((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  const removeSlot = (idx: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>أوقات الإتاحة الأسبوعية</CardTitle>
          <p className="text-xs text-muted-foreground">
            تُستخدم هذه الفترات لبيان الأوقات الأسبوعية المتاحة للمدرس داخل السنتر
          </p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addSlot}>
              <Plus className="h-4 w-4" />
              إضافة فترة إتاحة
            </Button>
            <Button
              type="button"
              size="sm"
              isLoading={saveMutation.isPending}
              onClick={handleSave}
            >
              <Save className="h-4 w-4" />
              حفظ الإتاحة
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {validationError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
          >
            {validationError}
          </div>
        )}
        {slots.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {canEdit
              ? 'لم يتم تحديد أوقات إتاحة أسبوعية بعد. اضغط "إضافة فترة إتاحة" للبدء.'
              : 'لم يتم تحديد أوقات إتاحة أسبوعية لهذا المدرس بعد.'}
          </p>
        ) : (
          slots.map((slot, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 items-end gap-3 rounded-xl border border-border bg-muted/20 p-3 sm:grid-cols-5"
            >
              <Select
                searchable
                label="اليوم"
                disabled={!canEdit}
                value={String(slot.dayOfWeek)}
                onChange={(e) => updateSlot(idx, { dayOfWeek: Number(e.target.value) })}
                options={ARABIC_DAYS.map((day, dIdx) => ({ value: String(dIdx), label: day }))}
              />
              <Input
                label="من الساعة"
                type="time"
                disabled={!canEdit}
                value={slot.startTime.slice(0, 5)}
                onChange={(e) => updateSlot(idx, { startTime: e.target.value })}
              />
              <Input
                label="إلى الساعة"
                type="time"
                disabled={!canEdit}
                value={slot.endTime.slice(0, 5)}
                onChange={(e) => updateSlot(idx, { endTime: e.target.value })}
              />
              <label className="flex h-10 cursor-pointer items-center gap-2 px-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  disabled={!canEdit}
                  checked={slot.isActive}
                  onChange={(e) => updateSlot(idx, { isActive: e.target.checked })}
                  className="h-4 w-4"
                />
                فترة مفعّلة
              </label>
              <div className="flex justify-end">
                {canEdit && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => removeSlot(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                    حذف
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
