import * as React from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Sparkles,
  UserCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Badge, Card } from '@/design-system';
import { formatCurrency, formatYearMonthAr } from '@/lib/formatters';
import { StudentMonthOverviewItem, StudentProfileData } from '../students.types';
import { StudentSelectedMonthDetails } from './student-selected-month-details';

type MonthFilterType = 'ALL' | 'PAID' | 'UNPAID_OR_PARTIAL';

const PAYMENT_STATUS_META: Record<
  StudentMonthOverviewItem['paymentStatus'],
  {
    label: string;
    badgeVariant: 'success' | 'warning' | 'danger' | 'neutral';
    cardBorderClass: string;
    activeRingClass: string;
  }
> = {
  PAID: {
    label: 'مدفوع بالكامل',
    badgeVariant: 'success',
    cardBorderClass: 'border-emerald-500/35 hover:border-emerald-500/70',
    activeRingClass: 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-500/5',
  },
  PARTIAL: {
    label: 'مدفوع جزئياً',
    badgeVariant: 'warning',
    cardBorderClass: 'border-amber-500/40 hover:border-amber-500/80',
    activeRingClass: 'ring-2 ring-amber-500 border-amber-500 bg-amber-500/5',
  },
  UNPAID: {
    label: 'غير مدفوع',
    badgeVariant: 'danger',
    cardBorderClass: 'border-rose-500/40 hover:border-rose-500/80',
    activeRingClass: 'ring-2 ring-rose-500 border-rose-500 bg-rose-500/5',
  },
  NO_DUES: {
    label: 'لا توجد مستحقات',
    badgeVariant: 'neutral',
    cardBorderClass: 'border-border hover:border-primary/40',
    activeRingClass: 'ring-2 ring-primary border-primary bg-primary/5',
  },
};

interface StudentMonthsExplorerProps {
  data: StudentProfileData;
  selectedYearMonth: string;
  onSelectMonth: (yearMonth: string) => void;
  canViewFinance: boolean;
}

export function StudentMonthsExplorer({
  data,
  selectedYearMonth,
  onSelectMonth,
  canViewFinance,
}: StudentMonthsExplorerProps) {
  const [filter, setFilter] = React.useState<MonthFilterType>('ALL');

  const monthsList: StudentMonthOverviewItem[] = React.useMemo(() => {
    if (data.monthsOverview && data.monthsOverview.length > 0) {
      return data.monthsOverview;
    }
    const { monthTotals } = data;
    const fallbackStatus: StudentMonthOverviewItem['paymentStatus'] =
      monthTotals.totalDue <= 0.009
        ? 'NO_DUES'
        : monthTotals.remaining <= 0.009
          ? 'PAID'
          : monthTotals.totalPaid > 0.009
            ? 'PARTIAL'
            : 'UNPAID';

    return [
      {
        yearMonth: data.yearMonth,
        paymentStatus: fallbackStatus,
        totalSessions: monthTotals.totalSessions,
        presentCount: monthTotals.presentCount,
        absentCount: monthTotals.absentCount,
        excusedCount: monthTotals.excusedCount,
        totalDue: monthTotals.totalDue,
        totalPaid: monthTotals.totalPaid,
        remaining: monthTotals.remaining,
        groupsCount: data.monthlyBreakdown.length,
        paymentsCount: data.payments.filter((p) => p.yearMonth === data.yearMonth).length,
        isClosed:
          data.monthlyBreakdown.length > 0 &&
          data.monthlyBreakdown.every((g) => g.isClosed),
      },
    ];
  }, [data]);

  const summary = React.useMemo(() => {
    let paidCount = 0;
    let partialCount = 0;
    let unpaidCount = 0;
    let totalRemainingAllMonths = 0;

    for (const m of monthsList) {
      if (m.paymentStatus === 'PAID') paidCount += 1;
      else if (m.paymentStatus === 'PARTIAL') partialCount += 1;
      else if (m.paymentStatus === 'UNPAID') unpaidCount += 1;
      totalRemainingAllMonths += m.remaining;
    }

    return {
      paidCount,
      partialCount,
      unpaidCount,
      totalRemainingAllMonths,
    };
  }, [monthsList]);

  const filteredMonths = React.useMemo(() => {
    if (filter === 'PAID') {
      return monthsList.filter((m) => m.paymentStatus === 'PAID');
    }
    if (filter === 'UNPAID_OR_PARTIAL') {
      return monthsList.filter(
        (m) => m.paymentStatus === 'UNPAID' || m.paymentStatus === 'PARTIAL',
      );
    }
    return monthsList;
  }, [monthsList, filter]);

  return (
    <div className="space-y-6">
      {/* شريط الملخص السريع والفلاتر لكل شهور الطالب */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-base font-black text-foreground">
              <Calendar className="h-5 w-5 text-primary" />
              خريطة شهور الطالب (الدفع والحضور شهر بشهر)
            </h3>
            <p className="text-xs text-muted-foreground">
              اضغط على أي شهر من الشهور بالأسفل لعرض كافة تفاصيله (الحصص التي حضرها، الغياب، المجموعات، وإيصالات السداد)
            </p>
          </div>

          {canViewFinance && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                شهور مسددة بالكامل: {summary.paidCount}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-amber-700 dark:text-amber-400">
                <Clock className="h-4 w-4" />
                مسددة جزئياً: {summary.partialCount}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-rose-700 dark:text-rose-400">
                <AlertCircle className="h-4 w-4" />
                غير مسددة: {summary.unpaidCount}
                {summary.totalRemainingAllMonths > 0 && (
                  <span className="mr-1 rounded-md bg-rose-500/20 px-1.5 py-0.5 font-extrabold">
                    إجمالي المتبقي: {formatCurrency(summary.totalRemainingAllMonths)}
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* أزرار الفلترة */}
        {canViewFinance && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              تصفية الشهور:
            </span>
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                filter === 'ALL'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              كل الشهور ({monthsList.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('PAID')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                filter === 'PAID'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              مدفوع بالكامل ({summary.paidCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('UNPAID_OR_PARTIAL')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                filter === 'UNPAID_OR_PARTIAL'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              غير مدفوع / متأخرات ({summary.unpaidCount + summary.partialCount})
            </button>
          </div>
        )}
      </Card>

      {/* شبكة بطاقات الشهور المنظمة */}
      {filteredMonths.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          لا توجد شهور مطابقة لفلتر العرض المحدد حالياً.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredMonths.map((item) => {
            const isSelected = item.yearMonth === selectedYearMonth;
            const meta = PAYMENT_STATUS_META[item.paymentStatus] ?? PAYMENT_STATUS_META.NO_DUES;

            return (
              <button
                key={item.yearMonth}
                type="button"
                onClick={() => onSelectMonth(item.yearMonth)}
                className={`group relative flex flex-col justify-between rounded-2xl border bg-card p-4 text-right transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${
                  isSelected ? meta.activeRingClass : meta.cardBorderClass
                }`}
              >
                {/* رأس بطاقة الشهر */}
                <div className="flex w-full items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-black text-foreground group-hover:text-primary">
                        {formatYearMonthAr(item.yearMonth)}
                      </span>
                      {isSelected && (
                        <span className="inline-flex items-center gap-0.5 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                          <Sparkles className="h-2.5 w-2.5" />
                          معروض الآن
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                      {item.yearMonth} • {item.groupsCount} مجموعة
                    </span>
                  </div>

                  {canViewFinance && (
                    <Badge variant={meta.badgeVariant}>{meta.label}</Badge>
                  )}
                </div>

                {/* إحصائيات الحضور في هذا الشهر */}
                <div className="mt-3.5 rounded-xl border border-border/70 bg-muted/35 p-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 font-bold text-foreground">
                      <UserCheck className="h-3.5 w-3.5 text-primary" />
                      الحضور في الشهر:
                    </span>
                    <span className="font-extrabold text-primary">
                      حضر {item.presentCount} من {item.totalSessions} حصة
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-400">
                      حضور: {item.presentCount}
                    </span>
                    <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-rose-700 dark:text-rose-400">
                      غياب: {item.absentCount}
                    </span>
                    {item.excusedCount > 0 && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-400">
                        بعذر: {item.excusedCount}
                      </span>
                    )}
                  </div>
                </div>

                {/* الملخص المالي للشهر */}
                {canViewFinance && (
                  <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-border pt-2.5 text-center text-xs">
                    <div className="rounded-lg bg-muted/40 p-1.5">
                      <span className="block text-[10px] text-muted-foreground">المطلوب</span>
                      <span className="font-extrabold text-foreground">
                        {formatCurrency(item.totalDue)}
                      </span>
                    </div>
                    <div className="rounded-lg bg-emerald-500/10 p-1.5">
                      <span className="block text-[10px] text-emerald-700 dark:text-emerald-400">
                        المدفوع
                      </span>
                      <span className="font-extrabold text-emerald-600">
                        {formatCurrency(item.totalPaid)}
                      </span>
                    </div>
                    <div
                      className={`rounded-lg p-1.5 ${
                        item.remaining > 0.009 ? 'bg-rose-500/10' : 'bg-muted/40'
                      }`}
                    >
                      <span
                        className={`block text-[10px] ${
                          item.remaining > 0.009
                            ? 'text-rose-700 dark:text-rose-400'
                            : 'text-muted-foreground'
                        }`}
                      >
                        المتبقي
                      </span>
                      <span
                        className={`font-extrabold ${
                          item.remaining > 0.009 ? 'text-rose-600' : 'text-muted-foreground'
                        }`}
                      >
                        {formatCurrency(item.remaining)}
                      </span>
                    </div>
                  </div>
                )}

                {!canViewFinance && (
                  <div className="mt-3 flex items-center justify-end border-t border-border pt-2 text-[11px] font-bold text-primary">
                    <span>اضغط لعرض تفاصيل الحصص</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* لوحة التفاصيل الشاملة للشهر المختار */}
      <StudentSelectedMonthDetails data={data} canViewFinance={canViewFinance} />
    </div>
  );
}
