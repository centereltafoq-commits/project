import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Coins,
  Edit3,
  ExternalLink,
  GraduationCap,
  MapPin,
  Percent,
  ShieldAlert,
  UserCheck,
  Users,
} from 'lucide-react';
import { GroupRevenueSplitMethod, PERMISSIONS } from '@edu-center/shared';
import { Badge, Button, Modal } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { ARABIC_DAYS, formatCurrency, formatTimeRangeAr } from '@/lib/formatters';
import {
  FULL_ABSENCE_POLICY_LABELS,
  GroupRow,
  REVENUE_SPLIT_OPTIONS,
} from '../groups.types';

interface GroupQuickViewModalProps {
  group: GroupRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (group: GroupRow) => void;
}

export function GroupQuickViewModal({
  group,
  open,
  onOpenChange,
  onEdit,
}: GroupQuickViewModalProps) {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManageGroups = hasPermission(PERMISSIONS.GROUPS_MANAGE);
  const canSeeSplit = hasPermission(PERMISSIONS.FINANCE_VIEW) || canManageGroups;

  if (!group) return null;

  const splitLabel =
    REVENUE_SPLIT_OPTIONS.find((o) => o.value === group.revenueSplitMethod)?.label ??
    (group.revenueSplitMethod ? String(group.revenueSplitMethod) : 'غير محدد');

  const absencePolicyLabel = group.fullMonthAbsencePolicy
    ? FULL_ABSENCE_POLICY_LABELS[group.fullMonthAbsencePolicy] ?? group.fullMonthAbsencePolicy
    : 'غير محدد';

  const capacityRatio = group.maxStudents > 0 
    ? Math.min(100, Math.round((group.activeStudentsCount / group.maxStudents) * 100))
    : 0;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="بطاقة تفاصيل المجموعة الدراسية"
      description="نظرة سريعة شاملة على المواعيد، القاعة، السعة، والسياسة المالية للمجموعة"
      size="lg"
    >
      <div className="space-y-4">
        {/* ترويسة المجموعة */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
                {group.groupCode}
              </span>
              <Badge variant={group.isActive ? 'success' : 'neutral'}>
                {group.isActive ? 'مجموعة نشطة' : 'متوقفة'}
              </Badge>
              <Badge variant="purple">{group.subject}</Badge>
            </div>
            <h3 className="text-xl font-black text-foreground">{group.name}</h3>
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <GraduationCap className="h-3.5 w-3.5 text-primary" />
              {group.gradeLevel}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canManageGroups && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(group);
                }}
                className="gap-1.5 text-xs"
              >
                <Edit3 className="h-3.5 w-3.5" />
                تعديل المجموعة
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                onOpenChange(false);
                navigate(`/groups/${group.id}`);
              }}
              className="gap-1.5 text-xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              الطلاب والاشتراكات
            </Button>
          </div>
        </div>

        {/* معلومات المدرس، القاعة، والسعة */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-primary" />
              المدرس الأساسي
            </span>
            <p className="mt-1 text-sm font-bold text-foreground">
              {group.primaryTeacherName || '—'}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
              القاعة الافتراضية
            </span>
            <p className="mt-1 text-sm font-bold text-foreground">
              {group.defaultClassroomName || 'لم تُحدد قاعة ثابتة'}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-purple-600" />
              السعة الطلابية
            </span>
            <div className="mt-1 flex items-baseline justify-between">
              <p className="text-sm font-bold text-foreground">
                {group.activeStudentsCount} / {group.maxStudents} طالب
              </p>
              <span className="text-xs font-semibold text-muted-foreground">
                {capacityRatio}%
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${
                  capacityRatio >= 90
                    ? 'bg-rose-500'
                    : capacityRatio >= 70
                    ? 'bg-amber-500'
                    : 'bg-primary'
                }`}
                style={{ width: `${capacityRatio}%` }}
              />
            </div>
          </div>
        </div>

        {/* المواعيد الأسبوعية */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h4 className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground mb-3">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            المواعيد الأسبوعية المجدولة
          </h4>
          {group.scheduleSlots && group.scheduleSlots.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {group.scheduleSlots.map((slot, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs"
                >
                  <span className="font-bold text-foreground">
                    يوم {ARABIC_DAYS[slot.dayOfWeek % 7] ?? `يوم ${slot.dayOfWeek}`}
                  </span>
                  <span className="font-mono text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3 text-primary" />
                    {formatTimeRangeAr(slot.startTime, slot.endTime)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">لم يتم تحديد مواعيد أسبوعية للمجموعة بعد</p>
          )}
        </div>

        {/* التسعير والسياسات المالية */}
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h4 className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <Coins className="h-3.5 w-3.5 text-emerald-600" />
            التسعير وسياسة الإيرادات
          </h4>

          <div className={`grid grid-cols-2 ${canSeeSplit ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-2.5`}>
            <div className="rounded-lg bg-muted/40 p-2.5">
              <span className="text-[11px] text-muted-foreground block">الاشتراك الشهري</span>
              <span className="text-sm font-bold text-foreground">{formatCurrency(group.monthlyPrice)}</span>
            </div>
            <div className="rounded-lg bg-muted/40 p-2.5">
              <span className="text-[11px] text-muted-foreground block">حصص الشهر الافتراضية</span>
              <span className="text-sm font-bold text-foreground">{group.monthlySessionsCount} حصص</span>
            </div>
            <div className="rounded-lg bg-muted/40 p-2.5">
              <span className="text-[11px] text-muted-foreground block">سعر الحصة المحسوب</span>
              <span className="text-sm font-bold text-emerald-600">{formatCurrency(group.calculatedSessionPrice)}</span>
            </div>
            {canSeeSplit && (
              <div className="rounded-lg bg-muted/40 p-2.5">
                <span className="text-[11px] text-muted-foreground block">تقسيم العائد</span>
                <span className="text-xs font-bold text-foreground">
                  {group.revenueSplitMethod === GroupRevenueSplitMethod.CUSTOM_PERCENTAGE
                    ? `${group.teacherPercentage ?? 0}% للمدرس`
                    : group.revenueSplitMethod === GroupRevenueSplitMethod.FIXED_PER_SESSION
                    ? `${formatCurrency(group.teacherSharePerStudent)} / حصة`
                    : group.teacherSharePerStudent && group.centerSharePerStudent
                    ? `${formatCurrency(group.teacherSharePerStudent)} / ${formatCurrency(group.centerSharePerStudent)}`
                    : splitLabel}
                </span>
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-border/60 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
              سياسة غياب الشهر: <strong className="text-foreground">{absencePolicyLabel}</strong>
            </span>
            <span>
              محاسبة الغياب بعذر:{' '}
              <strong className={group.chargeExcusedAbsence ? 'text-rose-500' : 'text-emerald-600'}>
                {group.chargeExcusedAbsence ? 'تُحسب الحصة كحضور' : 'إعفاء من الحصة'}
              </strong>
            </span>
          </div>
        </div>

        {/* الملاحظات إن وجدت */}
        {group.notes && (
          <div className="rounded-xl border border-border bg-card p-3 text-xs">
            <span className="font-bold text-muted-foreground block mb-1">ملاحظات إضافية:</span>
            <p className="text-foreground leading-relaxed whitespace-pre-wrap">{group.notes}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
