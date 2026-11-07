import { Clock, Eye, Globe, Key, Shield, User } from 'lucide-react';
import { Badge, Button, Modal } from '@/design-system';
import { formatDateTimeAr } from '@/lib/formatters';
import { translateAuditAction, translateAuditEntity } from '@/lib/translations';

export interface AuditLogRow {
  id: string;
  actorUserId?: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: unknown;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditLogQuickViewModalProps {
  log: AuditLogRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditLogQuickViewModal({
  log,
  open,
  onOpenChange,
}: AuditLogQuickViewModalProps) {
  if (!log) return null;

  const actionMeta = translateAuditAction(log.action);
  const entityLabel = translateAuditEntity(log.entityType);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="تفاصيل العملية المسجلة (Audit Log)"
      description="سجل تدقيق أمني غير قابل للتعديل يوثق بيانات العملية المنفذة"
      size="lg"
    >
      <div className="space-y-4">
        {/* الترويسة */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant={actionMeta.variant}>{actionMeta.label}</Badge>
              <Badge variant="neutral">{entityLabel}</Badge>
            </div>
            <h3 className="text-base font-bold text-foreground">
              بواسطة: <span className="font-extrabold text-primary">{log.actorName || 'النظام التلقائي'}</span>
            </h3>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <Clock className="h-3.5 w-3.5 text-primary" />
              {formatDateTimeAr(log.createdAt)}
            </p>
          </div>
        </div>

        {/* بطاقات البيانات الوصفية */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-primary" />
              كود العملية
            </span>
            <p className="mt-1 font-mono text-xs font-bold text-foreground break-all">
              {log.action}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-purple-600" />
              معرّف السجل (Entity ID)
            </span>
            <p className="mt-1 font-mono text-xs font-semibold text-foreground break-all">
              {log.entityId || '—'}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-emerald-600" />
              عنوان IP
            </span>
            <p className="mt-1 font-mono text-xs font-semibold text-foreground">
              {log.ipAddress || 'غير متوفر'}
            </p>
          </div>
        </div>

        {/* التغييرات والبيانات المرفقة */}
        {(log.beforeData != null || log.afterData != null || log.metadata != null) && (
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-muted-foreground">بيانات العملية المسجلة (Payload):</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {log.beforeData != null && (
                <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-1">
                  <span className="text-[11px] font-bold text-rose-600">البيانات السابقة (Before):</span>
                  <pre className="max-h-48 overflow-auto text-[11px] font-mono bg-card p-2 rounded-lg border border-border text-foreground text-left" dir="ltr">
                    {JSON.stringify(log.beforeData, null, 2)}
                  </pre>
                </div>
              )}
              {log.afterData != null && (
                <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-1">
                  <span className="text-[11px] font-bold text-emerald-600">البيانات بعد التعديل (After):</span>
                  <pre className="max-h-48 overflow-auto text-[11px] font-mono bg-card p-2 rounded-lg border border-border text-foreground text-left" dir="ltr">
                    {JSON.stringify(log.afterData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            {log.metadata != null && (
              <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-1">
                <span className="text-[11px] font-bold text-primary">بيانات إضافية (Metadata):</span>
                <pre className="max-h-40 overflow-auto text-[11px] font-mono bg-card p-2 rounded-lg border border-border text-foreground text-left" dir="ltr">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
