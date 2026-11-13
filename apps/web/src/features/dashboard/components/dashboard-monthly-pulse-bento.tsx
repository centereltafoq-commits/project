import { CalendarCheck2, CheckCircle2 } from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { formatYearMonthAr } from '@/lib/formatters';
import { DashboardSummaryData } from '../dashboard.types';

interface DashboardMonthlyPulseBentoProps {
  data: DashboardSummaryData;
}

export function DashboardMonthlyPulseBento({ data }: DashboardMonthlyPulseBentoProps) {
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

  const { present, absent, excused } = data.todayAttendance;
  const totalMarkedToday = present + absent + excused;
  const todayPresentPct =
    totalMarkedToday > 0 ? Math.round((present / totalMarkedToday) * 100) : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
            <CalendarCheck2 className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm">نبض الحضور والشهر ({formatYearMonthAr(data.yearMonth)})</CardTitle>
          </div>
        </div>
        {canViewFinance && (
          <Badge
            variant={
              stats.collectionRateSessions >= 75
                ? 'success'
                : stats.collectionRateSessions >= 40
                  ? 'warning'
                  : 'neutral'
            }
            className="text-[10px]"
          >
            سداد الحصص: {stats.collectionRateSessions}%
          </Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-4 pt-3.5">
        {/* 1. التزام حضور اليوم */}
        <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-foreground">رصد حضور اليوم</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {totalMarkedToday > 0 ? `${todayPresentPct}% التزام` : 'لم يبدأ الرصد'}
            </span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            {totalMarkedToday > 0 && (
              <>
                <div
                  className="bg-emerald-500 transition-all"
                  style={{ width: `${(present / totalMarkedToday) * 100}%` }}
                />
                <div
                  className="bg-amber-400 transition-all"
                  style={{ width: `${(excused / totalMarkedToday) * 100}%` }}
                />
                <div
                  className="bg-rose-500 transition-all"
                  style={{ width: `${(absent / totalMarkedToday) * 100}%` }}
                />
              </>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
            <span className="text-emerald-700 dark:text-emerald-300 font-semibold">حاضر: {present}</span>
            <span className="text-amber-700 dark:text-amber-300 font-semibold">بعذر: {excused}</span>
            <span className="text-rose-700 dark:text-rose-300 font-semibold">غائب: {absent}</span>
          </div>
        </div>

        {/* 2. حركة حصص الشهر */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-lg border border-border bg-card p-2.5">
            <span className="text-[11px] text-muted-foreground block">الحصص المنفذة</span>
            <p className="mt-0.5 text-lg font-black text-foreground tabular-nums">
              {stats.executedSessions}
              <span className="mr-1 text-[11px] font-medium text-muted-foreground">
                / {stats.totalSessions}
              </span>
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-2.5">
            <span className="text-[11px] text-muted-foreground block">الحصص القادمة</span>
            <p className="mt-0.5 text-lg font-black text-sky-600 dark:text-sky-400 tabular-nums">
              {stats.scheduledSessions}
            </p>
          </div>

          {canViewFinance && (
            <>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                    حصص مسددة
                  </span>
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                </div>
                <p className="mt-0.5 text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {stats.totalPaidSessions}
                </p>
              </div>
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-2.5">
                <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-300 block">
                  حصص غير مسددة
                </span>
                <p className="mt-0.5 text-lg font-black text-rose-600 dark:text-rose-400 tabular-nums">
                  {stats.totalUnpaidSessions}
                </p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

