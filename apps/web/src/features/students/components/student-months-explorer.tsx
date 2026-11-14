import * as React from 'react';
import {
  Calendar,
  CalendarDays,
  Filter,
  LayoutGrid,
  Lock,
  UserCheck,
} from 'lucide-react';
import { Badge, Card } from '@/design-system';
import {
  formatCurrency,
  formatYearMonthAr,
  getCurrentYearMonth,
} from '@/lib/formatters';
import {
  StudentMonthOverviewItem,
  StudentMonthlyBreakdownItem,
  StudentProfileData,
} from '../students.types';
import { StudentSelectedMonthDetails } from './student-selected-month-details';
import { buildStudentYearSummary } from './student-year-grid.helper';
import { StudentYearSummaryGrid } from './student-year-summary-grid';

type MonthFilterType = 'ALL' | 'PAID' | 'UNPAID_OR_PARTIAL';
type ExplorerViewMode = 'YEAR_SUMMARY' | 'MONTHLY_CARDS';

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
  canCollectPayment?: boolean;
  onCollectMonthPayment?: (groupItem?: StudentMonthlyBreakdownItem) => void;
}

export function StudentMonthsExplorer({
  data,
  selectedYearMonth,
  onSelectMonth,
  canViewFinance,
  canCollectPayment = false,
  onCollectMonthPayment,
}: StudentMonthsExplorerProps) {
  const [filter, setFilter] = React.useState<MonthFilterType>('ALL');
  const [viewMode, setViewMode] = React.useState<ExplorerViewMode>('YEAR_SUMMARY');
  const currentYearMonth = React.useMemo(() => getCurrentYearMonth(), []);
  const [selectedYear, setSelectedYear] = React.useState<number>(() => {
    const parsed = Number(selectedYearMonth.slice(0, 4));
    return Number.isInteger(parsed) && parsed > 0 ? parsed : new Date().getFullYear();
  });

  React.useEffect(() => {
    const parsed = Number(selectedYearMonth.slice(0, 4));
    if (Number.isInteger(parsed) && parsed > 0) {
      setSelectedYear(parsed);
    }
  }, [selectedYearMonth]);

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

  const yearSummary = React.useMemo(
    () =>
      buildStudentYearSummary({
        year: selectedYear,
        data,
        monthsList,
        selectedYearMonth,
        currentYearMonth,
      }),
    [selectedYear, data, monthsList, selectedYearMonth, currentYearMonth],
  );

  return (
    <div className="space-y-6">
      {/* شريط الملخص السريع والتبديل بين عرض السنة كاملة والبطاقات التفصيلية */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-base font-black text-foreground">
              <Calendar className="h-5 w-5 text-primary" />
              خريطة شهور الطالب (الدفع والحضور شهر بشهر)
            </h3>
            <p className="text-xs text-muted-foreground">
              استعرض السنة كاملة بنظرة سريعة (مدفوع / غير مدفوع / لم يكن موجوداً) أو انتقل لعرض تفاصيل كل شهر على حدة
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setViewMode('YEAR_SUMMARY')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                viewMode === 'YEAR_SUMMARY'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              السنة كاملة (12 شهر)
            </button>
            <button
              type="button"
              onClick={() => setViewMode('MONTHLY_CARDS')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                viewMode === 'MONTHLY_CARDS'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              تفاصيل الشهور ({monthsList.length})
            </button>
          </div>
        </div>

        {/* أزرار الفلترة لوضع تفاصيل الشهور */}
        {viewMode === 'MONTHLY_CARDS' && canViewFinance && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-2">
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

            {summary.totalRemainingAllMonths > 0.009 && (
              <span className="rounded-lg bg-rose-500/15 px-2.5 py-1 text-xs font-extrabold text-rose-700 dark:text-rose-400">
                إجمالي المتبقي: {formatCurrency(summary.totalRemainingAllMonths)}
              </span>
            )}
          </div>
        )}
      </Card>

      {viewMode === 'YEAR_SUMMARY' ? (
        <StudentYearSummaryGrid
          summary={yearSummary}
          selectedYearMonth={selectedYearMonth}
          canViewFinance={canViewFinance}
          onChangeYear={setSelectedYear}
          onSelectMonth={onSelectMonth}
        />
      ) : filteredMonths.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          لا توجد شهور مطابقة لفلتر العرض المحدد حالياً.
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                <div className="flex w-full items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="whitespace-nowrap text-base font-black text-foreground group-hover:text-primary">
                        {formatYearMonthAr(item.yearMonth)}
                      </span>
                      {item.isClosed && (
                        <span
                          title="شهر مقفل مالياً"
                          className="inline-flex items-center gap-0.5 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground"
                        >
                          <Lock className="h-2.5 w-2.5" />
                          مقفل
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <span className="font-mono">{item.yearMonth}</span>
                      <span>•</span>
                      <span className="whitespace-nowrap">{item.groupsCount} مجموعة</span>
                    </div>
                  </div>

                  {canViewFinance && (
                    <Badge variant={meta.badgeVariant} className="shrink-0 whitespace-nowrap">
                      {meta.label}
                    </Badge>
                  )}
                </div>

                {/* إحصائيات الحضور في هذا الشهر */}
                <div className="mt-3.5 space-y-2 rounded-xl border border-border/70 bg-muted/35 p-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 whitespace-nowrap font-bold text-foreground">
                      <UserCheck className="h-3.5 w-3.5 text-primary" />
                      الحضور في الشهر
                    </span>
                    <span className="whitespace-nowrap font-extrabold text-primary">
                      {item.presentCount} / {item.totalSessions} حصة
                    </span>
                  </div>

                  <div
                    className={`grid gap-1.5 text-center text-[11px] font-bold ${
                      item.excusedCount > 0 ? 'grid-cols-3' : 'grid-cols-2'
                    }`}
                  >
                    <div className="rounded-lg bg-emerald-500/15 px-2 py-1 text-emerald-700 dark:text-emerald-400">
                      حضور: {item.presentCount}
                    </div>
                    <div className="rounded-lg bg-rose-500/15 px-2 py-1 text-rose-700 dark:text-rose-400">
                      غياب: {item.absentCount}
                    </div>
                    {item.excusedCount > 0 && (
                      <div className="rounded-lg bg-amber-500/15 px-2 py-1 text-amber-700 dark:text-amber-400">
                        بعذر: {item.excusedCount}
                      </div>
                    )}
                  </div>
                </div>

                {/* الملخص المالي للشهر */}
                {canViewFinance ? (
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center text-xs">
                    <div className="rounded-lg bg-muted/40 px-1.5 py-2">
                      <span className="block text-[10px] font-semibold text-muted-foreground">
                        المطلوب
                      </span>
                      <span className="mt-0.5 block font-extrabold text-foreground">
                        {formatCurrency(item.totalDue)}
                      </span>
                    </div>
                    <div className="rounded-lg bg-emerald-500/10 px-1.5 py-2">
                      <span className="block text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                        المدفوع
                      </span>
                      <span className="mt-0.5 block font-extrabold text-emerald-600">
                        {formatCurrency(item.totalPaid)}
                      </span>
                    </div>
                    <div
                      className={`rounded-lg px-1.5 py-2 ${
                        item.remaining > 0.009 ? 'bg-rose-500/10' : 'bg-muted/40'
                      }`}
                    >
                      <span
                        className={`block text-[10px] font-semibold ${
                          item.remaining > 0.009
                            ? 'text-rose-700 dark:text-rose-400'
                            : 'text-muted-foreground'
                        }`}
                      >
                        المتبقي
                      </span>
                      <span
                        className={`mt-0.5 block font-extrabold ${
                          item.remaining > 0.009 ? 'text-rose-600' : 'text-muted-foreground'
                        }`}
                      >
                        {formatCurrency(item.remaining)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-center justify-end border-t border-border pt-2.5 text-[11px] font-bold text-primary">
                    <span>اضغط لعرض تفاصيل الحصص</span>
                  </div>
                )}

                {isSelected && (
                  <div className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 py-1 text-[11px] font-extrabold text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>معروض الآن بالأسفل</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* لوحة التفاصيل الشاملة للشهر المختار */}
      <StudentSelectedMonthDetails
        data={data}
        canViewFinance={canViewFinance}
        canCollectPayment={canCollectPayment}
        onCollectMonthPayment={onCollectMonthPayment}
      />
    </div>
  );
}
