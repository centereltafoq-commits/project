import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExpenseCategory, PaymentMethod } from '@edu-center/shared';
import {
  Button,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from '@/design-system';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { getTodayIsoDate } from '@/lib/formatters';
import {
  EXPENSE_CATEGORY_OPTIONS,
  ExpenseRow,
  PAYMENT_METHOD_OPTIONS,
} from '../finance.types';

interface ExpenseFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  yearMonth: string;
  editing: ExpenseRow | null;
}

export function ExpenseFormModal({
  open,
  onOpenChange,
  yearMonth,
  editing,
}: ExpenseFormModalProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const [form, setForm] = React.useState({
    category: ExpenseCategory.RENT as string,
    title: '',
    amount: '',
    expenseDate: getTodayIsoDate(),
    paymentMethod: PaymentMethod.CASH as string,
    notes: '',
  });

  React.useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        category: editing.category,
        title: editing.title,
        amount: String(editing.amount),
        expenseDate: editing.expenseDate,
        paymentMethod: editing.paymentMethod,
        notes: editing.notes || '',
      });
    } else {
      setForm({
        category: ExpenseCategory.RENT,
        title: '',
        amount: '',
        expenseDate: getTodayIsoDate(),
        paymentMethod: PaymentMethod.CASH,
        notes: '',
      });
    }
  }, [open, editing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        category: form.category,
        title: form.title,
        amount: Number(form.amount),
        expenseDate: form.expenseDate,
        yearMonth,
        paymentMethod: form.paymentMethod,
        notes: form.notes || undefined,
      };
      if (editing) {
        return apiClient.patch(`/finance/expenses/${editing.id}`, payload);
      }
      return apiClient.post('/finance/expenses', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      onOpenChange(false);
      notify(editing ? 'تم تعديل المصروف بنجاح' : 'تم تسجيل المصروف بنجاح', 'success');
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? 'تعديل مصروف السنتر' : 'تسجيل مصروف جديد للسنتر'}
      description="توثيق الإيجار والكهرباء والإنترنت والصيانة والمستلزمات والمصروفات الإدارية"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
        className="space-y-4"
      >
        <Select
          label="بند المصروف"
          required
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          options={EXPENSE_CATEGORY_OPTIONS}
        />
        <Input
          label="بيان / عنوان المصروف"
          required
          placeholder="مثال: إيجار مقر السنتر الرئيسي"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="المبلغ (ج.م)"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <Select
            label="وسيلة السداد"
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
            options={PAYMENT_METHOD_OPTIONS}
          />
        </div>
        <Input
          label="تاريخ المصروف"
          type="date"
          required
          value={form.expenseDate}
          onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
        />
        <Textarea
          label="ملاحظات إضافية"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="submit" isLoading={saveMutation.isPending}>
            {editing ? 'حفظ التعديلات' : 'حفظ المصروف'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
