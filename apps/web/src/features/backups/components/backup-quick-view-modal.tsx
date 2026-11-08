import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cloud,
  Database,
  Download,
  HardDrive,
  RotateCcw,
  ShieldCheck,
  Usb,
  XCircle,
} from 'lucide-react';
import { Badge, Button, Modal, useToast } from '@/design-system';
import { formatDateTimeAr } from '@/lib/formatters';
import { backupsApi } from '../backups-api';
import { BackupRecord } from '../backups.types';

interface BackupQuickViewModalProps {
  record: BackupRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (record: BackupRecord) => void;
}

export function BackupQuickViewModal({
  record,
  open,
  onOpenChange,
  onRestore,
}: BackupQuickViewModalProps) {
  const { notify } = useToast();
  if (!record) return null;

  const isSuccess = record.status === 'SUCCESS';
  const isFailed = record.status === 'FAILED';

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="تفاصيل ملف النسخة الاحتياطية"
      description="نظرة فنية شاملة على محتوى النسخة، الحجم، وحالة المزامنة عبر الوجهات"
      size="md"
    >
      <div className="space-y-4">
        {/* الترويسة */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge
                variant={isSuccess ? 'success' : isFailed ? 'danger' : 'warning'}
              >
                {isSuccess ? 'ناجحة' : isFailed ? 'فشلت' : 'قيد الإنشاء'}
              </Badge>
              <Badge
                variant={
                  record.triggerType === 'SCHEDULED'
                    ? 'info'
                    : record.triggerType === 'UPLOADED'
                    ? 'purple'
                    : 'neutral'
                }
              >
                {record.triggerType === 'SCHEDULED'
                  ? 'تلقائي مجدول'
                  : record.triggerType === 'UPLOADED'
                  ? 'مرفوع من الكمبيوتر'
                  : 'يدوي فوري'}
              </Badge>
            </div>
            <h3 className="font-mono text-sm font-bold text-foreground break-all" dir="ltr">
              {record.fileName}
            </h3>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <Clock className="h-3.5 w-3.5 text-primary" />
              {formatDateTimeAr(record.createdAt)}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isSuccess && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await backupsApi.download(record.id, record.fileName);
                      notify(`تم تحميل النسخة (${record.fileName}) بنجاح`, 'success');
                    } catch (err: any) {
                      notify(err.response?.data?.message || err.message || 'فشل تحميل ملف النسخة الاحتياطية', 'error');
                    }
                  }}
                  className="h-8 gap-1 px-2.5 text-xs font-semibold"
                >
                  <Download className="h-3.5 w-3.5 text-primary" />
                  تحميل
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onOpenChange(false);
                    onRestore(record);
                  }}
                  className="h-8 gap-1 text-xs text-amber-600 hover:text-amber-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  استعادة
                </Button>
              </>
            )}
          </div>
        </div>

        {/* الحجم والوجهات */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-primary" />
              حجم الملف
            </span>
            <p className="mt-1 font-mono text-base font-bold text-foreground" dir="ltr">
              {record.fileSizeBytes
                ? `${(record.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB (${record.fileSizeBytes.toLocaleString('en-US')} بايت)`
                : '—'}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              التخزين السحابي / المحلي
            </span>
            <div className="mt-1 flex flex-wrap gap-1">
              {record.destinations?.length ? (
                record.destinations.map((d) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-foreground"
                  >
                    {d === 'LOCAL' && <Usb className="h-3 w-3 text-emerald-500" />}
                    {d === 'GOOGLE_DRIVE' && <Cloud className="h-3 w-3 text-blue-500" />}
                    {d === 'SERVER_STORAGE' && <HardDrive className="h-3 w-3 text-primary" />}
                    <span>{d === 'LOCAL' ? 'محلي / USB' : d === 'GOOGLE_DRIVE' ? 'Google Drive' : 'السيرفر'}</span>
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
          </div>
        </div>

        {/* رسالة الخطأ إن وجدت */}
        {record.errorMessage && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-700 dark:text-rose-400 space-y-1">
            <span className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              رسالة الخطأ المسجلة:
            </span>
            <p className="font-mono">{record.errorMessage}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
