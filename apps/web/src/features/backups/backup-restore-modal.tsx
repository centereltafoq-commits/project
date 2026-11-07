import * as React from 'react';
import { useState } from 'react';
import { AlertTriangle, KeyRound, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/design-system/components/button';
import { Input } from '@/design-system/components/input';
import { Modal } from '@/design-system/components/modal';
import { useToast } from '@/design-system/components/toast';
import { BackupRecord } from './backups.types';
import { useBackupMutations } from './use-backups';

interface BackupRestoreModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: BackupRecord | null;
}

export function BackupRestoreModal({ open, onOpenChange, record }: BackupRestoreModalProps) {
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { notify } = useToast();
  const { restoreMutation } = useBackupMutations();

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record) return;
    if (!password) {
      setErrorMsg('يرجى إدخال كلمة مرور المشرف للتأكيد');
      return;
    }

    setErrorMsg(null);
    restoreMutation.mutate(
      { id: record.id, password },
      {
        onSuccess: (res) => {
          notify(res.message || 'تمت استعادة قاعدة البيانات بنجاح', 'success');
          setPassword('');
          onOpenChange(false);
        },
        onError: (err: any) => {
          setErrorMsg(
            err.response?.data?.message ||
              'فشلت عملية الاستعادة. تأكد من صحة كلمة المرور.',
          );
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setPassword('');
          setErrorMsg(null);
        }
        onOpenChange(v);
      }}
      title="تأكيد استعادة النسخة الاحتياطية"
      description="يرجى قراءة التنبيه الأمني بعناية قبل المتابعة"
      size="md"
    >
      <form onSubmit={handleRestore} className="space-y-4">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-600 dark:text-amber-400">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            <div className="space-y-1">
              <span className="font-bold text-sm block">تحذير أمني هام:</span>
              <p>
                استعادة النسخة الاحتياطية ستؤدي إلى استبدال قاعدة البيانات الحالية
                ببيانات النسخة المحددة ({record?.fileName}).
              </p>
              <p className="font-semibold">
                لن تتأثر أي نسخ احتياطية سابقة محفوظة على جهازك أو على السحابة.
              </p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive">
            {errorMsg}
          </div>
        )}

        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>الملف المختار:</span>
            <span className="font-mono font-bold text-foreground">{record?.fileName}</span>
          </div>
          <div className="flex justify-between">
            <span>تاريخ النسخة:</span>
            <span className="text-foreground">{record?.createdAt?.slice(0, 19).replace('T', ' ')}</span>
          </div>
          <div className="flex justify-between">
            <span>الحجم:</span>
            <span className="font-mono text-foreground">
              {record?.fileSizeBytes ? `${(record.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB` : '-'}
            </span>
          </div>
        </div>

        <Input
          label="كلمة مرور المشرف (للتأكيد الأمني) *"
          type="password"
          placeholder="أدخل كلمة المرور لتأكيد الاستعادة..."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            إلغاء
          </Button>
          <Button
            type="submit"
            variant="danger"
            size="sm"
            disabled={restoreMutation.isPending}
            className="gap-1.5"
          >
            {restoreMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span>تأكيد واستعادة البيانات الآن</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
