import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  PieChart,
  Receipt,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, StatCard } from '@/design-system';
import { formatCurrency, formatYearMonthAr } from '@/lib/formatters';
import { DashboardSummaryData } from '../dashboard.types';

interface DashboardFinanceTabProps {
  data: DashboardSummaryData;
}

export function DashboardFinanceTab({ data }: DashboardFinanceTabProps) {
  const collectionRate =
    data.totalRevenue > 0
      ? Math.min(100, Math.round((data.totalCollectedPayments / data.totalRevenue) * 100))
      : 0;

  const totalObligations =
    data.totalTeacherDues + data.totalAssistantDues + data.totalExpenses;

  const isProfitable = data.netCenterResult >= 0;

  return (
    <div className="space-y-6">
      {/* 1. المركز المالي العام ونسبة التحصيل */}
      <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-card via-card to-primary/5">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <PieChart className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg">
                المركز المالي التنفيذي لشهر {formatYearMonthAr(data.yearMonth)}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                متابعة التحصيل الفعلي مقابل المستحقات وصافي الأرباح بعد كافة الالتزامات
              </p>
            </div>
          </div>
          <Link to="/finance">
            <Button size="sm" variant="primary">
              الإدارة المالية الكاملة
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-6 pt-5">
          {/* مؤشرات الإيراد والتحصيل والمتأخرات */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <span className="text-xs text-muted-foreground block font-medium">
                إجمالي إيرادات المجموعات (المستهدف)
              </span>
              <p className="mt-1 text-2xl font-black text-foreground">
                {formatCurrency(data.totalRevenue)}
              </p>
              <span className="mt-1 text-[11px] text-muted-foreground block">
                مجموع مستحقات اشتراكات الطلاب للشهر
              </span>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <span className="text-xs text-emerald-800 dark:text-emerald-300 block font-medium">
                إجمالي التحصيل الفعلي
              </span>
              <p className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(data.totalCollectedPayments)}
              </p>
              <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3 w-3" />
                <span>تم تحصيل {collectionRate}% من المستهدف</span>
              </div>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <span className="text-xs text-amber-800 dark:text-amber-300 block font-medium">
                متأخرات الطلاب (مديونيات قيد التحصيل)
              </span>
              <p className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">
                {formatCurrency(data.totalReceivables)}
              </p>
              <span className="mt-1 text-[11px] text-amber-700 dark:text-amber-300 block">
                مبالغ لم تسدد بعد من فواتير الطلاب
              </span>
            </div>

            <div
              className={`rounded-xl border p-4 ${
                isProfitable
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-rose-500/40 bg-rose-500/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">
                  صافي نتيجة السنتر
                </span>
                {isProfitable ? (
                  <Badge variant="success">فائض ربحي</Badge>
                ) : (
                  <Badge variant="danger">عجز مالي</Badge>
                )}
              </div>
              <p
                className={`mt-1 text-2xl font-black ${
                  isProfitable
                    ? 'text-primary'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatCurrency(data.netCenterResult)}
              </p>
              <span className="mt-1 text-[11px] text-muted-foreground block">
                بعد سداد أنصبة المدرسين والمساعدين والمصروفات
              </span>
            </div>
          </div>

          {/* شريط تقدم التحصيل البصري */}
          <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="flex items-center gap-1.5 text-foreground">
                <Banknote className="h-4 w-4 text-emerald-600" />
                معدل إنجاز التحصيل الفعلي لهذا الشهر
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                {collectionRate}%
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                style={{ width: `${collectionRate}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>0 ج.م</span>
              <span>المحصل: {formatCurrency(data.totalCollectedPayments)}</span>
              <span>المستهدف: {formatCurrency(data.totalRevenue)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. توزيع الالتزامات والمصروفات للشهر */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">
            توزيع الالتزامات والمصروفات (إجمالي الالتزامات: {formatCurrency(totalObligations)})
          </h3>
          <Link to="/reports">
            <Button variant="ghost" size="sm">
              تقرير الأرباح والخسائر الشامل
              <ArrowLeft className="h-3 w-3" />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title="مستحقات المدرسين المتعاقدين"
            value={formatCurrency(data.totalTeacherDues)}
            subtitle="أنصبة الحصص الشهرية المعتمدة"
            icon={UserCheck}
            tone="purple"
          />

          <StatCard
            title="مستحقات المساعدين والمشرفين"
            value={formatCurrency(data.totalAssistantDues)}
            subtitle="العمولات والمكافآت والرواتب الثابتة"
            icon={Users}
            tone="warning"
          />

          <StatCard
            title="المصروفات التشغيلية للسنتر"
            value={formatCurrency(data.totalExpenses)}
            subtitle="إيجارات، فواتير مرافق، ضيافة، مستلزمات"
            icon={Receipt}
            tone="danger"
          />
        </div>
      </section>

      {/* 3. روابط سريعة للدفاتر المالية */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link
          to="/finance"
          className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition hover:border-primary/50 hover:bg-muted/30"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold">دفتر تحصيل الرسوم</p>
              <p className="text-xs text-muted-foreground">طباعة الإيصالات والبحث بالرقم</p>
            </div>
          </div>
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Link>

        <Link
          to="/finance"
          className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition hover:border-primary/50 hover:bg-muted/30"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-rose-500/10 p-2 text-rose-600">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold">تسجيل المصروفات</p>
              <p className="text-xs text-muted-foreground">توثيق فواتير السنتر والبنود</p>
            </div>
          </div>
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Link>

        <Link
          to="/reports"
          className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition hover:border-primary/50 hover:bg-muted/30"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold">التقارير المالية والضريبية</p>
              <p className="text-xs text-muted-foreground">كشف حساب الطلاب والمدرسين</p>
            </div>
          </div>
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}

