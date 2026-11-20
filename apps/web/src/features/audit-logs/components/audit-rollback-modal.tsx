import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  ShieldAlert,
  Undo2,
} from 'lucide-react';
import { Badge, Button, Input, Modal, useToast } from '@/design-system';
import { extractErrorMessage } from '@/lib/api-client';
import { formatDateTimeAr } from '@/lib/formatters';
import { translateAuditAction, translateAuditEntity } from '@/lib/translations';
import { auditLogsApi, AuditRollbackPreview } from '../audit-logs.api';
import { AuditLogRow } from './audit-log-quick-view-modal';

interface AuditRollbackModalProps {
  log: AuditLogRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditRollbackModal({
  log,
  open,
  onOpenChange,
}: AuditRollbackModalProps) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [reason, setReason] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setReason('');
    }
  }, [open, log?.id]);

  const {
    data: preview,
    isLoading,
    isError,
    error,
  } = useQuery<AuditRollbackPreview>({
    queryKey: ['audit-rollback-preview', log?.id],
    enabled: open && Boolean(log?.id),
    retry: false,
    queryFn: () => auditLogsApi.getRollbackPreview(log!.id),
  });

  const executeMutation = useMutation({
    mutationFn: () => auditLogsApi.executeRollback(log!.id, reason),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
      queryClient.invalidateQueries({ queryKey: ['audit-rollback-preview'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['group-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      queryClient.invalidateQueries({ queryKey: ['assistants'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      notify(res.message || 'تم الرجوع عن العملية بنجاح وتسجيل التعديل في السجل', 'success');
      onOpenChange(false);
    },
    onError: (err) => {
      notify(extractErrorMessage(err), 'error');
    },
  });

  if (!log) return null;

  const actionMeta = translateAuditAction(log.action);
  const actionLabel = log.actionAr || actionMeta.label;
  const entityLabel = log.entityTypeAr || translateAuditEntity(log.entityType);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="تأكيد الرجوع عن العملية (Rollback)"
      description="فحص الأثر الكامل على الأرصدة والتقارير والاشتراكات قبل تأكيد التراجع وتسجيل العملية"
    >
      <div className="space-y-4">
        {/* ملخص العملية المطلوب التراجع عنها */}
        <div className="rounded-xl border border-border bg-muted/25 p-3.5 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={actionMeta.variant}>{actionLabel}</Badge>
            <Badge variant="neutral">{entityLabel}</Badge>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              المنفّذ الأصلي: <strong className="text-foreground">{log.actorName || 'النظام'}</strong>
            </span>
            <span className="font-mono">{formatDateTimeAr(log.createdAt)}</span>
          </div>
        </div>

        {/* تحليل الأثر */}
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-border py-10 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>جاري فحص تأثير التراجع على الحسابات والجداول المرتبطة...</span>
          </div>
        ) : isError ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs font-semibold text-destructive">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{extractErrorMessage(error)}</span>
          </div>
        ) : preview && !preview.canRollback ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-black">لا يمكن تنفيذ التراجع عن هذه العملية</p>
              <p className="font-semibold">
                {preview.blockedReason || 'العملية محمية أو تم التراجع عنها مسبقاً'}
              </p>
            </div>
          </div>
        ) : preview ? (
          <div className="space-y-3.5">
            {preview.warnings.length > 0 && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-black block">تحذيرات هامة قبل التأكيد:</span>
                  <ul className="list-disc pr-4 space-y-0.5 font-semibold">
                    {preview.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-black text-foreground">
                  التأثيرات التي ستتم في النظام عند التأكيد:
                </h4>
                {preview.affectedMonths.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[11px] text-muted-foreground">الشهور المتأثرة:</span>
                    {preview.affectedMonths.map((ym) => (
                      <Badge key={ym} variant="info" className="font-mono text-[10px]">
                        {ym}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {preview.affectedChanges.map((item, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl border p-3 text-xs space-y-1 ${
                      item.severity === 'warning'
                        ? 'border-amber-500/35 bg-amber-500/[0.06]'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {item.severity === 'warning' ? (
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <Info className="h-3.5 w-3.5 shrink-0 text-primary" />
                      )}
                      <Badge variant={item.severity === 'warning' ? 'warning' : 'info'} className="text-[10px]">
                        {item.area}
                      </Badge>
                      <span className="font-bold text-foreground">{item.summary}</span>
                    </div>
                    <p className="pr-5 text-[11px] text-muted-foreground leading-relaxed">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                سيتم تسجيل سجل جديد في «سجل العمليات» يوثّق هذا التراجع وبياناته قبل وبعد التعديل.
              </span>
            </div>

            <Input
              label="سبب التراجع عن العملية (اختياري — يُوثّق في السجل)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="مثال: تم التحصيل لطالب آخر بالخطأ أو صرف مكرر"
              maxLength={300}
            />
          </div>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={!preview?.canRollback || isLoading || isError || executeMutation.isPending}
            isLoading={executeMutation.isPending}
            onClick={() => executeMutation.mutate()}
            className="gap-1.5 font-bold"
          >
            <Undo2 className="h-4 w-4" />
            <span>تأكيد الرجوع عن العملية</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
