import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Edit3,
  ExternalLink,
  GraduationCap,
  Loader2,
  MessageCircle,
  Phone,
  User,
  Wallet,
  XCircle,
} from 'lucide-react';
import { EnrollmentStatus, PERMISSIONS } from '@edu-center/shared';
import { Badge, Button, Modal } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { useCenterSettings } from '@/features/settings/center-settings-context';
import { apiClient } from '@/lib/api-client';
import { formatCurrency, formatDateAr, formatYearMonthAr } from '@/lib/formatters';
import { buildWhatsAppUrl } from '@/lib/whatsapp.util';
import {
  STUDENT_STATUS_META,
  StudentProfileData,
  StudentRow,
} from '../students.types';

interface StudentQuickViewModalProps {
  student: StudentRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (student: StudentRow) => void;
}

interface MonthPaymentPresentation {
  label: string;
  description: string;
  badgeVariant: 'success' | 'warning' | 'danger' | 'neutral';
  badgeText: string;
  containerClass: string;
  iconClass: string;
  Icon: typeof CheckCircle2;
}

function getCurrentYearMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function resolveCurrentMonthPaymentMeta(totals: {
  totalDue: number;
  totalPaid: number;
  remaining: number;
}): MonthPaymentPresentation {
  if (totals.remaining <= 0 && totals.totalDue > 0) {
    return {
      label: 'تم سداد الشهر الحالي بالكامل',
      description: 'لا توجد أي متأخرات مالية على الطالب لهذا الشهر',
      badgeVariant: 'success',
      badgeText: 'مدفوع بالكامل',
      containerClass: 'border-emerald-500/30 bg-emerald-500/5',
      iconClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
      Icon: CheckCircle2,
    };
  }
  if (totals.totalPaid > 0 && totals.remaining > 0) {
    return {
      label: 'تم سداد جزء من الشهر الحالي',
      description: 'يوجد مبلغ متبقٍّ مطلوب سداده لاستكمال اشتراك الشهر',
      badgeVariant: 'warning',
      badgeText: 'سداد جزئي',
      containerClass: 'border-amber-500/30 bg-amber-500/5',
      iconClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
      Icon: AlertCircle,
    };
  }
  if (totals.totalDue > 0 && totals.totalPaid === 0) {
    return {
      label: 'لم يتم سداد الشهر الحالي بعد',
      description: 'مستحق الدفع بالكامل عن حصص ومجموعات هذا الشهر',
      badgeVariant: 'danger',
      badgeText: 'غير مدفوع',
      containerClass: 'border-destructive/30 bg-destructive/5',
      iconClass: 'bg-destructive/15 text-destructive',
      Icon: XCircle,
    };
  }
  return {
    label: 'لا توجد مستحقات للشهر الحالي',
    description: 'لم تُحتسب رسوم على الطالب في الشهر الحالي حتى الآن',
    badgeVariant: 'neutral',
    badgeText: 'لا توجد مستحقات',
    containerClass: 'border-border bg-muted/30',
    iconClass: 'bg-muted text-muted-foreground',
    Icon: Wallet,
  };
}

export function StudentQuickViewModal({
  student,
  open,
  onOpenChange,
  onEdit,
}: StudentQuickViewModalProps) {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { settings } = useCenterSettings();
  const currencySymbol = settings.currencySymbol || 'ج.م';

  const canUpdateStudent = hasPermission(PERMISSIONS.STUDENTS_UPDATE);
  const canViewFinance = hasPermission(PERMISSIONS.FINANCE_VIEW);
  const currentYearMonth = getCurrentYearMonthKey();

  const { data: profile, isLoading: isProfileLoading } = useQuery<StudentProfileData>({
    queryKey: ['student-quick-profile', student?.id, currentYearMonth],
    queryFn: async () => {
      const res = await apiClient.get(`/students/${student!.id}/profile`, {
        params: { yearMonth: currentYearMonth },
      });
      return res.data;
    },
    enabled: open && Boolean(student?.id),
    staleTime: 30_000,
  });

  if (!student) return null;

  const statusMeta = STUDENT_STATUS_META[student.status] ?? {
    label: student.status,
    variant: 'neutral' as const,
  };

  const displayMonth = profile?.yearMonth || currentYearMonth;
  const monthTotals = profile?.monthTotals ?? {
    totalDue: 0,
    totalPaid: 0,
    remaining: 0,
    presentCount: 0,
    absentCount: 0,
    totalSessions: 0,
  };
  const paymentMeta = resolveCurrentMonthPaymentMeta(monthTotals);
  const PaymentIcon = paymentMeta.Icon;

  const activeGroupsCount =
    profile?.enrollments?.filter((e) => e.status === EnrollmentStatus.ACTIVE).length ??
    student.activeGroupsCount ??
    0;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="بطاقة تفاصيل الطالب السريعة"
      description="ملخص منظم للهوية، حالة سداد الشهر الحالي، وبيانات التواصل والقيد"
      size="md"
    >
      <div className="space-y-4">
        {/* 1. بطاقة الهوية الأساسية للطالب */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-gradient-to-l from-primary/5 via-card to-card p-4 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-black text-primary-foreground shadow-sm">
              {student.fullName.trim().charAt(0) || 'ط'}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-black text-foreground">{student.fullName}</h3>
                <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1 font-medium">
                  <GraduationCap className="h-3.5 w-3.5 text-primary" />
                  {student.gradeLevel}
                </span>
                <span className="text-border">•</span>
                <span
                  dir="ltr"
                  className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold text-primary"
                >
                  {student.studentCode}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. حالة سداد الشهر الحالي (تُعرض تلقائياً) */}
        {canViewFinance && (
          <div className={`rounded-2xl border p-4 transition-colors ${paymentMeta.containerClass}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/60">
              <div className="flex items-center gap-2.5">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${paymentMeta.iconClass}`}>
                  {isProfileLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <PaymentIcon className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <p className="text-xs font-extrabold text-foreground">
                    حالة سداد الشهر الحالي ({formatYearMonthAr(displayMonth)})
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {isProfileLoading ? 'جاري التحقق من سجل المدفوعات...' : paymentMeta.label}
                  </p>
                </div>
              </div>
              {!isProfileLoading && (
                <Badge variant={paymentMeta.badgeVariant}>{paymentMeta.badgeText}</Badge>
              )}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-border/60 bg-card/80 px-2.5 py-2">
                <span className="block text-[10px] font-semibold text-muted-foreground">المستحق</span>
                <span className="mt-0.5 block text-xs font-extrabold text-foreground">
                  {isProfileLoading ? '...' : formatCurrency(monthTotals.totalDue, currencySymbol)}
                </span>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/80 px-2.5 py-2">
                <span className="block text-[10px] font-semibold text-muted-foreground">المدفوع</span>
                <span className="mt-0.5 block text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                  {isProfileLoading ? '...' : formatCurrency(monthTotals.totalPaid, currencySymbol)}
                </span>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/80 px-2.5 py-2">
                <span className="block text-[10px] font-semibold text-muted-foreground">المتبقي</span>
                <span
                  className={`mt-0.5 block text-xs font-extrabold ${
                    monthTotals.remaining > 0 ? 'text-destructive' : 'text-foreground'
                  }`}
                >
                  {isProfileLoading ? '...' : formatCurrency(monthTotals.remaining, currencySymbol)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 3. شبكة منظمة لبيانات التواصل والاشتراكات */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Phone className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold text-muted-foreground">هاتف الطالب</span>
              <p dir="ltr" className="mt-0.5 text-right font-mono text-xs font-bold text-foreground">
                {student.phone || 'غير مسجل'}
              </p>
              {student.phone && (() => {
                const waUrl = buildWhatsAppUrl(student.phone, '', 'app');
                if (!waUrl) return null;
                return (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:underline"
                  >
                    <MessageCircle className="h-3 w-3" />
                    واتساب
                  </a>
                );
              })()}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold text-muted-foreground">هاتف ولي الأمر</span>
              <p dir="ltr" className="mt-0.5 text-right font-mono text-xs font-bold text-foreground">
                {student.guardianPhone || 'غير مسجل'}
              </p>
              {student.guardianPhone && (() => {
                const waUrl = buildWhatsAppUrl(student.guardianPhone, '', 'app');
                if (!waUrl) return null;
                return (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:underline"
                  >
                    <MessageCircle className="h-3 w-3" />
                    واتساب ولي الأمر
                  </a>
                );
              })()}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold text-muted-foreground">المجموعات النشطة</span>
              <p className="mt-0.5 text-xs font-extrabold text-foreground">
                {activeGroupsCount} مجموعة مفعّلة
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold text-muted-foreground">تاريخ التسجيل</span>
              <p className="mt-0.5 text-xs font-bold text-foreground">
                {formatDateAr(student.registrationDate)}
              </p>
            </div>
          </div>
        </div>

        {/* 4. ملاحظات إدارية */}
        {student.notes && (
          <div className="rounded-xl border border-border bg-muted/25 p-3 text-xs">
            <span className="mb-1 block font-bold text-muted-foreground">ملاحظات إدارية:</span>
            <p className="leading-relaxed text-foreground">{student.notes}</p>
          </div>
        )}

        {/* 5. أزرار الإجراءات */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3.5">
          {canUpdateStudent ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onEdit(student);
              }}
              className="gap-1.5"
            >
              <Edit3 className="h-3.5 w-3.5" />
              تعديل البيانات
            </Button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                navigate(`/whatsapp?studentId=${student.id}`);
              }}
              className="gap-1.5 text-emerald-700 dark:text-emerald-300"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              رسالة قالب
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                navigate(`/students/${student.id}`);
              }}
              className="gap-1.5 font-bold"
            >
              الملف الأكاديمي والمالي الشامل
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
