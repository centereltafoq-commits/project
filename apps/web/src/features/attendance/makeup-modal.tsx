import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MakeupStatus, PaginatedResult } from '@edu-center/shared';
import { Button, DatePicker, Input, Modal, Select, Textarea, useToast } from '@/design-system';
import { cn } from '@/lib/cn';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { formatDateAr, formatTimeAr, getTodayIsoDate } from '@/lib/formatters';
import {
  AttendanceLookups,
  MakeupSessionRow,
  SessionRow,
} from './attendance.types';

interface MakeupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRow: MakeupSessionRow | null;
  lookups?: AttendanceLookups;
}

export function MakeupModal({
  open,
  onOpenChange,
  editingRow,
  lookups,
}: MakeupModalProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const [studentId, setStudentId] = React.useState('');
  const [originalSessionId, setOriginalSessionId] = React.useState('');
  const [absenceDate, setAbsenceDate] = React.useState(getTodayIsoDate());
  const [scheduledLocal, setScheduledLocal] = React.useState('');
  const [classroomId, setClassroomId] = React.useState('');
  const [isFree, setIsFree] = React.useState(true);
  const [extraFee, setExtraFee] = React.useState('0');
  const [status, setStatus] = React.useState<MakeupStatus>(MakeupStatus.SCHEDULED);
  const [notes, setNotes] = React.useState('');

  const { data: recentSessions } = useQuery<PaginatedResult<SessionRow>>({
    queryKey: ['attendance-sessions-lookup'],
    enabled: open && !editingRow,
    queryFn: async () =>
      (await apiClient.get('/attendance/sessions', { params: { page: 1, limit: 100 } })).data,
  });

  React.useEffect(() => {
    if (editingRow) {
      setStudentId(editingRow.studentId);
      setOriginalSessionId(editingRow.originalSessionId);
      setAbsenceDate(editingRow.absenceDate);
      setScheduledLocal(
        editingRow.scheduledAt ? editingRow.scheduledAt.slice(0, 16) : '',
      );
      setClassroomId(editingRow.classroomId ?? '');
      setIsFree(editingRow.isFree);
      setExtraFee(String(editingRow.extraFee ?? '0'));
      setStatus((editingRow.status as MakeupStatus) || MakeupStatus.SCHEDULED);
      setNotes(editingRow.notes ?? '');
    } else {
      setStudentId('');
      setOriginalSessionId('');
      setAbsenceDate(getTodayIsoDate());
      setScheduledLocal('');
      setClassroomId('');
      setIsFree(true);
      setExtraFee('0');
      setStatus(MakeupStatus.SCHEDULED);
      setNotes('');
    }
  }, [editingRow, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const isoScheduled = scheduledLocal ? new Date(scheduledLocal).toISOString() : undefined;
      if (editingRow) {
        return apiClient.patch(`/attendance/makeups/${editingRow.id}`, {
          status,
          scheduledAt: isoScheduled,
          classroomId: classroomId || undefined,
          isFree,
          extraFee: isFree ? 0 : Number(extraFee),
          notes: notes || undefined,
        });
      }
      return apiClient.post('/attendance/makeups', {
        studentId,
        originalSessionId,
        absenceDate,
        scheduledAt: isoScheduled,
        classroomId: classroomId || undefined,
        isFree,
        extraFee: isFree ? 0 : Number(extraFee),
        status,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-makeups'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      notify(
        editingRow
          ? 'تم تحديث بيانات الحصة التعويضية بنجاح'
          : 'تم تسجيل وجدولة الحصة التعويضية بنجاح',
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
      title={editingRow ? 'تعديل واعتماد حصة تعويضية' : 'جدولة حصة تعويضية جديدة'}
      description="حدد موعد التعويض والقاعة وما إذا كانت مجانية أو برسوم إضافية"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (status === MakeupStatus.SCHEDULED && !scheduledLocal) {
            notify('يجب تحديد موعد انعقاد الحصة التعويضية عند اختيار الحالة مجدولة', 'info');
            return;
          }
          mutation.mutate();
        }}
        className="space-y-4"
      >
        {!editingRow && (
          <>
            <Select
              label="الطالب"
              required
              searchable
              searchPlaceholder="ابحث باسم الطالب أو الكود..."
              placeholder="اختر الطالب..."
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              options={(lookups?.students ?? []).map((s) => ({
                value: s.id,
                label: `${s.fullName} (${s.studentCode})`,
              }))}
            />
            <Select
              label="الحصة الأصلية التي غاب عنها الطالب"
              required
              searchable
              searchPlaceholder="ابحث بالمجموعة أو التاريخ..."
              placeholder="اختر الحصة الأصلية..."
              value={originalSessionId}
              onChange={(e) => {
                const sid = e.target.value;
                setOriginalSessionId(sid);
                const found = recentSessions?.data.find((s) => s.id === sid);
                if (found) setAbsenceDate(found.sessionDate);
              }}
              options={(recentSessions?.data ?? []).map((s) => ({
                value: s.id,
                label: `${s.groupName} — ${formatDateAr(s.sessionDate)} (${formatTimeAr(s.startTime)})`,
              }))}
            />
          </>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DatePicker
            label="تاريخ الغياب الأصلي"
            disabled={Boolean(editingRow)}
            value={absenceDate}
            onChange={setAbsenceDate}
          />
          <Input
            label="موعد الحصة التعويضية"
            type="datetime-local"
            value={scheduledLocal}
            onChange={(e) => setScheduledLocal(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="القاعة الدراسية"
            searchable
            searchPlaceholder="ابحث باسم أو رقم القاعة..."
            placeholder="اختر القاعة (اختياري)"
            value={classroomId}
            onChange={(e) => setClassroomId(e.target.value)}
            options={(lookups?.classrooms ?? []).map((c) => ({
              value: c.id,
              label: `${c.name} (${c.roomNumber})`,
            }))}
          />
          <Select
            searchable
            label="حالة الحصة التعويضية"
            value={status}
            onChange={(e) => setStatus(e.target.value as MakeupStatus)}
            options={[
              { value: MakeupStatus.PENDING, label: 'قيد الانتظار' },
              { value: MakeupStatus.SCHEDULED, label: 'مجدولة ومعتمدة' },
              { value: MakeupStatus.COMPLETED, label: 'تم الحضور (تحديث الحضور تلقائياً)' },
              { value: MakeupStatus.CANCELLED, label: 'ملغاة' },
            ]}
          />
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3">
          <span className="block text-sm font-semibold text-foreground">السياسة المالية للتعويض</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsFree(true)}
              className={cn(
                'flex-1 rounded-lg border py-2 text-xs font-bold transition-colors',
                isFree
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-border bg-card text-foreground',
              )}
            >
              مجاني (ضمن الاشتراك)
            </button>
            <button
              type="button"
              onClick={() => setIsFree(false)}
              className={cn(
                'flex-1 rounded-lg border py-2 text-xs font-bold transition-colors',
                !isFree
                  ? 'border-amber-600 bg-amber-600 text-white'
                  : 'border-border bg-card text-foreground',
              )}
            >
              بتكلفة إضافية
            </button>
          </div>
          {!isFree && (
            <Input
              label="قيمة الرسوم الإضافية (ج.م)"
              type="number"
              min="0"
              step="0.01"
              required
              value={extraFee}
              onChange={(e) => setExtraFee(e.target.value)}
            />
          )}
        </div>

        <Textarea
          label="ملاحظات"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            {editingRow ? 'حفظ التعديلات' : 'اعتماد الحصة التعويضية'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
