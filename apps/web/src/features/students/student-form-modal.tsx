import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { StudentStatus } from '@edu-center/shared';
import { Button, DatePicker, Input, Modal, Select, Textarea, useToast } from '@/design-system';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { getTodayIsoDate } from '@/lib/formatters';
import { useGradeLevels } from '../grade-levels/use-grade-levels';
import { STUDENT_STATUS_OPTIONS, StudentRow } from './students.types';

interface StudentFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: StudentRow | null;
}

export function StudentFormModal({ open, onOpenChange, student }: StudentFormModalProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const isEdit = Boolean(student);
  const { gradeLevels: allGradeLevels, isLoading: isLoadingGrades } = useGradeLevels(false);
  const activeGradeOptions = React.useMemo(
    () =>
      allGradeLevels
        .filter((g) => g.isActive)
        .map((g) => ({ value: g.name, label: g.name })),
    [allGradeLevels],
  );

  const gradeOptions = React.useMemo(() => {
    const currentGrade = student?.gradeLevel;
    if (!currentGrade || activeGradeOptions.some((o) => o.value === currentGrade)) {
      return activeGradeOptions;
    }
    const matchedAll = allGradeLevels.find((g) => g.name === currentGrade);
    return [
      {
        value: currentGrade,
        label: matchedAll ? `${currentGrade} (غير مفعّل)` : `${currentGrade} (سجل سابق)`,
      },
      ...activeGradeOptions,
    ];
  }, [activeGradeOptions, allGradeLevels, student?.gradeLevel]);

  const defaultGrade = activeGradeOptions[0]?.value ?? '';

  const [form, setForm] = React.useState({
    studentCode: '',
    fullName: '',
    phone: '',
    guardianPhone: '',
    gradeLevel: '',
    registrationDate: getTodayIsoDate(),
    status: StudentStatus.ACTIVE,
    notes: '',
  });

  React.useEffect(() => {
    if (!open) return;
    if (student) {
      setForm({
        studentCode: student.studentCode,
        fullName: student.fullName,
        phone: student.phone ?? '',
        guardianPhone: student.guardianPhone ?? '',
        gradeLevel: student.gradeLevel,
        registrationDate: student.registrationDate?.slice(0, 10) || getTodayIsoDate(),
        status: student.status,
        notes: student.notes ?? '',
      });
    } else {
      setForm({
        studentCode: '',
        fullName: '',
        phone: '',
        guardianPhone: '',
        gradeLevel: defaultGrade,
        registrationDate: getTodayIsoDate(),
        status: StudentStatus.ACTIVE,
        notes: '',
      });
    }
  }, [student, open, defaultGrade]);

  const mutation = useMutation({
    mutationFn: async () => {
      const normalizedPhone = form.phone.trim();
      const normalizedGuardian = form.guardianPhone.trim();
      if (isEdit && student) {
        const { studentCode: _code, ...payload } = form;
        return apiClient.patch(`/students/${student.id}`, {
          ...payload,
          phone: normalizedPhone,
          guardianPhone: normalizedGuardian,
        });
      }
      return apiClient.post('/students', {
        ...form,
        phone: normalizedPhone || undefined,
        guardianPhone: normalizedGuardian || undefined,
        studentCode: form.studentCode.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      if (student) {
        queryClient.invalidateQueries({ queryKey: ['student-profile', student.id] });
      }
      notify(isEdit ? 'تم تحديث بيانات الطالب بنجاح' : 'تم تسجيل الطالب بنجاح', 'success');
      onOpenChange(false);
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={isEdit ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}
      description="سجّل البيانات الأساسية للطالب وولي الأمر لحفظ ملف دائم بالسنتر"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.gradeLevel.trim()) {
            notify('يرجى إضافة صف دراسي وتحديده أولاً من «إدارة الصفوف الدراسية»', 'error');
            return;
          }
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="الاسم الرباعي للطالب"
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            placeholder="مثال: أحمد محمد عبد الرحمن"
          />
          <Input
            label="كود الطالب (اختياري - يولّد تلقائياً)"
            disabled={isEdit}
            value={form.studentCode}
            onChange={(e) => setForm({ ...form, studentCode: e.target.value })}
            placeholder="STU-2026-XXXX"
          />
          <Input
            label="رقم هاتف الطالب (اختياري)"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="010xxxxxxxx"
          />
          <Input
            label="رقم هاتف ولي الأمر (اختياري)"
            value={form.guardianPhone}
            onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
            placeholder="011xxxxxxxx"
          />
          <Select
            label="الصف الدراسي"
            required
            searchable
            placeholder={
              gradeOptions.length === 0
                ? 'لا توجد صفوف دراسية مسجلة'
                : 'اختر الصف الدراسي...'
            }
            searchPlaceholder="ابحث في المراحل والصفوف..."
            emptyText="لا توجد صفوف دراسية مفعّلة. أضف صفاً من «إدارة الصفوف الدراسية» أولاً."
            error={
              !isLoadingGrades && gradeOptions.length === 0
                ? 'لا توجد صفوف دراسية مفعّلة حالياً. أضف صفاً من «إدارة الصفوف الدراسية» أولاً.'
                : undefined
            }
            value={form.gradeLevel}
            onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })}
            options={gradeOptions}
          />
          <DatePicker
            label="تاريخ التسجيل"
            value={form.registrationDate}
            onChange={(d) => setForm({ ...form, registrationDate: d })}
          />
          <Select
            searchable
            label="حالة ملف الطالب"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as StudentStatus })}
            options={STUDENT_STATUS_OPTIONS}
          />
        </div>
        <Textarea
          label="ملاحظات إدارية أو طبية"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="أي ملاحظات خاصة بالطالب..."
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            {isEdit ? 'حفظ التعديلات' : 'حفظ ملف الطالب'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
