import * as React from 'react';
import { CheckCircle2, Printer, Building2, Loader2 } from 'lucide-react';
import { Badge, Button, Modal } from '@/design-system';
import { useCenterSettings } from '@/features/settings/center-settings-context';
import { useDesktop } from '@/hooks/use-desktop';
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

function buildThermalReceiptHtml(receipt: PaymentRow, settings: any, currencySymbol: string): string {
  const centerName = settings?.centerName || 'سنتر النخبة التعليمي';
  const phone = settings?.phone ? `<div style="font-size: 11px; margin-top: 2px;">هاتف: ${settings.phone}</div>` : '';
  const allocationsHtml = receipt.allocations && receipt.allocations.length > 0
    ? `
      <div style="margin: 8px 0; border-top: 1px dashed #444; border-bottom: 1px dashed #444; padding: 4px 0;">
        <table style="width: 100%; font-size: 11px; text-align: right; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="padding: 2px 0; text-align: right;">المجموعة</th>
              <th style="padding: 2px 0; text-align: left;">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            ${receipt.allocations.map((a) => `
              <tr>
                <td style="padding: 2px 0;">${a.groupName}</td>
                <td style="padding: 2px 0; text-align: left; font-weight: bold;">${a.allocatedAmount} ${currencySymbol}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `
    : '';

  return `
    <div style="text-align: center; font-family: sans-serif; font-size: 12px; line-height: 1.4; color: #000; padding: 4px;">
      <h3 style="margin: 0 0 4px 0; font-size: 15px; font-weight: bold;">${centerName}</h3>
      <div style="font-size: 11px; color: #333;">إيصال تحصيل رسوم دراسية</div>
      ${phone}
      <div style="margin: 6px 0; border-top: 1px dashed #000;"></div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
        <span>رقم الإيصال: <strong>${receipt.receiptNumber}</strong></span>
        <span>التاريخ: ${receipt.paymentDate ? String(receipt.paymentDate).slice(0, 10) : ''}</span>
      </div>
      <div style="text-align: right; margin: 4px 0; font-size: 12px;">
        <div>الطالب: <strong>${receipt.studentName}</strong> (${receipt.studentCode})</div>
        <div>وسيلة الدفع: ${PAYMENT_METHOD_LABELS[receipt.paymentMethod] || receipt.paymentMethod}</div>
        ${receipt.receivedByName ? `<div>المحصّل: ${receipt.receivedByName}</div>` : ''}
      </div>
      ${allocationsHtml}
      <div style="margin: 8px 0; padding: 6px; background-color: #f0f0f0; border-radius: 4px; text-align: center; font-size: 14px; font-weight: bold;">
        المبلغ: ${receipt.amount} ${currencySymbol}
      </div>
      ${receipt.notes ? `<div style="font-size: 10px; text-align: right; color: #555;">ملاحظات: ${receipt.notes}</div>` : ''}
      <div style="margin-top: 8px; font-size: 10px; color: #666; text-align: center;">شكراً لكم • مع تمنياتنا بالتفوق</div>
    </div>
  `;
}

export function ReceiptPrintModal({ receipt, onClose }: ReceiptPrintModalProps) {
  const { settings } = useCenterSettings();
  const { isDesktop, config, printReceipt } = useDesktop();
  const [logoError, setLogoError] = React.useState(false);
  const [isPrinting, setIsPrinting] = React.useState(false);
  const currencySymbol = settings.currencySymbol || 'ج.م';

  React.useEffect(() => {
    setLogoError(false);
  }, [settings.logoUrl]);

  if (!receipt) return null;

  const handlePrint = async () => {
    if (isDesktop && config?.directPrintEnabled) {
      setIsPrinting(true);
      try {
        const html = buildThermalReceiptHtml(receipt, settings, currencySymbol);
        const res = await printReceipt({
          printerName: config.defaultThermalPrinter || '',
          htmlContent: html,
        });
        if (!res.success) {
          window.print();
        }
      } catch (e) {
        window.print();
      } finally {
        setIsPrinting(false);
      }
    } else {
      window.print();
    }
  };

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
              {settings.logoUrl && !logoError && (
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border bg-card">
                  <img
                    src={settings.logoUrl}
                    alt={settings.centerName}
                    className="h-full w-full object-contain"
                    onError={() => setLogoError(true)}
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
                        {formatCurrency(alloc.allocatedAmount, currencySymbol)}
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
              {formatCurrency(receipt.amount, currencySymbol)}
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
          <Button onClick={handlePrint} disabled={isPrinting}>
            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            طباعة الإيصال
          </Button>
        </div>
      </div>
    </Modal>
  );
}
