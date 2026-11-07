import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PaymentMethod } from '@edu-center/shared';
import {
  Button,
  DatePicker,
  Input,
  Modal,
  Select,
  Textarea,
  useToast,
} from '@/design-system';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { formatCurrency, getTodayIsoDate } from '@/lib/formatters';
import { PAYMENT_METHOD_OPTIONS } from '../finance.types';

export interface PayoutTargetPreset {
  id: string;
  name: string;
  code: string;
  remainingBalance: number;
}

interface PayoutModalProps {
  mode: 'teacher' | 'assistant';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  yearMonth: string;
  preset: PayoutTargetPreset | null;
  options: Array<{ value: string; label: string }>;
}

export function PayoutModal({
  mode,
  open,
  onOpenChange,
  yearMonth,
  preset,
  options,
}: PayoutModalProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const [targetId, setTargetId] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [paymentMethod, setPaymentMethod] = React.useState<string>(PaymentMethod.CASH);
  const [payoutDate, setPayoutDate] = React.useState(getTodayIsoDate());
  const [referenceNumber, setReferenceNumber] = React.useState('');
  const [notes, setNotes] = React.useState('');

  const isTeacher = mode === 'teacher';

  React.useEffect(() => {
    if (!open) return;
    if (preset) {
      setTargetId(preset.id);
      setAmount(preset.remainingBalance > 0 ? String(preset.remainingBalance) : '');
    } else {
      setTargetId('');
      setAmount('');
    }
    setPaymentMethod(PaymentMethod.CASH);
    setPayoutDate(getTodayIsoDate());
    setReferenceNumber('');
    setNotes('');
  }, [open, preset]);

  const payoutMutation = useMutation({
    mutationFn: async () => {
      const endpoint = isTeacher
        ? '/finance/teacher-payouts'
        : '/finance/assistant-payouts';
      const idKey = isTeacher ? 'teacherId' : 'assistantId';

      const res = await apiClient.post(endpoint, {
        [idKey]: targetId,
        yearMonth,
        amount: Number(amount),
        payoutDate,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      onOpenChange(false);
      notify(
        isTeacher ? 'تم تسجيل صرفية المدرس بنجاح' : 'تم تسجيل صرفية المساعد بنجاح',
        'success',
      );
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isTeacher ? 'صرف دفعة للمدرس' : 'صرف دفعة للمساعد'}
      description="تسجيل صرفية مالية وتحديث الرصيد المتبقي للشهر المحدد تلقائياً"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          payoutMutation.mutate();
        }}
        className="space-y-4"
      >
        {preset ? (
          <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-sm space-y-1">
            <div className="font-bold text-foreground">
              {preset.name} ({preset.code})
            </div>
            <div className="text-xs text-muted-foreground">
              الرصيد المتبقي للصرف:{' '}
              <strong className="text-amber-600 dark:text-amber-400">
                {formatCurrency(preset.remainingBalance)}
              </strong>
            </div>
          </div>
        ) : (
          <Select
            label={isTeacher ? 'المدرس' : 'المساعد'}
            required
            searchable
            searchPlaceholder={isTeacher ? 'ابحث باسم المدرس أو الكود...' : 'ابحث باسم المساعد أو الكود...'}
            placeholder={isTeacher ? 'اختر المدرس...' : 'اختر المساعد...'}
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            options={options}
          />
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="مبلغ الصرف (ج.م)"
            type="number"
            step="0.01"
            min="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Select
            label="وسيلة الصرف"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            options={PAYMENT_METHOD_OPTIONS}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DatePicker
            label="تاريخ الصرف"
            value={payoutDate}
            onChange={setPayoutDate}
          />
          <Input
            label="رقم المرجع (اختياري)"
            placeholder={isTeacher ? 'يُولّد تلقائياً TPY-...' : 'يُولّد تلقائياً APY-...'}
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
          />
        </div>

        <Textarea
          label="ملاحظات الصرف"
          placeholder="تصفية مستحقات الشهر، دفعة تحت الحساب..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="submit" isLoading={payoutMutation.isPending}>
            تأكيد الصرف
          </Button>
        </div>
      </form>
    </Modal>
  );
}
