import { CheckCircle2, Printer, Building2 } from 'lucide-react';
import { Badge, Button, Modal } from '@/design-system';
import { useCenterSettings } from '@/features/settings/center-settings-context';
import {
  formatCurrency,
  formatDateAr,
  formatYearMonthAr,
} from '@/lib/formatters';
import { PAYMENT_METHOD_LABELS, PaymentRow } from '../finance.types';

interface ReceiptPrintModalProps {
  receipt: PaymentRow | null;
  onClose: () => void;
}

export function ReceiptPrintModal({ receipt, onClose }: ReceiptPrintModalProps) {
  const { settings } = useCenterSettings();

  if (!receipt) return null;

  return (
    <Modal
      open={Boolean(receipt)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="إيصال تحصيل رسوم دراسية"
      description="نسخة رسمية قابلة للطباعة الفورية وتسليمها للطالب أو ولي الأمر"
      size="lg"
    >
      <div className="space-y-4 print:text-black">
        <div className="rounded-xl border-2 border-dashed border-primary/40 bg-muted/20 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-center gap-3">
              {settings.logoUrl && (
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-card">
                  <img
                    src={settings.logoUrl}
                    alt={settings.centerName}
                    className="h-full w-full object-contain"
                  />
                </div>
              )}
              <div>
                <h4 className="text-base font-extrabold text-foreground">
                  {settings.centerName || 'سنتر النخبة التعليمي'} — الإدارة المالية
                </h4>
                <p className="text-xs text-muted-foreground">
                  شهر الاستحقاق: {formatYearMonthAr(receipt.yearMonth)}
                  {settings.phone && ` • هاتف: ${settings.phone}`}
                </p>
                {settings.address && (
                  <p className="text-[11px] text-muted-foreground">{settings.address}</p>
                )}
              </div>
            </div>
            <div className="text-left">
              <Badge variant="info" className="text-xs font-mono">
                {receipt.receiptNumber}
              </Badge>
              <p className="mt-1 text-xs text-muted-foreground">
                تاريخ السداد: {formatDateAr(receipt.paymentDate)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-card p-3 border border-border">
              <span className="text-xs text-muted-foreground block">اسم الطالب</span>
              <span className="font-bold text-foreground">{receipt.studentName}</span>
              <span className="mr-2 text-xs text-muted-foreground">
                ({receipt.studentCode})
              </span>
            </div>
            <div className="rounded-lg bg-card p-3 border border-border">
              <span className="text-xs text-muted-foreground block">وسيلة الدفع والمحصّل</span>
              <span className="font-bold text-foreground">
                {PAYMENT_METHOD_LABELS[receipt.paymentMethod] ?? receipt.paymentMethod}
              </span>
              {receipt.receivedByName && (
                <span className="mr-2 text-xs text-muted-foreground">
                  — بواسطة: {receipt.receivedByName}
                </span>
              )}
            </div>
          </div>

          {receipt.allocations && receipt.allocations.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted/60 font-bold text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">المجموعة الدراسية</th>
                    <th className="px-3 py-2">كود المجموعة</th>
                    <th className="px-3 py-2 text-left">المبلغ الموزع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {receipt.allocations.map((alloc, idx) => (
                    <tr key={`${alloc.groupId}-${idx}`}>
                      <td className="px-3 py-2 font-semibold">{alloc.groupName}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {alloc.groupCode || '—'}
                      </td>
                      <td className="px-3 py-2 text-left font-bold">
                        {formatCurrency(alloc.allocatedAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 px-4 py-3 border border-emerald-500/30">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-bold">إجمالي المبلغ المحصّل</span>
            </div>
            <span className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
              {formatCurrency(receipt.amount)}
            </span>
          </div>

          {receipt.notes && (
            <p className="text-xs text-muted-foreground">
              <strong>ملاحظات:</strong> {receipt.notes}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 no-print">
          <Button variant="outline" onClick={onClose}>
            إغلاق
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            طباعة الإيصال
          </Button>
        </div>
      </div>
    </Modal>
  );
}
