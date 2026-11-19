import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Database, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Button, Input, Modal, useToast } from '@/design-system';
import { extractErrorMessage } from '@/lib/api-client';
import { settingsApi } from '../settings-api';
import { useCenterSettings } from '../center-settings-context';

interface NewAcademicYearModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function NewAcademicYearModal({
  open,
  onOpenChange,
  onSuccess,
}: NewAcademicYearModalProps) {
  const { notify } = useToast();
  const { settings, refetch } = useCenterSettings();
  const queryClient = useQueryClient();

  const [pin, setPin] = React.useState('');
  const [purgeStudents, setPurgeStudents] = React.useState(false);
  const [newAcademicYear, setNewAcademicYear] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [progressStage, setProgressStage] = React.useState<'idle' | 'backup' | 'purging'>(
    'idle',
  );

  const purgeTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (purgeTimerRef.current) clearTimeout(purgeTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (open) {
      setPin('');
      setPurgeStudents(false);
      setNotes('');
      setProgressStage('idle');
      // Compute next suggested year if possible
      if (settings?.academicYear) {
        const parts = settings.academicYear.split(/[\/\-]/).map((s) => s.trim());
        if (parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
          setNewAcademicYear(`${Number(parts[0]) + 1} / ${Number(parts[1]) + 1}`);
        } else {
          setNewAcademicYear('');
        }
      }
    }
  }, [open, settings?.academicYear]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 6) {
      notify('يجب إدخال رمز أمان PIN مكون من 6 أرقام', 'error');
      return;
    }

    const trimmedYear = newAcademicYear.trim();
    if (trimmedYear) {
      const yearMatch = /^(\d{4})\s*[\/\-]\s*(\d{4})$/.exec(trimmedYear);
      if (
        !yearMatch ||
        Number(yearMatch[1]) < 2000 ||
        Number(yearMatch[1]) > 2099 ||
        Number(yearMatch[2]) !== Number(yearMatch[1]) + 1
      ) {
        notify('صيغة العام الدراسي الجديد غير صالحة، يجب أن تكون عامين متتاليين مثل: 2027 / 2028', 'error');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setProgressStage('backup');

      // Update message briefly for user transparency
      purgeTimerRef.current = setTimeout(() => {
        setProgressStage('purging');
      }, 1500);

      const result = await settingsApi.resetAcademicYear({
        pin,
        purgeStudents,
        newAcademicYear: newAcademicYear.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (purgeTimerRef.current) {
        clearTimeout(purgeTimerRef.current);
        purgeTimerRef.current = null;
      }

      notify(result.message, 'success');

      await queryClient.invalidateQueries({ refetchType: 'none' });
      await refetch();
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      if (purgeTimerRef.current) {
        clearTimeout(purgeTimerRef.current);
        purgeTimerRef.current = null;
      }
      setIsSubmitting(false);
      setProgressStage('idle');
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!isSubmitting) onOpenChange(v);
      }}
      title="تأكيد بدء سنة دراسية جديدة والتصفير الأرشيفي"
      description="أرشفة وتصفير العام المنتهي وتجهيز النظام لاستقبال العام الجديد"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Warning Banner */}
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-destructive" />
            <div className="space-y-1.5 text-xs leading-relaxed text-foreground">
              <p className="font-bold text-destructive">
                تحذير أمني شديد: هذه الخطوة لا يمكن التراجع عنها!
              </p>
              <ul className="list-disc space-y-1 pr-4">
                <li>
                  سيتم <strong>تلقائياً وبشكل إلزامي</strong> أخذ نسخة احتياطية مضغوطة كاملة (
                  <code>.sql.gz</code>) مؤرخة لكافة بيانات وحركات العام المنتهي قبل أي تعديل.
                </li>
                <li>
                  سيتم تصفير كافة الحصص، سجلات الحضور والغياب، المدفوعات والإيصالات، المصروفات،
                  وصرفيات المدرسين والمساعدين، والاشتراكات.
                </li>
                <li>
                  <strong>يتم الحفاظ دائماً على:</strong> حسابات المالك والموظفين، الصلاحيات،
                  القاعات الدراسية، والمراحل والصفوف الدراسية.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <h4 className="text-sm font-bold text-foreground">خيارات التصفير والانتقال:</h4>

          <div className="space-y-2">
            <Input
              label="العام الدراسي الجديد"
              placeholder="مثال: 2027 / 2028"
              value={newAcademicYear}
              onChange={(e) => setNewAcademicYear(e.target.value)}
              disabled={isSubmitting}
              hint="سيتم اعتماده كعام دراسي نشط في ترويسة التقارير والإيصالات"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={purgeStudents}
              onChange={(e) => setPurgeStudents(e.target.checked)}
              disabled={isSubmitting}
              className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary"
            />
            <div className="space-y-0.5">
              <span className="text-sm font-semibold text-foreground">
                حذف ملفات الطلاب والمجموعات بالكامل أيضاً
              </span>
              <p className="text-xs text-muted-foreground">
                غير مفعل افتراضياً للاحتفاظ بأسماء وأرقام هواتف الطلاب والمجموعات لإعادة تسجيلهم بسهولة
                في العام الجديد. تفعيل هذا الخيار سيحذف سجلات الطلاب والمجموعات كلياً.
              </p>
            </div>
          </label>

          <Input
            label="ملاحظات الأرشفة (اختياري)"
            placeholder="مثال: أرشفة نهاية الفصل الدراسي لعام 2026/2027"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        {/* PIN Security Check */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            <span>تأكيد رمز الأمان السري (PIN)</span>
          </div>
          <p className="text-xs text-muted-foreground">
            أدخل كود الحماية السري المكون من 6 أرقام المصرح به لإدارة السنتر لإتمام العملية.
          </p>
          <Input
            type="password"
            maxLength={6}
            placeholder="أدخل 6 أرقام"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            disabled={isSubmitting}
            className="text-center font-mono text-lg tracking-widest"
            autoComplete="off"
          />
        </div>

        {/* Progress Display */}
        {isSubmitting && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Database className="h-4 w-4 animate-spin" />
              <span>
                {progressStage === 'backup'
                  ? 'المرحلة 1: جاري إنشاء النسخة الاحتياطية الشاملة والتحقق من سلامتها...'
                  : 'المرحلة 2: جاري تصفير الحسابات والبيانات التشغيلية وبدء العام الجديد...'}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
              <div
                className={`h-full bg-primary transition-all duration-700 ${
                  progressStage === 'backup' ? 'w-1/2' : 'w-5/6'
                }`}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            إلغاء
          </Button>
          <Button
            type="submit"
            variant="danger"
            isLoading={isSubmitting}
            disabled={pin.length !== 6 || isSubmitting}
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>تأكيد وأرشفة وتصفير</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
