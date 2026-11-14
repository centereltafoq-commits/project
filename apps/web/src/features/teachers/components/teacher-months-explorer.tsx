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
import { formatCurrency, formatYearMonthAr, getCurrentYearMonth } from '@/lib/formatters';
import {
  TEACHER_PAYOUT_STATUS_META,
  TeacherMonthOverviewItem,
  TeacherProfileData,
} from '../teachers.types';
import { TeacherMonthDetailPanel } from './teacher-month-detail-panel';
import { buildTeacherYearSummary } from './teacher-year-grid.helper';

interface TeacherMonthsExplorerProps {
  data: TeacherProfileData;
  selectedYearMonth: string;
  onSelectMonth: (yearMonth: string) => void;
  canViewFinance: boolean;
}

type MonthFilterMode = 'ALL' | 'PAID' | 'OUTSTANDING';

export function TeacherMonthsExplorer({
  data,
  selectedYearMonth,
  onSelectMonth,
  canViewFinance,
}: TeacherMonthsExplorerProps) {
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

  const yearSummary = React.useMemo(
    () =>
      buildTeacherYearSummary({
        year: selectedYear,
        data,
        monthsList: data.monthsOverview ?? [],
        selectedYearMonth,
        currentYearMonth,
      }),
    [selectedYear, data, selectedYearMonth, currentYearMonth],
  );

  const monthsOverview: TeacherMonthOverviewItem[] = React.useMemo(() => {
    if (data.monthsOverview && data.monthsOverview.length > 0) {
      return data.monthsOverview;
    }
    const { totals } = data.monthlyBreakdown;
    const payoutStatus =
      totals.totalDues <= 0.009
        ? 'NO_DUES'
        : totals.remainingBalance <= 0.009
          ? 'PAID'
          : totals.totalPayouts > 0.009
            ? 'PARTIAL'
            : 'UNPAID';
    return [
      {
        yearMonth: data.yearMonth,
        payoutStatus,
        groupsCount: totals.groupsCount,
        executedSessionsCount: totals.executedSessionsCount,
        totalDues: totals.totalDues,
        totalPayouts: totals.totalPayouts,
        remainingBalance: totals.remainingBalance,
        payoutsCount: data.payouts.filter((p) => p.yearMonth === data.yearMonth).length,
        isClosed: totals.isClosed,
      },
    ];
  }, [data]);

  const paidCount = monthsOverview.filter((m) => m.payoutStatus === 'PAID').length;
  const partialCount = monthsOverview.filter((m) => m.payoutStatus === 'PARTIAL').length;
  const unpaidCount = monthsOverview.filter((m) => m.payoutStatus === 'UNPAID').length;
  const outstandingCount = partialCount + unpaidCount;

  const filteredMonths = React.useMemo(() => {
    if (filterMode === 'PAID') {
      return monthsOverview.filter((m) => m.payoutStatus === 'PAID');
    }
    if (filterMode === 'OUTSTANDING') {
      return monthsOverview.filter(
        (m) => m.payoutStatus === 'PARTIAL' || m.payoutStatus === 'UNPAID',
      );
    }
    return monthsOverview;
  }, [monthsOverview, filterMode]);

  const selectedMonthOverview = monthsOverview.find(
    (m) => m.yearMonth === selectedYearMonth,
  );

  return (
    <div className="space-y-6">
      <YearSummaryHeader
        title="خريطة شهور المدرس (المستحقات والصرف شهر بشهر)"
        subtitle="استعرض السنة كاملة بنظرة سريعة (تم الصرف / لم يُصرف / لم يكن موجوداً) أو انتقل لعرض تفاصيل كل شهر على حدة"
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        monthsCount={data.monthsOverview?.length ?? 1}
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
      {/* شريط إحصائيات وفلاتر الشهور */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-base font-black text-foreground">
              <CalendarRange className="h-5 w-5 text-primary" />
              مستكشف شهور المدرس (الحصص المنفذة وحالة الصرف الشهري)
            </h3>
            <p className="text-xs text-muted-foreground">
              اضغط على أي شهر من البطاقات أدناه لعرض تفصيل المجموعات، جدول الحصص المنفذة، وسندات الصرف الخاصة به
            </p>
          </div>

          {canViewFinance && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                شهور مصروفة بالكامل: {paidCount}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-bold text-amber-700 dark:text-amber-400">
                <Clock className="h-3.5 w-3.5" />
                صرف جزئي: {partialCount}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 font-bold text-rose-700 dark:text-rose-400">
                <AlertCircle className="h-3.5 w-3.5" />
                لم يُصرف: {unpaidCount}
              </span>
            </div>
          )}
        </div>

        {canViewFinance && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                filterMode === 'ALL'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              كل الشهور ({monthsOverview.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('PAID')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                filterMode === 'PAID'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              تم الصرف بالكامل ({paidCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('OUTSTANDING')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
                filterMode === 'OUTSTANDING'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              متبقي مستحقات ({outstandingCount})
            </button>
          </div>
        )}
      </Card>

      {/* شبكة بطاقات الشهور المنظمة */}
      {filteredMonths.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          لا توجد شهور مطابقة لفلتر العرض المختار حالياً
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMonths.map((item) => {
            const isSelected = item.yearMonth === selectedYearMonth;
            const statusMeta = TEACHER_PAYOUT_STATUS_META[item.payoutStatus];

            return (
              <button
                key={item.yearMonth}
                type="button"
                onClick={() => onSelectMonth(item.yearMonth)}
                className={`group relative flex flex-col justify-between rounded-2xl border p-4 text-right transition-all ${
                  isSelected
                    ? 'border-2 border-primary bg-primary/5 shadow-md ring-2 ring-primary/15'
                    : 'border-border bg-card hover:border-primary/50 hover:shadow-sm'
                }`}
              >
                <div>
                  {/* رأس بطاقة الشهر */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                        {formatYearMonthAr(item.yearMonth)}
                      </p>
                      <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                        {item.yearMonth}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {canViewFinance && (
                        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                      )}
                      {item.isClosed && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-muted-foreground">
                          <Lock className="h-2.5 w-2.5" />
                          مقفل
                        </span>
                      )}
                    </div>
                  </div>

                  {/* عدد الحصص المنفذة في هذا الشهر */}
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-xs">
                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="font-bold text-foreground">
                      نفّذ {item.executedSessionsCount} حصة ({item.groupsCount} مجموعات)
                    </span>
                  </div>
                </div>

                {/* التفاصيل المالية للشهر */}
                {canViewFinance && (
                  <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-border pt-2.5 text-[11px]">
                    <div>
                      <span className="text-muted-foreground block">المستحق</span>
                      <strong className="font-extrabold text-foreground">
                        {formatCurrency(item.totalDues)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">المنصرف</span>
                      <strong className="font-extrabold text-emerald-600">
                        {formatCurrency(item.totalPayouts)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">المتبقي</span>
                      <strong
                        className={`font-extrabold ${
                          item.remainingBalance > 0.009
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {formatCurrency(item.remainingBalance)}
                      </strong>
                    </div>
                  </div>
                )}

                {isSelected && (
                  <div className="mt-2.5 text-center text-[11px] font-extrabold text-primary">
                    ● الشهر المعروض تفصيله بالأسفل
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

        </>
      )}

      {/* اللوحة الشاملة لتفاصيل الشهر المختار */}
      <TeacherMonthDetailPanel
        data={data}
        selectedMonthStatus={selectedMonthOverview?.payoutStatus}
        canViewFinance={canViewFinance}
      />
    </div>
  );
}
