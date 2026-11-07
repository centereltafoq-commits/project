import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarCheck2,
  CalendarRange,
  CheckCircle2,
  Clock,
  GraduationCap,
  HelpCircle,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { formatYearMonthAr } from '@/lib/formatters';
import { DashboardSummaryData } from '../dashboard.types';

interface DashboardMonthlySessionsCardProps {
  data: DashboardSummaryData;
}

export function DashboardMonthlySessionsCard({ data }: DashboardMonthlySessionsCardProps) {
  const { hasPermission } = useAuth();
  const canViewFinance = hasPermission(PERMISSIONS.FINANCE_VIEW);

  const stats = data.monthlySessionsStats ?? {
    totalSessions: 0,
    executedSessions: 0,
    scheduledSessions: 0,
    totalBillableSessions: 0,
    totalPaidSessions: 0,
    totalUnpaidSessions: 0,
    collectionRateSessions: 0,
  };

  const collectionRate = stats.collectionRateSessions;
  const unpaidRate = stats.totalBillableSessions > 0 ? 100 - collectionRate : 0;

  return (
    <Card className="overflow-hidden border border-border shadow-sm">
      <CardHeader className="flex flex-col gap-3 border-b border-border bg-muted/20 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
            <CalendarCheck2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold sm:text-lg">
                حركة الحصص والتحصيل الشهري — شهر {formatYearMonthAr(data.yearMonth)}
              </CardTitle>
              <Badge
                variant={
                  collectionRate >= 80 ? 'success' : collectionRate >= 50 ? 'warning' : 'neutral'
                }
              >
                معدل السداد: {collectionRate}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              متابعة دقيقة لعدد الحصص المنفذة بالسنتر، والحصص المستحقة للتحصيل والمسددة والمتأخرة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/attendance">
            <Button size="sm" variant="outline">
              <Clock className="h-3.5 w-3.5" />
              سجل الحضور والجلسات
            </Button>
          </Link>
          {canViewFinance && (
            <Link to="/finance">
              <Button size="sm" variant="primary">
                سجل التحصيل المالي
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-5">
        {/* شبكة المؤشرات الـ 4 الأساسية المطلوبة */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. كام حصة اتعملت خلال الشهر */}
          <div className="relative overflow-hidden rounded-xl border border-sky-500/20 bg-sky-500/5 p-4 transition-all hover:shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-800 dark:text-sky-300">
                الحصص المنفذة بالسنتر
              </span>
              <div className="rounded-lg bg-sky-500/10 p-1.5 text-sky-600 dark:text-sky-400">
                <CalendarRange className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-foreground">
                {stats.executedSessions}
              </span>
              <span className="text-xs text-muted-foreground font-semibold">حصة دراسية</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-sky-500/10 pt-2 text-[11px] text-muted-foreground">
              <span>إجمالي المجدول: {stats.totalSessions} حصة</span>
              {stats.scheduledSessions > 0 && (
                <span className="font-medium text-sky-700 dark:text-sky-300">
                  ({stats.scheduledSessions} قادمة)
                </span>
              )}
            </div>
          </div>

          {/* 2. كام حصة المفروض هتتدفع */}
          <div className="relative overflow-hidden rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 transition-all hover:shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300">
                الحصص المستحقة للدفع
              </span>
              <div className="rounded-lg bg-indigo-500/10 p-1.5 text-indigo-600 dark:text-indigo-400">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-foreground">
                {stats.totalBillableSessions}
              </span>
              <span className="text-xs text-muted-foreground font-semibold">حصة طالب</span>
            </div>
            <div className="mt-2 border-t border-indigo-500/10 pt-2 text-[11px] text-muted-foreground">
              <span>إجمالي حضور واشتراكات الطلاب المطلوب سدادها</span>
            </div>
          </div>

          {/* 3. كام حصة اتدفعت */}
          <div className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 transition-all hover:shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                الحصص المسددة فعلياً
              </span>
              <div className="rounded-lg bg-emerald-500/20 p-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {stats.totalPaidSessions}
              </span>
              <span className="text-xs text-muted-foreground font-semibold">حصة مسددة</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-emerald-500/20 pt-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
              <span>تم سدادها بالكامل</span>
              <span>{collectionRate}% من المستحق</span>
            </div>
          </div>

          {/* 4. كام حصة مدفعتش */}
          <div className="relative overflow-hidden rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 transition-all hover:shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-800 dark:text-rose-300">
                الحصص غير المسددة (متأخرات)
              </span>
              <div className="rounded-lg bg-rose-500/20 p-1.5 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-3xl font-black text-rose-600 dark:text-rose-400">
                {stats.totalUnpaidSessions}
              </span>
              <span className="text-xs text-muted-foreground font-semibold">حصة معلقة</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-rose-500/20 pt-2 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
              <span>متبقية كمديونية</span>
              <span>{unpaidRate}% قيد التحصيل</span>
            </div>
          </div>
        </div>

        {/* شريط التحصيل البصري المزدوج التناسبي */}
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-1.5 text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              توزيع سداد الحصص المستحقة لهذا الشهر
            </span>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                مسدد: {stats.totalPaidSessions} ({collectionRate}%)
              </span>
              <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                متأخر: {stats.totalUnpaidSessions} ({unpaidRate}%)
              </span>
            </div>
          </div>

          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: `${collectionRate}%` }}
              title={`مسدد: ${stats.totalPaidSessions} حصة (${collectionRate}%)`}
            />
            <div
              className="h-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-500"
              style={{ width: `${unpaidRate}%` }}
              title={`غير مسدد: ${stats.totalUnpaidSessions} حصة (${unpaidRate}%)`}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>إجمالي الحصص المستحقة: {stats.totalBillableSessions} حصة حضور</span>
            <span>
              نسبة التحصيل الفعلية:{' '}
              <strong className="text-foreground">{collectionRate}%</strong>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
