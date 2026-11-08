import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClassroomStatus } from '@edu-center/shared';
import { Button, Input, Modal, Select, Textarea, useToast } from '@/design-system';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { CLASSROOM_STATUS_OPTIONS, ClassroomRow } from './classrooms.types';

interface ClassroomFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroom?: ClassroomRow | null;
}

export function ClassroomFormModal({
  open,
  onOpenChange,
  classroom,
}: ClassroomFormModalProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const isEdit = Boolean(classroom);

  const [form, setForm] = React.useState({
    roomNumber: '',
    name: '',
    maxCapacity: '40',
    seatsCount: '40',
    equipmentText: '',
    status: ClassroomStatus.AVAILABLE,
    notes: '',
  });

  React.useEffect(() => {
    if (classroom) {
      setForm({
        roomNumber: classroom.roomNumber,
        name: classroom.name,
        maxCapacity: String(classroom.maxCapacity),
        seatsCount: String(classroom.seatsCount),
        equipmentText: (classroom.equipment ?? []).join('، '),
        status: classroom.status,
        notes: classroom.notes ?? '',
      });
    } else {
      setForm({
        roomNumber: '',
        name: '',
        maxCapacity: '40',
        seatsCount: '40',
        equipmentText: 'شاشة ذكية، تكييف، سبورة بيضاء',
        status: ClassroomStatus.AVAILABLE,
        notes: '',
      });
    }
  }, [classroom, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const equipment = form.equipmentText
        .split(/[,،]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        roomNumber: form.roomNumber.trim(),
        name: form.name.trim(),
        maxCapacity: Number(form.maxCapacity),
        seatsCount: Number(form.seatsCount),
        equipment,
        status: form.status,
        notes: form.notes || undefined,
      };
      if (isEdit && classroom) {
        return apiClient.patch(`/classrooms/${classroom.id}`, payload);
      }
      return apiClient.post('/classrooms', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      notify(isEdit ? 'تم تحديث بيانات القاعة' : 'تمت إضافة القاعة بنجاح', 'success');
      onOpenChange(false);
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={isEdit ? 'تعديل بيانات القاعة' : 'إضافة قاعة دراسية جديدة'}
      description="حدد رقم القاعة، السعة القصوى، عدد المقاعد، والتجهيزات المتوفرة"
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
            label="رقم / كود القاعة"
            required
            value={form.roomNumber}
            onChange={(e) => setForm({ ...form, roomNumber: e.target.value })}
            placeholder="مثال: R-101"
          />
          <Input
            label="اسم القاعة"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="مثال: قاعة الدكتور أحمد زويل"
          />
          <Input
            label="السعة القصوى للطلاب"
            type="number"
            min={1}
            required
            value={form.maxCapacity}
            onChange={(e) => setForm({ ...form, maxCapacity: e.target.value })}
          />
          <Input
            label="عدد المقاعد الفعلي"
            type="number"
            min={1}
            required
            value={form.seatsCount}
            onChange={(e) => setForm({ ...form, seatsCount: e.target.value })}
          />
          <Select
            searchable
            label="حالة القاعة"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as ClassroomStatus })}
            options={CLASSROOM_STATUS_OPTIONS}
          />
          <Input
            label="التجهيزات (مفصولة بفاصلة)"
            value={form.equipmentText}
            onChange={(e) => setForm({ ...form, equipmentText: e.target.value })}
            placeholder="بروجيكتور، تكييف، مايكروفون..."
          />
        </div>
        <Textarea
          label="ملاحظات القاعة"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            {isEdit ? 'حفظ التعديلات' : 'إضافة القاعة'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
