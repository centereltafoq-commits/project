import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, DatePicker, Input, Modal, MonthPicker, Select, Textarea, useToast } from '@/design-system';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { getCurrentYearMonth, getTodayIsoDate } from '@/lib/formatters';
import { AttendanceLookups } from './attendance.types';

interface CreateSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lookups?: AttendanceLookups;
}

export function CreateSessionModal({
  open,
  onOpenChange,
  lookups,
}: CreateSessionModalProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const [form, setForm] = React.useState({
    groupId: '',
    teacherId: '',
    classroomId: '',
    sessionDate: getTodayIsoDate(),
    startTime: '16:00',
    endTime: '18:00',
    topic: '',
    notes: '',
  });

  const handleGroupChange = (groupId: string) => {
    const grp = lookups?.groups.find((g) => g.id === groupId);
    setForm((prev) => ({
      ...prev,
      groupId,
      teacherId: grp?.primaryTeacherId ?? prev.teacherId,
      classroomId: grp?.defaultClassroomId ?? '',
    }));
  };

  const mutation = useMutation({
    mutationFn: async () =>
      apiClient.post('/attendance/sessions', {
        groupId: form.groupId,
        teacherId: form.teacherId || undefined,
        classroomId: form.classroomId || undefined,
        sessionDate: form.sessionDate,
        startTime: form.startTime,
        endTime: form.endTime,
        topic: form.topic || undefined,
        notes: form.notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      notify('تم إنشاء الحصة الدراسية بنجاح', 'success');
      onOpenChange(false);
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="إنشاء حصة دراسية مفردة"
      description="أضف حصة إضافية أو استثنائية لإحدى المجموعات النشطة"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <Select
          label="المجموعة الدراسية"
          required
          placeholder="اختر المجموعة..."
          value={form.groupId}
          onChange={(e) => handleGroupChange(e.target.value)}
          options={(lookups?.groups ?? []).map((g) => ({
            value: g.id,
            label: `${g.name} (${g.groupCode})`,
          }))}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="المدرس"
            placeholder="مدرس المجموعة الأساسي"
            value={form.teacherId}
            onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
            options={(lookups?.teachers ?? []).map((t) => ({
              value: t.id,
              label: t.fullName,
            }))}
          />
          <Select
            label="القاعة الدراسية"
            placeholder="اختر القاعة (اختياري)"
            value={form.classroomId}
            onChange={(e) => setForm({ ...form, classroomId: e.target.value })}
            options={(lookups?.classrooms ?? []).map((c) => ({
              value: c.id,
              label: `${c.name} (${c.roomNumber})`,
            }))}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <DatePicker
            label="تاريخ الحصة"
            value={form.sessionDate}
            onChange={(d) => setForm({ ...form, sessionDate: d })}
          />
          <Input
            label="من الساعة"
            type="time"
            required
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          />
          <Input
            label="إلى الساعة"
            type="time"
            required
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
          />
        </div>

        <Input
          label="عنوان / موضوع الدرس (اختياري)"
          value={form.topic}
          onChange={(e) => setForm({ ...form, topic: e.target.value })}
          placeholder="مثال: الباب الثاني — قوانين الحركة"
        />

        <Textarea
          label="ملاحظات"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            حفظ الحصة
          </Button>
        </div>
      </form>
    </Modal>
  );
}

interface GenerateMonthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lookups?: AttendanceLookups;
}

export function GenerateMonthModal({
  open,
  onOpenChange,
  lookups,
}: GenerateMonthModalProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const [groupId, setGroupId] = React.useState('');
  const [yearMonth, setYearMonth] = React.useState(getCurrentYearMonth());

  const mutation = useMutation({
    mutationFn: async () =>
      (await apiClient.post('/attendance/sessions/generate-month', { groupId, yearMonth })).data,
    onSuccess: (res: { createdCount: number; skippedCount: number }) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      notify(
        `تم توليد ${res.createdCount} حصة بنجاح (وتم تخطي ${res.skippedCount} حصة مسجلة مسبقاً)`,
        'success',
      );
      onOpenChange(false);
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="توليد حصص الشهر تلقائياً"
      description="ينشئ النظام حصص الشهر كاملة بناءً على المواعيد الأسبوعية الثابتة للمجموعة مع تخطي التواريخ المسجلة مسبقاً"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <Select
          label="المجموعة الدراسية"
          required
          placeholder="اختر المجموعة..."
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          options={(lookups?.groups ?? []).map((g) => ({
            value: g.id,
            label: `${g.name} (${g.groupCode}) — ${g.subject}`,
          }))}
        />

        <MonthPicker
          label="الشهر الدراسي"
          value={yearMonth}
          onChange={setYearMonth}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            توليد الحصص الآن
          </Button>
        </div>
      </form>
    </Modal>
  );
}
