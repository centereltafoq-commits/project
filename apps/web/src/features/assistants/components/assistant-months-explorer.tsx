import * as React from 'react';
import {
  AlertCircle,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  Clock,
  Lock,
} from 'lucide-react';
import { Badge, Card } from '@/design-system';
import { YearSummaryGrid } from '@/components/year-summary/year-summary-grid';
import {
  ExplorerViewMode,
  YearSummaryHeader,
} from '@/components/year-summary/year-summary-header';
import { PAYOUT_YEAR_SUMMARY_LABELS } from '@/components/year-summary/year-summary.types';
import {
  formatCurrency,
  formatYearMonthAr,
  getCurrentYearMonth,
} from '@/lib/formatters';
import {
  ASSISTANT_PAYOUT_STATUS_META,
  AssistantMonthOverviewItem,
  AssistantProfileData,
} from '../assistants.types';
import { AssistantMonthlyDuesTab } from '../assistant-profile-tabs';
import { buildAssistantYearSummary } from './assistant-year-grid.helper';

type MonthFilterMode = 'ALL' | 'PAID' | 'UNPAID_OR_PARTIAL';

interface AssistantMonthsExplorerProps {
  data: AssistantProfileData;
  selectedYearMonth: string;
  onSelectMonth: (yearMonth: string) => void;
  canViewFinance: boolean;
}

export function AssistantMonthsExplorer({
  data,
  selectedYearMonth,
  onSelectMonth,
  canViewFinance,
}: AssistantMonthsExplorerProps) {
  const [filterMode, setFilterMode] = React.useState<MonthFilterMode>('ALL');
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

  const monthsOverview: AssistantMonthOverviewItem[] = React.useMemo(() => {
    if (data.monthsOverview && data.monthsOverview.length > 0) {
      return data.monthsOverview;
    }
    const { monthlyBreakdown } = data;
    const payoutStatus: AssistantMonthOverviewItem['payoutStatus'] =
      monthlyBreakdown.totalDues <= 0.009
        ? 'NO_DUES'
        : monthlyBreakdown.remainingBalance <= 0.009
          ? 'PAID'
          : monthlyBreakdown.totalPayouts > 0.009
            ? 'PARTIAL'
            : 'UNPAID';

    return [
      {
        yearMonth: data.yearMonth,
        payoutStatus,
        groupsCount: data.linkedGroups.length,
        executedSessionsCount: monthlyBreakdown.groupDues.reduce(
          (sum, g) => sum + Number(g.sessionsCount || 0),
          0,
        ),
        totalDues: monthlyBreakdown.totalDues,
        totalPayouts: monthlyBreakdown.totalPayouts,
        remainingBalance: monthlyBreakdown.remainingBalance,
        payoutsCount: data.payouts.filter((p) => p.yearMonth === data.yearMonth).length,
        isClosed: monthlyBreakdown.isClosed,
      },
    ];
  }, [data]);

  const filteredMonths = React.useMemo(() => {
    if (filterMode === 'PAID') {
      return monthsOverview.filter((m) => m.payoutStatus === 'PAID');
    }
    if (filterMode === 'UNPAID_OR_PARTIAL') {
      return monthsOverview.filter(
        (m) => m.payoutStatus === 'UNPAID' || m.payoutStatus === 'PARTIAL',
      );
    }
    return monthsOverview;
  }, [monthsOverview, filterMode]);

  const yearSummary = React.useMemo(
    () =>
      buildAssistantYearSummary({
        year: selectedYear,
        data,
        monthsList: monthsOverview,
        selectedYearMonth,
        currentYearMonth,
      }),
    [selectedYear, data, monthsOverview, selectedYearMonth, currentYearMonth],
  );

  const counts = React.useMemo(
    () => ({
      all: monthsOverview.length,
      paid: monthsOverview.filter((m) => m.payoutStatus === 'PAID').length,
      due: monthsOverview.filter(
        (m) => m.payoutStatus === 'UNPAID' || m.payoutStatus === 'PARTIAL',
      ).length,
      totalRemaining: monthsOverview.reduce((sum, m) => sum + m.remainingBalance, 0),
    }),
    [monthsOverview],
  );

  return (
    <div className="space-y-6">
      <YearSummaryHeader
        title="خريطة شهور المساعد (المستحقات والصرف شهر بشهر)"
        subtitle="استعرض السنة كاملة بنظرة سريعة (تم الصرف / لم يُصرف / لم يكن موجوداً) أو انتقل لعرض تفاصيل كل شهر على حدة"
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        monthsCount={monthsOverview.length}
      />

      {viewMode === 'YEAR_SUMMARY' ? (
        <YearSummaryGrid
          summary={yearSummary}
          selectedYearMonth={selectedYearMonth}
          canViewFinance={canViewFinance}
          onChangeYear={setSelectedYear}
          onSelectMonth={onSelectMonth}
          labels={PAYOUT_YEAR_SUMMARY_LABELS}
        />
      ) : (
        <>
          <Card className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm font-black text-foreground">
                <CalendarRange className="h-4 w-4 text-primary" />
                <span>تصفية شهور المساعد</span>
              </div>

              {canViewFinance && counts.totalRemaining > 0 && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-extrabold text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>إجمالي المتبقي عبر الشهور: {formatCurrency(counts.totalRemaining)}</span>
                </div>
              )}
            </div>

            {canViewFinance && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFilterMode('ALL')}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                    filterMode === 'ALL'
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  كل الشهور ({counts.all})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('PAID')}
                  className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                    filterMode === 'PAID'
                      ? 'border-emerald-600 bg-emerald-600 text-white'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  تم الصرف بالكامل ({counts.paid})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('UNPAID_OR_PARTIAL')}
                  className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                    filterMode === 'UNPAID_OR_PARTIAL'
                      ? 'border-rose-600 bg-rose-600 text-white'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  غير مصروف / صرف جزئي ({counts.due})
                </button>
              </div>
            )}
          </Card>

          {filteredMonths.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              لا توجد شهور تطابق التصفية المحددة.
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMonths.map((item) => {
                const isSelected = item.yearMonth === selectedYearMonth;
                const statusMeta = ASSISTANT_PAYOUT_STATUS_META[item.payoutStatus];

                return (
                  <button
                    key={item.yearMonth}
                    type="button"
                    onClick={() => onSelectMonth(item.yearMonth)}
                    className={`group flex flex-col justify-between rounded-xl border bg-card p-4 text-right transition-all hover:shadow-md ${
                      isSelected ? statusMeta.activeRingClass : statusMeta.cardBorderClass
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-black text-foreground">
                            {formatYearMonthAr(item.yearMonth)}
                          </p>
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {item.yearMonth}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {isSelected && (
                            <Badge variant="info" className="whitespace-nowrap">
                              معروض الآن
                            </Badge>
                          )}
                          {item.isClosed && (
                            <Badge
                              variant="neutral"
                              className="inline-flex items-center gap-0.5 whitespace-nowrap"
                            >
                              <Lock className="h-3 w-3" />
                              مقفل
                            </Badge>
                          )}
                          {canViewFinance && (
                            <Badge variant={statusMeta.badgeVariant} className="whitespace-nowrap">
                              {statusMeta.label}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <BookOpen className="h-3.5 w-3.5 text-primary" />
                          <span>{item.groupsCount} مجموعات</span>
                        </span>
                        <span className="font-bold text-foreground">
                          {item.executedSessionsCount} حصة منفذة
                        </span>
                      </div>
                    </div>

                    {canViewFinance && (
                      <div className="mt-3 grid grid-cols-3 gap-1 border-t border-border/70 pt-2.5 text-[11px]">
                        <div>
                          <p className="text-muted-foreground">المستحق</p>
                          <p className="font-bold text-foreground">
                            {formatCurrency(item.totalDues)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">المنصرف</p>
                          <p className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(item.totalPayouts)}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">المتبقي</p>
                          <p
                            className={`font-extrabold ${
                              item.remainingBalance > 0.009
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {formatCurrency(item.remainingBalance)}
                          </p>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {canViewFinance && <AssistantMonthlyDuesTab data={data} />}
    </div>
  );
}
