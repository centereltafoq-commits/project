import * as React from 'react';
import { Clock, Eye, Globe, Key, Shield, Undo2, User, Code2, ListFilter } from 'lucide-react';
import { Badge, Button, Modal } from '@/design-system';
import { formatDateTimeAr } from '@/lib/formatters';
import {
  translateAuditAction,
  translateAuditEntity,
  translatePayloadKey,
  translatePayloadValue,
} from '@/lib/translations';

export interface AuditLogRow {
  id: string;
  actorUserId?: string | null;
  actorName: string | null;
  action: string;
  actionAr?: string;
  entityType: string;
  entityTypeAr?: string;
  entityId: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: unknown;
  ipAddress: string | null;
  createdAt: string;
  isReversible?: boolean;
  isReverted?: boolean;
  revertedAt?: string | null;
  revertedByName?: string | null;
  rollbackAuditLogId?: string | null;
}

interface AuditLogQuickViewModalProps {
  log: AuditLogRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestRollback?: (log: AuditLogRow) => void;
}

function RenderItemValue({ val, keyName }: { val: unknown; keyName?: string }) {
  if (val === null || val === undefined) return <span className="text-muted-foreground">—</span>;

  if (Array.isArray(val)) {
    if (val.length === 0) return <span className="text-muted-foreground">فارغ</span>;
    const isPrimitiveArray = val.every((item) => typeof item !== 'object' || item === null);
    if (isPrimitiveArray) {
      return (
        <div className="flex flex-wrap gap-1">
          {val.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground"
            >
              {translatePayloadValue(item, keyName)}
            </span>
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-1.5 w-full">
        {val.map((item, idx) => (
          <div key={idx} className="rounded-md border border-border/70 bg-muted/40 p-2 text-xs">
            <span className="text-[10px] font-bold text-muted-foreground block mb-1">
              عنصر #{idx + 1}
            </span>
            <RenderItemValue val={item} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof val === 'object') {
    const entries = Object.entries(val as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-muted-foreground">فارغ</span>;
    return (
      <div className="divide-y divide-border/40 rounded-md border border-border/70 bg-card p-1 text-xs w-full">
        {entries.map(([subKey, subVal]) => (
          <div key={subKey} className="flex items-start justify-between gap-2 p-1.5">
            <span className="font-semibold text-muted-foreground whitespace-nowrap text-[11px]">
              {translatePayloadKey(subKey)}:
            </span>
            <span className="font-medium text-foreground text-left break-all" dir="auto">
              <RenderItemValue val={subVal} keyName={subKey} />
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <span className="font-medium text-foreground text-left break-all" dir="auto">
      {translatePayloadValue(val, keyName)}
    </span>
  );
}

function PayloadBlock({
  title,
  colorClass,
  data,
}: {
  title: string;
  colorClass: string;
  data: unknown;
}) {
  const [showRaw, setShowRaw] = React.useState(false);
  const isComplex = data !== null && typeof data === 'object';

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold ${colorClass}`}>{title}</span>
        {isComplex && (
          <button
            type="button"
            onClick={() => setShowRaw(!showRaw)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium underline transition-colors cursor-pointer"
          >
            {showRaw ? (
              <>
                <ListFilter className="h-3 w-3" />
                عرض مبسط
              </>
            ) : (
              <>
                <Code2 className="h-3 w-3" />
                عرض كود JSON
              </>
            )}
          </button>
        )}
      </div>

      {showRaw || !isComplex ? (
        <pre
          className="max-h-52 overflow-auto text-[11px] font-mono bg-card p-2 rounded-lg border border-border text-foreground text-left"
          dir="ltr"
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : Array.isArray(data) ? (
        <div className="max-h-52 overflow-auto space-y-2 rounded-lg border border-border bg-card p-2">
          {data.length === 0 ? (
            <p className="text-xs text-muted-foreground">لا توجد عناصر</p>
          ) : (
            data.map((item, idx) => (
              <div key={idx} className="rounded border border-border/70 p-2 text-xs bg-muted/30">
                <span className="text-[10px] font-bold text-muted-foreground block mb-1">
                  عنصر #{idx + 1}
                </span>
                <RenderItemValue val={item} />
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="max-h-52 overflow-auto divide-y divide-border/60 rounded-lg border border-border bg-card">
          {Object.entries(data as Record<string, unknown>).map(([key, val]) => (
            <div key={key} className="flex items-start justify-between gap-3 p-2 text-xs">
              <span className="font-semibold text-muted-foreground whitespace-nowrap">
                {translatePayloadKey(key)}:
              </span>
              <span className="font-medium text-foreground text-left break-all" dir="auto">
                <RenderItemValue val={val} keyName={key} />
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AuditLogQuickViewModal({
  log,
  open,
  onOpenChange,
  onRequestRollback,
}: AuditLogQuickViewModalProps) {
  if (!log) return null;

  const actionMeta = translateAuditAction(log.action);
  const actionLabel = log.actionAr || actionMeta.label;
  const entityLabel = log.entityTypeAr || translateAuditEntity(log.entityType);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="تفاصيل العملية المسجلة (Audit Log)"
      description="سجل تدقيق أمني غير قابل للتعديل يوثق بيانات العملية المنفذة"
      size="lg"
    >
      <div className="space-y-4">
        {log.isReverted && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs font-bold text-amber-800 dark:text-amber-300">
            <span>
              تم التراجع عن هذه العملية بواسطة ({log.revertedByName || 'الإدارة'})
              {log.revertedAt ? ` بتاريخ ${formatDateTimeAr(log.revertedAt)}` : ''}
            </span>
            <Badge variant="warning">تم التراجع</Badge>
          </div>
        )}
        {/* الترويسة */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant={actionMeta.variant}>{actionLabel}</Badge>
              <Badge variant="neutral">{entityLabel}</Badge>
            </div>
            <h3 className="text-base font-bold text-foreground">
              بواسطة: <span className="font-extrabold text-primary">{log.actorName || 'النظام'}</span>
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
              العملية المنفذة
            </span>
            <p className="mt-1 text-xs font-bold text-foreground break-all">
              {actionLabel}
            </p>
            <span className="text-[10px] font-mono text-muted-foreground">
              {log.action}
            </span>
          </div>

          <div className="rounded-xl border border-border bg-card p-3">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-purple-600" />
              معرّف السجل ({entityLabel})
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
            <h4 className="text-xs font-bold text-muted-foreground">تفاصيل بيانات العملية (Payload):</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {log.beforeData != null && (
                <PayloadBlock
                  title="البيانات السابقة (Before)"
                  colorClass="text-rose-600"
                  data={log.beforeData}
                />
              )}
              {log.afterData != null && (
                <PayloadBlock
                  title="البيانات بعد التعديل (After)"
                  colorClass="text-emerald-600"
                  data={log.afterData}
                />
              )}
            </div>
            {log.metadata != null && (
              <PayloadBlock
                title="بيانات ومعلومات إضافية (Metadata)"
                colorClass="text-primary"
                data={log.metadata}
              />
            )}
          </div>
        )}

        {log.isReversible && !log.isReverted && onRequestRollback && (
          <div className="flex justify-end border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onRequestRollback(log)}
              className="gap-1.5 font-bold text-amber-700 border-amber-500/40 hover:bg-amber-500/10 dark:text-amber-300"
            >
              <Undo2 className="h-3.5 w-3.5" />
              رجوع عن هذه العملية
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
