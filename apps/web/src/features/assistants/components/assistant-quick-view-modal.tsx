import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Calculator,
  Coins,
  Edit3,
  ExternalLink,
  MessageCircle,
  Phone,
  Users,
} from 'lucide-react';
import { AssistantCalculationMethod, PERMISSIONS } from '@edu-center/shared';
import { Badge, Button, Modal } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { formatCurrency } from '@/lib/formatters';
import {
  ASSISTANT_CALC_METHOD_LABELS,
  AssistantRow,
} from '../assistants.types';

interface AssistantQuickViewModalProps {
  assistant: AssistantRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (assistant: AssistantRow) => void;
}

export function AssistantQuickViewModal({
  assistant,
  open,
  onOpenChange,
  onEdit,
}: AssistantQuickViewModalProps) {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManageAssistants = hasPermission(PERMISSIONS.ASSISTANTS_MANAGE);
  const canSeeRate =
    hasPermission(PERMISSIONS.FINANCE_VIEW) || canManageAssistants;

  if (!assistant) return null;

  const isPercent =
    assistant.calculationMethod ===
    AssistantCalculationMethod.SESSION_COMMISSION_PERCENT;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="بطاقة تفاصيل المساعد والمستحقات"
      description="نظرة فورية شاملة على بيانات التواصل وطريقة الاحتساب والمجموعات"
      size="md"
    >
      <div className="space-y-4">
        {/* ترويسة بطاقة المساعد */}
        <div className="flex items-start justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
                {assistant.assistantCode}
              </span>
              <Badge variant={assistant.status === 'ACTIVE' ? 'success' : 'danger'}>
                {assistant.status === 'ACTIVE' ? 'نشط' : 'متوقف'}
              </Badge>
            </div>
            <h3 className="text-lg font-black text-foreground">{assistant.fullName}</h3>
            <p className="text-xs font-medium text-muted-foreground">
              المشرف المساعد لشؤون الطلاب والحصص
            </p>
          </div>
        </div>

        {/* الهاتف وطريقة احتساب المستحقات */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* الهاتف */}
          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground block flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-primary" />
              رقم الهاتف
            </span>
            <p dir="ltr" className="mt-1 text-sm font-mono font-bold text-foreground text-right">
              {assistant.phone || 'غير مسجل'}
            </p>
            {assistant.phone && (
              <a
                href={`https://wa.me/2${assistant.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:underline"
              >
                <MessageCircle className="h-3 w-3" />
                مراسلة عبر واتساب
              </a>
            )}
          </div>

          {/* طريقة الاحتساب المطبقة */}
          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground block flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5 text-blue-600" />
              نظام المستحقات
            </span>
            <div className="mt-1.5">
              <Badge variant="info">
                {ASSISTANT_CALC_METHOD_LABELS[assistant.calculationMethod] ??
                  assistant.calculationMethod}
              </Badge>
            </div>
          </div>
        </div>

        {/* القيمة والمجموعات المرتبطة */}
        <div className={`grid grid-cols-1 gap-3 ${canSeeRate ? 'sm:grid-cols-2' : ''}`}>
          {canSeeRate && (
            <div className="rounded-xl border border-border bg-card p-3.5">
              <span className="text-xs font-bold text-muted-foreground block flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-emerald-600" />
                القيمة / النسبة المالية
              </span>
              <p className="mt-1 text-base font-black text-emerald-600 dark:text-emerald-400">
                {isPercent
                  ? `${Number(assistant.rateValue)}%`
                  : formatCurrency(assistant.rateValue)}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground block flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-purple-600" />
              المجموعات المرتبطة بالمساعد
            </span>
            <p className="mt-1 text-sm font-extrabold text-foreground">
              {assistant.linkedGroupsCount ?? 0} مجموعة مسندة
            </p>
          </div>
        </div>

        {/* ملاحظات الاحتساب المخصصة إن وجدت */}
        {canSeeRate && assistant.customFormulaNote && (
          <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs">
            <span className="font-bold text-muted-foreground block mb-1">
              صيغة / ملاحظات الحساب المخصصة:
            </span>
            <p className="text-foreground">{assistant.customFormulaNote}</p>
          </div>
        )}

        {/* أزرار الإجراءات في أسفل النافذة */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
          {canManageAssistants ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onEdit(assistant);
              }}
              className="gap-1.5"
            >
              <Edit3 className="h-3.5 w-3.5" />
              تعديل البيانات
            </Button>
          ) : (
            <span />
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              navigate(`/assistants/${assistant.id}`);
            }}
            className="gap-1.5 font-bold"
          >
            الملف الشامل وحسابات الصرف
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Modal>
  );
}

