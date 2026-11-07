import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AssistantCalculationMethod } from '@edu-center/shared';
import { Button, Input, Modal, Select, Textarea, useToast } from '@/design-system';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import {
  ASSISTANT_CALC_METHOD_OPTIONS,
  ASSISTANT_STATUS_OPTIONS,
  AssistantRow,
} from './assistants.types';

interface AssistantFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assistant?: AssistantRow | null;
}

export function AssistantFormModal({
  open,
  onOpenChange,
  assistant,
}: AssistantFormModalProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const isEdit = Boolean(assistant);

  const [form, setForm] = React.useState({
    assistantCode: '',
    fullName: '',
    phone: '',
    calculationMethod: AssistantCalculationMethod.FIXED_PER_SESSION,
    rateValue: '0',
    customFormulaNote: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  React.useEffect(() => {
    if (assistant) {
      setForm({
        assistantCode: assistant.assistantCode,
        fullName: assistant.fullName,
        phone: assistant.phone,
        calculationMethod: assistant.calculationMethod,
        rateValue: String(assistant.rateValue ?? '0'),
        customFormulaNote: assistant.customFormulaNote ?? '',
        status: assistant.status,
      });
    } else {
      setForm({
        assistantCode: '',
        fullName: '',
        phone: '',
        calculationMethod: AssistantCalculationMethod.FIXED_PER_SESSION,
        rateValue: '0',
        customFormulaNote: '',
        status: 'ACTIVE',
      });
    }
  }, [assistant, open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        fullName: form.fullName,
        phone: form.phone,
        calculationMethod: form.calculationMethod,
        rateValue: Number(form.rateValue || 0),
        customFormulaNote: form.customFormulaNote || undefined,
        status: form.status,
      };
      if (isEdit && assistant) {
        return apiClient.patch(`/assistants/${assistant.id}`, payload);
      }
      return apiClient.post('/assistants', {
        ...payload,
        assistantCode: form.assistantCode.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assistants'] });
      if (assistant) {
        queryClient.invalidateQueries({ queryKey: ['assistant-profile', assistant.id] });
      }
      notify(isEdit ? 'تم تحديث بيانات المساعد' : 'تم تسجيل المساعد بنجاح', 'success');
      onOpenChange(false);
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const isPercent =
    form.calculationMethod === AssistantCalculationMethod.SESSION_COMMISSION_PERCENT;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={isEdit ? 'تعديل بيانات المساعد' : 'إضافة مساعد جديد'}
      description="حدد بيانات المساعد وطريقة احتساب مستحقاته الشهرية بدقة"
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
            label="الاسم الكامل للمساعد"
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          />
          <Input
            label="كود المساعد (اختياري - يولّد تلقائياً)"
            disabled={isEdit}
            value={form.assistantCode}
            onChange={(e) => setForm({ ...form, assistantCode: e.target.value })}
            placeholder="AST-XXXX"
          />
          <Input
            label="رقم الهاتف"
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Select
            label="حالة العمل"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
            options={ASSISTANT_STATUS_OPTIONS}
          />
          <Select
            label="طريقة احتساب المستحقات الافتراضية"
            required
            value={form.calculationMethod}
            onChange={(e) =>
              setForm({
                ...form,
                calculationMethod: e.target.value as AssistantCalculationMethod,
              })
            }
            options={ASSISTANT_CALC_METHOD_OPTIONS}
          />
          <Input
            label={isPercent ? 'النسبة المئوية (%)' : 'القيمة المالية (ج.م)'}
            type="number"
            step="0.01"
            min={0}
            required
            value={form.rateValue}
            onChange={(e) => setForm({ ...form, rateValue: e.target.value })}
          />
        </div>
        <Textarea
          label="شرح الاتفاق المالي / ملاحظات الاحتساب"
          value={form.customFormulaNote}
          onChange={(e) => setForm({ ...form, customFormulaNote: e.target.value })}
          placeholder="وضّح تفاصيل الاتفاق المالي في حال اختيار اتفاق مخصص..."
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            {isEdit ? 'حفظ التعديلات' : 'حفظ المساعد'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
