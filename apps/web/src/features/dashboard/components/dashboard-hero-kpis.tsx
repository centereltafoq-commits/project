import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Banknote,
  Building2,
  CalendarClock,
  CheckCircle2,
  GraduationCap,
  Layers,
  UserCheck,
} from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { Badge, Card } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { formatCurrency, formatDateAr, formatYearMonthAr } from '@/lib/formatters';
import { DashboardSummaryData } from '../dashboard.types';

interface DashboardHeroKpisProps {
  data: DashboardSummaryData;
}

export function DashboardHeroKpis({ data }: DashboardHeroKpisProps) {
  const { hasPermission } = useAuth();
  const canViewFullFinance = hasPermission(PERMISSIONS.FINANCE_VIEW);
  const canViewCollections =
    canViewFullFinance || hasPermission(PERMISSIONS.FINANCE_COLLECT_PAYMENT);
  const canViewClassrooms = hasPermission(PERMISSIONS.CLASSROOMS_VIEW);
  const canAccessAttendance =
    hasPermission(PERMISSIONS.ATTENDANCE_VIEW) || hasPermission(PERMISSIONS.SESSIONS_VIEW);
  const canViewStudents = hasPermission(PERMISSIONS.STUDENTS_VIEW);

  const stats = data.monthlySessionsStats ?? {
    totalSessions: 0,
    executedSessions: 0,
    scheduledSessions: 0,
    totalBillableSessions: 0,
    totalPaidSessions: 0,
    totalUnpaidSessions: 0,
    collectionRateSessions: 0,
  };

  const paymentStats = data.monthlyPaymentStats ?? {
    paidStudentsCount: 0,
    unpaidStudentsCount: 0,
    totalBilledStudentsCount: 0,
    paidGroupsCount: 0,
    unpaidGroupsCount: 0,
    totalBilledGroupsCount: 0,
  };

  const paidStudentsPercent =
    paymentStats.totalBilledStudentsCount > 0
      ? Math.min(100, Math.round((paymentStats.paidStudentsCount / paymentStats.totalBilledStudentsCount) * 100))
      : 0;
  const unpaidStudentsPercent =
    paymentStats.totalBilledStudentsCount > 0 ? Math.max(0, 100 - paidStudentsPercent) : 0;

  const paidGroupsPercent =
    paymentStats.totalBilledGroupsCount > 0
      ? Math.min(100, Math.round((paymentStats.paidGroupsCount / paymentStats.totalBilledGroupsCount) * 100))
      : 0;
  const unpaidGroupsPercent =
    paymentStats.totalBilledGroupsCount > 0 ? Math.max(0, 100 - paidGroupsPercent) : 0;

  const totalMarkedToday =
    data.todayAttendance.present +
    data.todayAttendance.absent +
    data.todayAttendance.excused;

  const isProfitable = data.netCenterResult >= 0;

  // عرض غير مالي للموظفين بدون صلاحية التحصيل أو أرباح السنتر
  if (!canViewCollections) {
    const visibleCount = 3 + (canViewClassrooms ? 1 : 0);
    const colsClass = visibleCount === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3';

    return (
      <div className={`grid grid-cols-1 gap-3.5 sm:grid-cols-2 ${colsClass}`}>
        <Card className="p-4 transition-all hover:border-primary/40 hover:shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <span className="text-xs font-semibold text-muted-foreground block">
                عدد الحصص بالشهر
              </span>
              <p className="text-2xl font-black tracking-tight text-foreground tabular-nums">
                {stats.executedSessions}{' '}
                <span className="text-sm font-bold text-muted-foreground">
                  من {stats.totalSessions}
                </span>
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Layers className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
            <span>{stats.scheduledSessions} حصة قادمة مجدولة</span>
            {canAccessAttendance && (
              <Link to="/attendance" className="font-bold text-primary hover:underline shrink-0">
                الحصص
              </Link>
            )}
          </div>
        </Card>

        <Card className="p-4 transition-all hover:border-amber-500/40 hover:shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <span className="text-xs font-semibold text-muted-foreground block">
                حصص اليوم المجدولة
              </span>
              <p className="text-2xl font-black tracking-tight text-foreground tabular-nums">
                {data.todaySessionsCount}{' '}
                <span className="text-sm font-bold text-muted-foreground">حصة</span>
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <CalendarClock className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
            <span className="truncate">
              {totalMarkedToday > 0
                ? `حاضر: ${data.todayAttendance.present} من ${totalMarkedToday} رُصدوا`
                : 'بانتظار رصد حضور اليوم'}
            </span>
            {canAccessAttendance && (
              <Link to="/attendance" className="font-bold text-primary hover:underline shrink-0">
                الكشوف
              </Link>
            )}
          </div>
        </Card>

        {canViewClassrooms && (
          <Card className="p-4 transition-all hover:border-violet-500/40 hover:shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0">
                <span className="text-xs font-semibold text-muted-foreground block">
                  القاعات الشاغرة الآن
                </span>
                <p className="text-2xl font-black tracking-tight text-foreground tabular-nums">
                  {data.classroomsSummary.availableNow}{' '}
                  <span className="text-sm font-bold text-muted-foreground">
                    من {data.classroomsSummary.total}
                  </span>
                </p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400">
                <Building2 className="h-4.5 w-4.5" />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
              <span>مشغولة: {data.classroomsSummary.occupiedNow}</span>
              <Link to="/classrooms" className="font-bold text-primary hover:underline shrink-0">
                القاعات
              </Link>
            </div>
          </Card>
        )}

        <Card className="p-4 transition-all hover:border-primary/40 hover:shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <span className="text-xs font-semibold text-muted-foreground block">
                الطلاب النشطون بالسنتر
              </span>
              <p className="text-2xl font-black tracking-tight text-foreground tabular-nums">
                {data.activeStudents}{' '}
                <span className="text-sm font-bold text-muted-foreground">
                  من {data.totalStudents}
                </span>
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
              <GraduationCap className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
            <span>{data.groupsCount} مجموعة نشطة</span>
            {canViewStudents && (
              <Link to="/students" className="font-bold text-primary hover:underline shrink-0">
                الطلاب
              </Link>
            )}
          </div>
        </Card>
      </div>
    );
  }

  const todayPaymentsCount = data.todayPaymentsCount ?? 0;
  const isDifferentCalendarMonth = data.yearMonth !== data.todayDate.slice(0, 7);
  const monthLabelAr = formatYearMonthAr(data.yearMonth);

  return (
    <div className="space-y-3">
      {/* بطاقة إجمالي التحصيل اليومي للسنتر */}
      <Card className="border-emerald-500/30 bg-gradient-to-l from-emerald-500/[0.06] via-card to-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-black text-foreground">
                  إجمالي التحصيل اليومي للسنتر
                </span>
                <Badge variant="success" className="px-2 py-0.5 text-[11px]">
                  اليوم {formatDateAr(data.todayDate)}
                </Badge>
                {isDifferentCalendarMonth && (
                  <Badge variant="info" className="px-2 py-0.5 text-[11px]">
                    عن {monthLabelAr} فقط
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {todayPaymentsCount > 0
                  ? `${todayPaymentsCount.toLocaleString('en-US')} إيصال تحصيل مسجل اليوم${isDifferentCalendarMonth ? ` لحساب ${monthLabelAr}` : ''}`
                  : `لم تُسجَّل إيصالات تحصيل اليوم${isDifferentCalendarMonth ? ` لحساب ${monthLabelAr}` : ''} بعد`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end">
            <div className="text-right sm:text-left">
              <span className="text-[11px] font-semibold text-muted-foreground block">
                المحصّل اليوم
              </span>
              <p className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatCurrency(data.todayCollectedPayments ?? 0)}
              </p>
            </div>

            <Link
              to={`/finance?tab=payments-history&yearMonth=${data.yearMonth}`}
              className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
            >
              سجل الإيصالات
            </Link>
          </div>
        </div>
      </Card>

      {/* الصف الرئيسي: 4 مؤشرات أساسية لحالة سداد الطلاب والمجموعات للشهر */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. الطلاب اللي دفعت */}
        <Card className="border-emerald-500/25 bg-emerald-500/[0.03] p-4 transition-all hover:border-emerald-500/45 hover:shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  الطلاب اللي دفعت
                </span>
                <Badge variant="success" className="px-1.5 py-0 text-[10px]">
                  {paidStudentsPercent}%
                </Badge>
              </div>
              <p className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
                {paymentStats.paidStudentsCount.toLocaleString('en-US')}{' '}
                <span className="text-sm font-bold text-emerald-700/80 dark:text-emerald-300/80">
                  طالب مسدد
                </span>
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <UserCheck className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5 space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-500/15">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${paidStudentsPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="truncate">
                المحصّل: <strong className="text-foreground">{formatCurrency(data.totalCollectedPayments)}</strong>
              </span>
              <Link
                to={`/finance?tab=payments-history&yearMonth=${data.yearMonth}`}
                className="font-bold text-primary hover:underline shrink-0"
              >
                الإيصالات
              </Link>
            </div>
          </div>
        </Card>

        {/* 2. الطلاب اللي مدفعتش */}
        <Card className="border-rose-500/25 bg-rose-500/[0.03] p-4 transition-all hover:border-rose-500/45 hover:shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                  الطلاب اللي مدفعتش
                </span>
                <Badge
                  variant={paymentStats.unpaidStudentsCount > 0 ? 'danger' : 'success'}
                  className="px-1.5 py-0 text-[10px]"
                >
                  {unpaidStudentsPercent}%
                </Badge>
              </div>
              <p className="text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400 tabular-nums">
                {paymentStats.unpaidStudentsCount.toLocaleString('en-US')}{' '}
                <span className="text-sm font-bold text-rose-700/80 dark:text-rose-300/80">
                  طالب لم يسدد
                </span>
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5 space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-rose-500/15">
              <div
                className="h-full rounded-full bg-rose-500 transition-all duration-500"
                style={{ width: `${unpaidStudentsPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="truncate">
                متأخرات: <strong className="text-rose-600 dark:text-rose-400">{formatCurrency(data.totalReceivables)}</strong>
              </span>
              <Link
                to={`/finance?tab=student-billing&yearMonth=${data.yearMonth}`}
                className="font-bold text-primary hover:underline shrink-0"
              >
                تحصيل
              </Link>
            </div>
          </div>
        </Card>

        {/* 3. المجموعات اللي دفعت */}
        <Card className="border-primary/25 bg-primary/[0.03] p-4 transition-all hover:border-primary/45 hover:shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-primary">
                  المجموعات اللي دفعت
                </span>
                <Badge variant="info" className="px-1.5 py-0 text-[10px]">
                  {paidGroupsPercent}%
                </Badge>
              </div>
              <p className="text-2xl font-black tracking-tight text-primary tabular-nums">
                {paymentStats.paidGroupsCount.toLocaleString('en-US')}{' '}
                <span className="text-sm font-bold text-primary/80">
                  مجموعة مسددة
                </span>
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5 space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary/15">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${paidGroupsPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="truncate">
                مكتملة من <strong className="text-foreground">{paymentStats.totalBilledGroupsCount.toLocaleString('en-US')}</strong> مجموعة
              </span>
              <Link
                to="/groups"
                className="font-bold text-primary hover:underline shrink-0"
              >
                المجموعات
              </Link>
            </div>
          </div>
        </Card>

        {/* 4. المجموعات اللي مدفعتش */}
        <Card className="border-amber-500/25 bg-amber-500/[0.03] p-4 transition-all hover:border-amber-500/45 hover:shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                  المجموعات اللي مدفعتش
                </span>
                <Badge
                  variant={paymentStats.unpaidGroupsCount > 0 ? 'warning' : 'success'}
                  className="px-1.5 py-0 text-[10px]"
                >
                  {unpaidGroupsPercent}%
                </Badge>
              </div>
              <p className="text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
                {paymentStats.unpaidGroupsCount.toLocaleString('en-US')}{' '}
                <span className="text-sm font-bold text-amber-700/80 dark:text-amber-300/80">
                  مجموعة متبقية
                </span>
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Layers className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5 space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-amber-500/15">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-500"
                style={{ width: `${unpaidGroupsPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="truncate">بها متأخرات تحصيل</span>
              <Link
                to={`/finance?tab=student-billing&yearMonth=${data.yearMonth}`}
                className="font-bold text-primary hover:underline shrink-0"
              >
                متابعة
              </Link>
            </div>
          </div>
        </Card>
      </div>

      {/* شريط خلاصة رفيع للتشغيل اليومي وصافي الربح (الأرباح تظهر لحاملي صلاحية أرباح السنتر فقط) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/70 px-4 py-2.5 text-xs">
        {canViewFullFinance ? (
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Banknote className="h-3.5 w-3.5 text-primary" />
              <span>صافي السنتر للشهر:</span>
              <strong
                className={`font-black tabular-nums ${
                  isProfitable ? 'text-primary' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatCurrency(data.netCenterResult)}
              </strong>
              <Badge variant={isProfitable ? 'success' : 'danger'} className="px-1.5 py-0 text-[10px]">
                {isProfitable ? 'فائض' : 'عجز'}
              </Badge>
            </span>

            <span className="hidden sm:inline text-border">|</span>

            <span className="text-muted-foreground">
              إجمالي مستحقات الشهر:{' '}
              <strong className="font-bold text-foreground tabular-nums">
                {formatCurrency(data.totalRevenue)}
              </strong>
            </span>

            <span className="hidden sm:inline text-border">|</span>

            <span className="text-muted-foreground">
              مستحقات المدرسين:{' '}
              <strong className="font-bold text-violet-700 dark:text-violet-300 tabular-nums">
                {formatCurrency(data.totalTeacherDues)}
              </strong>
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Banknote className="h-3.5 w-3.5 text-emerald-600" />
              <span>إجمالي التحصيل للشهر:</span>
              <strong className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatCurrency(data.totalCollectedPayments)}
              </strong>
            </span>
            <span className="hidden sm:inline text-border">|</span>
            <span className="text-muted-foreground">
              متأخرات الطلاب:{' '}
              <strong className="font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                {formatCurrency(data.totalReceivables)}
              </strong>
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <span className="text-muted-foreground">
            حصص اليوم:{' '}
            <strong className="font-bold text-foreground tabular-nums">
              {data.todaySessionsCount} حصة
            </strong>
            {totalMarkedToday > 0 && ` (${data.todayAttendance.present} حاضر)`}
          </span>

          {canViewClassrooms && (
            <>
              <span className="hidden sm:inline text-border">|</span>
              <span className="text-muted-foreground">
                القاعات المتاحة الآن:{' '}
                <strong className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {data.classroomsSummary.availableNow} من {data.classroomsSummary.total}
                </strong>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
