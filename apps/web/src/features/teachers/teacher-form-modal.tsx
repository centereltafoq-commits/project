import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { TeacherEmploymentStatus } from '@edu-center/shared';
import { Button, DatePicker, Input, Modal, Select, Textarea, useToast } from '@/design-system';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { getTodayIsoDate } from '@/lib/formatters';
import { TEACHER_STATUS_OPTIONS, TeacherRow } from './teachers.types';

interface TeacherFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher?: TeacherRow | null;
}

export function TeacherFormModal({ open, onOpenChange, teacher }: TeacherFormModalProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const isEdit = Boolean(teacher);

  const [form, setForm] = React.useState({
    teacherCode: '',
    fullName: '',
    phone: '',
    specialization: '',
    contractDate: getTodayIsoDate(),
    employmentStatus: TeacherEmploymentStatus.ACTIVE,
    canApproveBookings: true,
    notes: '',
  });

  React.useEffect(() => {
    if (teacher) {
      setForm({
        teacherCode: teacher.teacherCode,
        fullName: teacher.fullName,
        phone: teacher.phone,
        specialization: teacher.specialization,
        contractDate: teacher.contractDate?.slice(0, 10) || getTodayIsoDate(),
        employmentStatus: teacher.employmentStatus,
        canApproveBookings: teacher.canApproveBookings,
        notes: teacher.notes ?? '',
      });
    } else {
      setForm({
        teacherCode: '',
        fullName: '',
        phone: '',
        specialization: '',
        contractDate: getTodayIsoDate(),
        employmentStatus: TeacherEmploymentStatus.ACTIVE,
        canApproveBookings: true,
        notes: '',
      });
    }
  }, [teacher, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (isEdit && teacher) {
        const { teacherCode: _code, ...payload } = form;
        return apiClient.patch(`/teachers/${teacher.id}`, payload);
      }
      return apiClient.post('/teachers', {
        ...form,
        teacherCode: form.teacherCode.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      if (teacher) {
        queryClient.invalidateQueries({ queryKey: ['teacher-profile', teacher.id] });
      }
      notify(isEdit ? 'تم تحديث ملف المدرس بنجاح' : 'تم إضافة المدرس بنجاح', 'success');
      onOpenChange(false);
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={isEdit ? 'تعديل بيانات المدرس' : 'إضافة مدرس جديد'}
      description="أدخل بيانات المدرس وتخصصه وصلاحيات اعتماد المواعيد"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="الاسم الكامل للمدرس"
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            placeholder="مثال: أ. محمود السيد"
          />
          <Input
            label="كود المدرس (اختياري - يولّد تلقائياً)"
            disabled={isEdit}
            value={form.teacherCode}
            onChange={(e) => setForm({ ...form, teacherCode: e.target.value })}
            placeholder="TCH-XXXX"
          />
          <Input
            label="رقم الهاتف"
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label="التخصص / المادة العلمية"
            required
            value={form.specialization}
            onChange={(e) => setForm({ ...form, specialization: e.target.value })}
            placeholder="مثال: فيزياء - المرحلة الثانوية"
          />
          <DatePicker
            label="تاريخ التعاقد"
            value={form.contractDate}
            onChange={(d) => setForm({ ...form, contractDate: d })}
          />
          <Select
            searchable
            label="حالة العمل بالسنتر"
            value={form.employmentStatus}
            onChange={(e) =>
              setForm({
                ...form,
                employmentStatus: e.target.value as TeacherEmploymentStatus,
              })
            }
            options={TEACHER_STATUS_OPTIONS}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={form.canApproveBookings}
            onChange={(e) => setForm({ ...form, canApproveBookings: e.target.checked })}
            className="h-4 w-4 rounded border-input"
          />
          السماح للمدرس باعتماد طلبات حجوزات المواعيد مع الطلاب
        </label>

        <Textarea
          label="ملاحظات التعاقد"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            {isEdit ? 'حفظ التعديلات' : 'حفظ ملف المدرس'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
