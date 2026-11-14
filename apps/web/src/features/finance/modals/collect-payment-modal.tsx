import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PaymentMethod } from '@edu-center/shared';
import {
  Button,
  DatePicker,
  Input,
  Modal,
  MonthPicker,
  Select,
  Textarea,
  useToast,
} from '@/design-system';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import {
  formatCurrency,
  formatDateAr,
  formatYearMonthAr,
  getTodayIsoDate,
} from '@/lib/formatters';
import {
  FinanceLookups,
  PAYMENT_METHOD_OPTIONS,
  PaymentRow,
  StudentMonthlyRecordRow,
} from '../finance.types';

export interface PresetStudentPaymentTarget {
  id: string;
  fullName: string;
  studentCode: string;
  remainingBalance?: number;
  groupId?: string;
  groupName?: string;
}

interface CollectPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  yearMonth: string;
  presetRecord?: StudentMonthlyRecordRow | null;
  presetStudent?: PresetStudentPaymentTarget | null;
  lookups?: FinanceLookups;
  onReceiptCreated: (receipt: PaymentRow) => void;
}

export function CollectPaymentModal({
  open,
  onOpenChange,
  yearMonth,
  presetRecord = null,
  presetStudent = null,
  lookups,
  onReceiptCreated,
}: CollectPaymentModalProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const [studentId, setStudentId] = React.useState('');
  const [groupId, setGroupId] = React.useState('');
  const [targetYearMonth, setTargetYearMonth] = React.useState(yearMonth);
  const [amount, setAmount] = React.useState('');
  const [paymentMethod, setPaymentMethod] = React.useState<string>(PaymentMethod.CASH);
  const [paymentDate, setPaymentDate] = React.useState(getTodayIsoDate());
  const [receiptNumber, setReceiptNumber] = React.useState('');
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    if (presetRecord) {
      setStudentId(presetRecord.studentId);
      setGroupId(presetRecord.groupId);
      setTargetYearMonth(presetRecord.yearMonth || yearMonth);
      setAmount(
        presetRecord.remainingBalance > 0
          ? String(presetRecord.remainingBalance)
          : '',
      );
    } else if (presetStudent) {
      setStudentId(presetStudent.id);
      setGroupId(presetStudent.groupId ?? '');
      setTargetYearMonth(yearMonth);
      setAmount(
        presetStudent.remainingBalance && presetStudent.remainingBalance > 0
          ? String(presetStudent.remainingBalance)
          : '',
      );
    } else {
      setStudentId('');
      setGroupId('');
      setTargetYearMonth(yearMonth);
      setAmount('');
    }
    setPaymentMethod(PaymentMethod.CASH);
    setPaymentDate(getTodayIsoDate());
    setReceiptNumber('');
    setNotes('');
  }, [open, presetRecord, presetStudent, yearMonth]);

  const effectiveRemainingBalance =
    presetRecord?.remainingBalance ?? presetStudent?.remainingBalance;

  const isCrossMonthPayment =
    Boolean(paymentDate) && targetYearMonth !== paymentDate.slice(0, 7);

  const collectMutation = useMutation({
    mutationFn: async () => {
      const numericAmount = Number(amount);
      const payload = {
        studentId,
        yearMonth: targetYearMonth,
        amount: numericAmount,
        paymentDate,
        paymentMethod,
        receiptNumber: receiptNumber.trim() || undefined,
        notes: notes.trim() || undefined,
        allocations: groupId ? [{ groupId, amount: numericAmount }] : undefined,
      };
      const res = await apiClient.post<PaymentRow>('/finance/payments', payload);
      return res.data;
    },
    onSuccess: (createdReceipt) => {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      queryClient.invalidateQueries({ queryKey: ['report-data'] });
      onOpenChange(false);
      notify('تم تحصيل الدفعة وإصدار الإيصال بنجاح', 'success');
      onReceiptCreated(createdReceipt);
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="تسجيل دفعة / إيصال تحصيل طالب"
      description="يدعم التحصيل الكلي أو الجزئي أو تحصيل متأخرات أي شهر سابق مع التوزيع التلقائي أو المحدد"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const numericAmount = Number(amount);
          if (
            effectiveRemainingBalance !== undefined &&
            effectiveRemainingBalance > 0 &&
            numericAmount > effectiveRemainingBalance
          ) {
            notify(
              `المبلغ المدفوع لا يمكن أن يتجاوز الرصيد المتبقي على الطالب (${effectiveRemainingBalance} ج.م)`,
              'error',
            );
            return;
          }
          collectMutation.mutate();
        }}
        className="space-y-4"
      >
        {presetRecord ? (
          <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-sm space-y-1">
            <div className="font-bold text-foreground">
              {presetRecord.studentName} ({presetRecord.studentCode})
            </div>
            <div className="text-xs text-muted-foreground">
              المجموعة: <strong>{presetRecord.groupName}</strong> — الشهر:{' '}
              <strong>{formatYearMonthAr(targetYearMonth)}</strong> — المتبقي الحالي:{' '}
              <strong className="text-rose-600 dark:text-rose-400">
                {formatCurrency(presetRecord.remainingBalance)}
              </strong>
            </div>
          </div>
        ) : presetStudent ? (
          <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-sm space-y-1">
            <div className="font-bold text-foreground">
              {presetStudent.fullName} ({presetStudent.studentCode})
            </div>
            <div className="text-xs text-muted-foreground">
              {presetStudent.groupName ? (
                <>
                  المجموعة: <strong>{presetStudent.groupName}</strong> —{' '}
                </>
              ) : null}
              الشهر المستحق: <strong>{formatYearMonthAr(targetYearMonth)}</strong>
              {presetStudent.remainingBalance !== undefined ? (
                <>
                  {' '}
                  — المتبقي الحالي:{' '}
                  <strong className="text-rose-600 dark:text-rose-400">
                    {formatCurrency(presetStudent.remainingBalance)}
                  </strong>
                </>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <Select
              label="الطالب"
              required
              searchable
              searchPlaceholder="ابحث باسم الطالب أو كود الطالب..."
              placeholder="اختر الطالب..."
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              options={(lookups?.students ?? []).map((s) => ({
                value: s.id,
                label: `${s.fullName} (${s.code})`,
              }))}
            />
            <Select
              label="تخصيص لمجموعة محددة (اختياري)"
              searchable
              clearable
              searchPlaceholder="ابحث باسم المجموعة أو الكود..."
              placeholder="توزيع تلقائي على مستحقات الطالب غير المسددة"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              options={(lookups?.groups ?? []).map((g) => ({
                value: g.id,
                label: `${g.name} (${g.code})`,
              }))}
            />
          </>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MonthPicker
            label="الشهر المستحق السداد عنه"
            value={targetYearMonth}
            disabled={Boolean(presetRecord)}
            onChange={setTargetYearMonth}
            className="w-full"
          />
          <DatePicker
            label="تاريخ السداد الفعلي (اليوم)"
            value={paymentDate}
            onChange={setPaymentDate}
          />
        </div>

        {isCrossMonthPayment && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs font-semibold leading-relaxed text-amber-800 dark:text-amber-300">
            سيتم خصم هذه الدفعة من متأخرات شهر{' '}
            <strong>{formatYearMonthAr(targetYearMonth)}</strong>، بينما ستُسجّل حركة النقدية في
            يومية وتقارير تحصيل تاريخ <strong>{formatDateAr(paymentDate)}</strong>.
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="المبلغ المحصّل (ج.م)"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="مثال: 126"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Select
            searchable
            label="وسيلة الدفع"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            options={PAYMENT_METHOD_OPTIONS}
          />
        </div>

        <Input
          label="رقم إيصال يدوي (اختياري)"
          placeholder="يُولّد تلقائياً RCP-..."
          value={receiptNumber}
          onChange={(e) => setReceiptNumber(e.target.value)}
        />

        <Textarea
          label="ملاحظات الإيصال"
          placeholder="دفعة تحت الحساب، سداد باقي الشهر..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="submit" variant="success" isLoading={collectMutation.isPending}>
            تأكيد التحصيل وإصدار الإيصال
          </Button>
        </div>
      </form>
    </Modal>
  );
}
