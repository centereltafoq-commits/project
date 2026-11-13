import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Banknote,
  Building2,
  CalendarCheck2,
  CalendarClock,
  CheckCircle2,
  GraduationCap,
  Layers,
  UserCheck,
} from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { Badge, Card } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { formatCurrency } from '@/lib/formatters';
import { DashboardSummaryData } from '../dashboard.types';

interface DashboardHeroKpisProps {
  data: DashboardSummaryData;
}

export function DashboardHeroKpis({ data }: DashboardHeroKpisProps) {
  const { hasPermission } = useAuth();
  const canViewFinance = hasPermission(PERMISSIONS.FINANCE_VIEW);
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

  const paidRate = stats.collectionRateSessions;
  const unpaidRate = stats.totalBillableSessions > 0 ? Math.max(0, 100 - paidRate) : 0;

  const teacherPaid = data.totalTeacherPaidOut ?? 0;
  const teacherRemaining = Math.max(0, data.totalTeacherDues - teacherPaid);

  const totalMarkedToday =
    data.todayAttendance.present +
    data.todayAttendance.absent +
    data.todayAttendance.excused;

  const isProfitable = data.netCenterResult >= 0;

  // عرض غير مالي للموظفين بدون صلاحية FINANCE_VIEW
  if (!canViewFinance) {
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

  return (
    <div className="space-y-3">
      {/* الصف الرئيسي: 4 مؤشرات أساسية للمحاسبة بالحصة وفلوس المدرسين */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1. إجمالي عدد الحصص */}
        <Card className="p-4 transition-all hover:border-primary/40 hover:shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <span className="text-xs font-semibold text-muted-foreground block">
                إجمالي عدد الحصص (المستحقة)
              </span>
              <p className="text-2xl font-black tracking-tight text-foreground tabular-nums">
                {stats.totalBillableSessions}{' '}
                <span className="text-sm font-bold text-muted-foreground">حصة</span>
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <CalendarCheck2 className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
            <span className="truncate">
              حصص المجموعات: <strong className="text-foreground">{stats.executedSessions}</strong> منفذة من{' '}
              {stats.totalSessions}
            </span>
            {canAccessAttendance && (
              <Link to="/attendance" className="font-bold text-primary hover:underline shrink-0">
                الحضور
              </Link>
            )}
          </div>
        </Card>

        {/* 2. الحصص اللي اتدفعت */}
        <Card className="border-emerald-500/25 bg-emerald-500/[0.03] p-4 transition-all hover:border-emerald-500/45 hover:shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  الحصص اللي اتدفعت
                </span>
                <Badge variant="success" className="px-1.5 py-0 text-[10px]">
                  {paidRate}%
                </Badge>
              </div>
              <p className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
                {stats.totalPaidSessions}{' '}
                <span className="text-sm font-bold text-emerald-700/80 dark:text-emerald-300/80">
                  حصة مسددة
                </span>
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2.5 space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-emerald-500/15">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${paidRate}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="truncate">
                المحصّل: <strong className="text-foreground">{formatCurrency(data.totalCollectedPayments)}</strong>
              </span>
              <Link
                to="/finance?tab=payments-history"
                className="font-bold text-primary hover:underline shrink-0"
              >
                الإيصالات
              </Link>
            </div>
          </div>
        </Card>

        {/* 3. الحصص اللي مدفعتش */}
        <Card className="border-rose-500/25 bg-rose-500/[0.03] p-4 transition-all hover:border-rose-500/45 hover:shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-rose-800 dark:text-rose-300">
                  الحصص اللي مدفعتش
                </span>
                <Badge
                  variant={stats.totalUnpaidSessions > 0 ? 'danger' : 'success'}
                  className="px-1.5 py-0 text-[10px]"
                >
                  {unpaidRate}%
                </Badge>
              </div>
              <p className="text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400 tabular-nums">
                {stats.totalUnpaidSessions}{' '}
                <span className="text-sm font-bold text-rose-700/80 dark:text-rose-300/80">
                  حصة معلقة
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
                style={{ width: `${unpaidRate}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="truncate">
                متأخرات: <strong className="text-rose-600 dark:text-rose-400">{formatCurrency(data.totalReceivables)}</strong>
              </span>
              <Link
                to="/finance?tab=student-billing"
                className="font-bold text-primary hover:underline shrink-0"
              >
                تحصيل
              </Link>
            </div>
          </div>
        </Card>

        {/* 4. إجمالي فلوس المدرسين */}
        <Card className="border-violet-500/25 bg-violet-500/[0.03] p-4 transition-all hover:border-violet-500/45 hover:shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <span className="text-xs font-semibold text-violet-800 dark:text-violet-300 block">
                إجمالي فلوس المدرسين
              </span>
              <p className="text-2xl font-black tracking-tight text-violet-700 dark:text-violet-300 tabular-nums truncate">
                {formatCurrency(data.totalTeacherDues)}
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400">
              <UserCheck className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
            <span className="truncate">
              صُرف: <strong className="text-foreground">{formatCurrency(teacherPaid)}</strong> • باقي:{' '}
              <strong className="text-amber-600 dark:text-amber-400">{formatCurrency(teacherRemaining)}</strong>
            </span>
            <Link
              to="/finance?tab=teacher-dues"
              className="font-bold text-primary hover:underline shrink-0"
            >
              الصرف
            </Link>
          </div>
        </Card>
      </div>

      {/* شريط خلاصة رفيع للتشغيل اليومي وصافي الربح بدون استهلاك مساحة */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/70 px-4 py-2.5 text-xs">
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
            المستهدف من الحصص:{' '}
            <strong className="font-bold text-foreground tabular-nums">
              {formatCurrency(data.totalRevenue)}
            </strong>
          </span>
        </div>

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
