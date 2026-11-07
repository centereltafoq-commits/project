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
}

export function TeacherAvailabilityTab({
  teacherId,
  initialSlots,
}: TeacherAvailabilityTabProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [slots, setSlots] = React.useState<TeacherAvailabilitySlot[]>(initialSlots);

  React.useEffect(() => {
    setSlots(initialSlots);
  }, [initialSlots]);

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

  const addSlot = () => {
    setSlots((prev) => [
      ...prev,
      { dayOfWeek: 0, startTime: '14:00', endTime: '18:00', isActive: true },
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
          <CardTitle>أوقات الإتاحة الأسبوعية للمواعيد والحصص الإضافية</CardTitle>
          <p className="text-xs text-muted-foreground">
            تُستخدم هذه الفترات للتحقق من توافر المدرس عند حجز مواعيد إضافية أو حصص تعويضية
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addSlot}>
            <Plus className="h-4 w-4" />
            إضافة فترة إتاحة
          </Button>
          <Button
            type="button"
            size="sm"
            isLoading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            <Save className="h-4 w-4" />
            حفظ الإتاحة
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {slots.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            لم يتم تحديد أوقات إتاحة أسبوعية بعد. اضغط &quot;إضافة فترة إتاحة&quot; للبدء.
          </p>
        ) : (
          slots.map((slot, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 items-end gap-3 rounded-xl border border-border bg-muted/20 p-3 sm:grid-cols-5"
            >
              <Select
                label="اليوم"
                value={String(slot.dayOfWeek)}
                onChange={(e) => updateSlot(idx, { dayOfWeek: Number(e.target.value) })}
                options={ARABIC_DAYS.map((day, dIdx) => ({ value: String(dIdx), label: day }))}
              />
              <Input
                label="من الساعة"
                type="time"
                value={slot.startTime.slice(0, 5)}
                onChange={(e) => updateSlot(idx, { startTime: e.target.value })}
              />
              <Input
                label="إلى الساعة"
                type="time"
                value={slot.endTime.slice(0, 5)}
                onChange={(e) => updateSlot(idx, { endTime: e.target.value })}
              />
              <label className="flex h-10 cursor-pointer items-center gap-2 px-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={slot.isActive}
                  onChange={(e) => updateSlot(idx, { isActive: e.target.checked })}
                  className="h-4 w-4"
                />
                فترة مفعّلة
              </label>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => removeSlot(idx)}
                >
                  <Trash2 className="h-4 w-4" />
                  حذف
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
