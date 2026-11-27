import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  PieChart,
  Receipt,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { formatCurrency, formatYearMonthAr } from '@/lib/formatters';
import { DashboardSummaryData } from '../dashboard.types';

interface DashboardFinanceTabProps {
  data: DashboardSummaryData;
}

export function DashboardFinanceTab({ data }: DashboardFinanceTabProps) {
  const { hasPermission } = useAuth();
  const canViewReports = hasPermission(PERMISSIONS.REPORTS_VIEW);

  const collectionRate =
    data.totalRevenue > 0
      ? Math.min(100, Math.round((data.totalCollectedPayments / data.totalRevenue) * 100))
      : 0;
  const remainingRate = data.totalRevenue > 0 ? Math.max(0, 100 - collectionRate) : 0;

  const totalObligations =
    data.totalTeacherDues + data.totalAssistantDues + data.totalExpenses;

  const obligationShare = (amount: number) =>
    totalObligations > 0 ? Math.round((amount / totalObligations) * 100) : 0;

  const isProfitable = data.netCenterResult >= 0;
  const netCashFlow = data.netCashFlow ?? 0;
  const isCashPositive = netCashFlow >= 0;

  const stats = data.monthlySessionsStats;

  return (
    <div className="space-y-5">
      {/* 1. النتيجة التنفيذية للمعادلة المالية (صافي الربح مقابل السيولة النقدية) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          className={`border ${
            isProfitable
              ? 'border-primary/35 bg-primary/[0.03]'
              : 'border-rose-500/35 bg-rose-500/[0.03]'
          }`}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">
                    صافي ربح السنتر — {formatYearMonthAr(data.yearMonth)}
                  </span>
                  <Badge variant={isProfitable ? 'success' : 'danger'}>
                    {isProfitable ? 'فائض ربحي' : 'عجز مالي'}
                  </Badge>
                </div>
                <p
                  className={`mt-2 text-3xl font-black tracking-tight tabular-nums ${
                    isProfitable ? 'text-primary' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatCurrency(data.netCenterResult)}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  إجمالي نصيب السنتر عن الطلاب من المجموعات (دون خصم المساعدين أو المصروفات)
                </p>
              </div>
              <div
                className={`rounded-xl p-2.5 ${
                  isProfitable
                    ? 'bg-primary/10 text-primary'
                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                }`}
              >
                {isProfitable ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card
          className={`border ${
            isCashPositive
              ? 'border-teal-500/35 bg-teal-500/[0.03]'
              : 'border-rose-500/35 bg-rose-500/[0.03]'
          }`}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">
                    صافي التدفق النقدي بالخزينة
                  </span>
                  <Badge variant={isCashPositive ? 'success' : 'danger'}>
                    {isCashPositive ? 'سيولة موجبة' : 'عجز سيولة'}
                  </Badge>
                </div>
                <p
                  className={`mt-2 text-3xl font-black tracking-tight tabular-nums ${
                    isCashPositive
                      ? 'text-teal-600 dark:text-teal-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatCurrency(netCashFlow)}
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  المحصل نقداً فعلياً − المنصرف الفعلي للمدرسين والمساعدين والمصروفات
                </p>
              </div>
              <div className="rounded-xl bg-teal-500/10 p-2.5 text-teal-600 dark:text-teal-400">
                <Wallet className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. المعادلة المحاسبية: الإيرادات (يمين) مقابل الالتزامات والمصروفات (يسار) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* كتلة الإيرادات والتحصيل */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                <Banknote className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-base">الجانب الدائن: الإيرادات والتحصيل</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {stats?.totalPaidSessions ?? 0} حصة مسددة من {stats?.totalBillableSessions ?? 0} حصة مستحقة
                </p>
              </div>
            </div>
            <Link to={`/finance?yearMonth=${data.yearMonth}`}>
              <Button size="sm" variant="primary">
                الإدارة المالية
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>

          <CardContent className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <span className="text-[11px] text-muted-foreground block">المستهدف الكلي</span>
                <p className="mt-1 text-base font-black text-foreground tabular-nums">
                  {formatCurrency(data.totalRevenue)}
                </p>
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 block">
                  تحصيل اليوم
                </span>
                <p className="mt-1 text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(data.todayCollectedPayments ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border border-teal-500/30 bg-teal-500/5 p-3">
                <span className="text-[11px] font-semibold text-teal-800 dark:text-teal-300 block">
                  المحصّل للشهر
                </span>
                <p className="mt-1 text-base font-black text-teal-600 dark:text-teal-400 tabular-nums">
                  {formatCurrency(data.totalCollectedPayments)}
                </p>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 block">
                  المتأخرات
                </span>
                <p className="mt-1 text-base font-black text-amber-600 dark:text-amber-400 tabular-nums">
                  {formatCurrency(data.totalReceivables)}
                </p>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-card p-3.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>نسبة التحصيل المالي للشهر</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono">
                  {collectionRate}%
                </span>
              </div>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="bg-emerald-500 transition-all duration-500"
                  style={{ width: `${collectionRate}%` }}
                />
                <div
                  className="bg-amber-400/70 transition-all duration-500"
                  style={{ width: `${remainingRate}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>مسدد: {collectionRate}%</span>
                <span>متبقي قيد التحصيل: {remainingRate}% ({stats?.totalUnpaidSessions ?? 0} حصة)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* كتلة الالتزامات والمصروفات */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400">
                <PieChart className="h-4.5 w-4.5" />
              </div>
              <div>
                <CardTitle className="text-base">الجانب المدين: الالتزامات والمصروفات</CardTitle>
                <p className="text-xs text-muted-foreground">
                  إجمالي التزامات الشهر: <strong className="text-foreground">{formatCurrency(totalObligations)}</strong>
                </p>
              </div>
            </div>
            {canViewReports && (
              <Link to="/reports">
                <Button size="sm" variant="outline">
                  التقارير المالية
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Button>
              </Link>
            )}
          </CardHeader>

          <CardContent className="space-y-3.5 pt-4">
            {/* مستحقات المدرسين */}
            <div className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-bold text-foreground">
                  <UserCheck className="h-3.5 w-3.5 text-violet-600" />
                  مستحقات المدرسين المتعاقدين
                </span>
                <span className="font-black text-foreground tabular-nums">
                  {formatCurrency(data.totalTeacherDues)}
                  <span className="mr-1.5 text-[11px] font-medium text-muted-foreground">
                    ({obligationShare(data.totalTeacherDues)}%)
                  </span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-violet-500 transition-all"
                  style={{ width: `${obligationShare(data.totalTeacherDues)}%` }}
                />
              </div>
              {typeof data.totalTeacherPaidOut === 'number' && (
                <p className="text-[11px] text-muted-foreground">
                  تم صرف فعلياً: {formatCurrency(data.totalTeacherPaidOut)}
                </p>
              )}
            </div>

            {/* مستحقات المساعدين */}
            <div className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-bold text-foreground">
                  <Users className="h-3.5 w-3.5 text-amber-600" />
                  مستحقات المساعدين والمشرفين
                </span>
                <span className="font-black text-foreground tabular-nums">
                  {formatCurrency(data.totalAssistantDues)}
                  <span className="mr-1.5 text-[11px] font-medium text-muted-foreground">
                    ({obligationShare(data.totalAssistantDues)}%)
                  </span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${obligationShare(data.totalAssistantDues)}%` }}
                />
              </div>
              {typeof data.totalAssistantPaidOut === 'number' && (
                <p className="text-[11px] text-muted-foreground">
                  تم صرف فعلياً: {formatCurrency(data.totalAssistantPaidOut)}
                </p>
              )}
            </div>

            {/* المصروفات التشغيلية */}
            <div className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-bold text-foreground">
                  <Receipt className="h-3.5 w-3.5 text-rose-600" />
                  المصروفات التشغيلية للسنتر
                </span>
                <span className="font-black text-foreground tabular-nums">
                  {formatCurrency(data.totalExpenses)}
                  <span className="mr-1.5 text-[11px] font-medium text-muted-foreground">
                    ({obligationShare(data.totalExpenses)}%)
                  </span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-rose-500 transition-all"
                  style={{ width: `${obligationShare(data.totalExpenses)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
