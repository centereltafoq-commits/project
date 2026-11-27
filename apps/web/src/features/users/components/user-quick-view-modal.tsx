import {
  Calendar,
  Clock,
  Pencil,
  Phone,
  Power,
  ShieldCheck,
} from 'lucide-react';
import { Badge, Button, Modal } from '@/design-system';
import { formatDateAr, formatDateTimeAr } from '@/lib/formatters';

export interface UserRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  roleId: string;
  roleCode: string;
  roleNameAr: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface UserQuickViewModalProps {
  user: UserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (user: UserRow) => void;
  onToggleActive?: (user: UserRow) => void;
  isToggling?: boolean;
}

export function UserQuickViewModal({
  user,
  open,
  onOpenChange,
  onEdit,
  onToggleActive,
  isToggling,
}: UserQuickViewModalProps) {
  if (!user) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="بطاقة تفاصيل المستخدم"
      description="نظرة شاملة على بيانات الحساب، الدور الوظيفي، وتاريخ النشاط"
      size="md"
    >
      <div className="space-y-4">
        {/* الترويسة */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="purple">{user.roleNameAr}</Badge>
              <Badge variant={user.isActive ? 'success' : 'danger'}>
                {user.isActive ? 'حساب نشط' : 'حساب معطل'}
              </Badge>
            </div>
            <h3 className="text-xl font-black text-foreground">{user.fullName}</h3>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              تاريخ إنشاء الحساب: {formatDateAr(user.createdAt)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onEdit && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => onEdit(user)}
              >
                <Pencil className="h-3.5 w-3.5" />
                تعديل
              </Button>
            )}
            {onToggleActive && (
              <Button
                size="sm"
                variant={user.isActive ? 'danger' : 'success'}
                className="gap-1.5 text-xs"
                isLoading={isToggling}
                onClick={() => onToggleActive(user)}
              >
                <Power className="h-3.5 w-3.5" />
                {user.isActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}
              </Button>
            )}
          </div>
        </div>

        {/* بيانات الدخول والاتصال */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-emerald-600" />
              رقم الهاتف (الدخول)
            </span>
            <p dir="ltr" className="mt-1 text-sm font-mono font-bold text-foreground text-right">
              {user.phone || 'غير مسجل'}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
              كود الدور الوظيفي
            </span>
            <p className="mt-1 font-mono text-sm font-bold text-foreground">
              {user.roleCode}
            </p>
          </div>
        </div>

        {/* آخر تسجيل دخول */}
        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              آخر تسجيل دخول
            </span>
            <p className="mt-1 text-xs font-mono font-semibold text-foreground">
              {user.lastLoginAt ? formatDateTimeAr(user.lastLoginAt) : 'لم يسجل دخول بعد'}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
