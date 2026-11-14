import { Lock } from 'lucide-react';
import { Button, Modal } from '@/design-system';
import { formatYearMonthAr } from '@/lib/formatters';

interface CloseMonthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  yearMonth: string;
  isLoading: boolean;
  onConfirm: () => void;
}

export function CloseMonthModal({
  open,
  onOpenChange,
  yearMonth,
  isLoading,
  onConfirm,
}: CloseMonthModalProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`تأكيد إغلاق شهر ${formatYearMonthAr(yearMonth)} مالياً`}
      description="عملية محاسبية نهائية لحماية السجلات التاريخية من أي تغييرات مستقبلية"
    >
      <div className="space-y-4 text-sm">
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-foreground leading-relaxed">
          سيقوم النظام أولاً بإعادة احتساب جميع السجلات المفتوحة للشهر، ثم قفل وتجميد{' '}
          <strong>أسعار الحصص التاريخية وإجمالي مستحقات الطلاب والمدرسين والمساعدين والمصروفات</strong>{' '}
          نهائياً بحيث لا تتأثر بتعديل أسعار المجموعات أو السياسات في الشهور القادمة — مع استمرار
          إمكانية <strong>تحصيل المتأخرات المتبقية</strong> على الطلاب وصرف الأرصدة المتبقية للمدرسين والمساعدين لاحقاً.
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            تراجع
          </Button>
          <Button variant="danger" isLoading={isLoading} onClick={onConfirm}>
            <Lock className="h-4 w-4" />
            تأكيد الإغلاق والتجميد النهائي
          </Button>
        </div>
      </div>
    </Modal>
  );
}
