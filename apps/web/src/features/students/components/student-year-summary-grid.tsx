import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  MinusCircle,
  XCircle,
} from 'lucide-react';
import { Card } from '@/design-system';
import { cn } from '@/lib/cn';
import { formatCurrency } from '@/lib/formatters';
import {
  StudentYearMonthCell,
  StudentYearSummaryData,
  YearMonthCellState,
} from './student-year-grid.helper';

interface StudentYearSummaryGridProps {
  summary: StudentYearSummaryData;
  selectedYearMonth: string;
  canViewFinance: boolean;
  onChangeYear: (year: number) => void;
  onSelectMonth: (yearMonth: string) => void;
}

const CELL_STYLE_META: Record<
  YearMonthCellState,
  {
    statusText: string;
    containerClass: string;
    badgeClass: string;
    icon: typeof CheckCircle2;
  }
> = {
  PAID: {
    statusText: 'مدفوع',
    containerClass:
      'border-emerald-500/40 bg-emerald-500/10 hover:border-emerald-500/80',
    badgeClass: 'bg-emerald-600 text-white',
    icon: CheckCircle2,
  },
  PARTIAL: {
    statusText: 'مدفوع جزئياً',
    containerClass:
      'border-amber-500/45 bg-amber-500/10 hover:border-amber-500/80',
    badgeClass: 'bg-amber-600 text-white',
    icon: Clock,
  },
  UNPAID: {
    statusText: 'غير مدفوع',
    containerClass:
      'border-rose-500/45 bg-rose-500/10 hover:border-rose-500/80',
    badgeClass: 'bg-rose-600 text-white',
    icon: XCircle,
  },
  NO_DUES: {
    statusText: 'بدون مستحقات',
    containerClass: 'border-border bg-card hover:border-primary/40',
    badgeClass: 'bg-muted text-muted-foreground',
    icon: MinusCircle,
  },
  NOT_PRESENT: {
    statusText: 'لم يكن موجوداً',
    containerClass:
      'border-dashed border-border/80 bg-muted/25 text-muted-foreground hover:border-border',
    badgeClass: 'bg-muted/80 text-muted-foreground',
    icon: MinusCircle,
  },
  UPCOMING: {
    statusText: 'شهر قادم',
    containerClass:
      'border-dashed border-border/60 bg-muted/10 text-muted-foreground/75 hover:border-border',
    badgeClass: 'bg-muted/60 text-muted-foreground',
    icon: Clock,
  },
};

export function StudentYearSummaryGrid({
  summary,
  selectedYearMonth,
  canViewFinance,
  onChangeYear,
  onSelectMonth,
}: StudentYearSummaryGridProps) {
  return (
    <Card className="space-y-4 p-4 sm:p-5">
      {/* شريط السنة والإحصاء السنوي المختصر */}
      <div className="flex flex-col gap-3 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeYear(summary.year - 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-accent"
            title="السنة السابقة"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <span className="min-w-[84px] text-center text-base font-black text-foreground">
            سنة {summary.year}
          </span>
          <button
            type="button"
            onClick={() => onChangeYear(summary.year + 1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground transition-colors hover:bg-accent"
            title="السنة التالية"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          {canViewFinance && (
            <>
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                مدفوع: {summary.counts.paid}
              </span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-rose-500/15 px-2.5 py-1 text-rose-700 dark:text-rose-300">
                <XCircle className="h-3.5 w-3.5" />
                غير مدفوع / جزئي: {summary.counts.unpaid + summary.counts.partial}
              </span>
            </>
          )}
          <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-muted-foreground">
            <MinusCircle className="h-3.5 w-3.5" />
            لم يكن موجوداً: {summary.counts.notPresent}
          </span>
          {canViewFinance && summary.totals.remaining > 0.009 && (
            <span className="inline-flex items-center rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 font-extrabold text-rose-600 dark:text-rose-400">
              متبقي السنة: {formatCurrency(summary.totals.remaining)}
            </span>
          )}
        </div>
      </div>

      {/* شبكة الـ 12 شهراً */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {summary.cells.map((cell: StudentYearMonthCell) => {
          const isSelected = cell.yearMonth === selectedYearMonth;
          const meta = CELL_STYLE_META[cell.state];
          const StatusIcon = meta.icon;

          return (
            <button
              key={cell.yearMonth}
              type="button"
              onClick={() => onSelectMonth(cell.yearMonth)}
              className={cn(
                'flex min-h-[112px] flex-col justify-between rounded-xl border p-3 text-right transition-all hover:-translate-y-0.5 hover:shadow-sm',
                meta.containerClass,
                isSelected && 'ring-2 ring-primary ring-offset-1',
              )}
            >
              <div className="flex w-full items-start justify-between gap-1">
                <div>
                  <div className="text-sm font-black text-foreground">
                    {cell.monthName}
                  </div>
                  <div className="font-mono text-[10px] font-semibold text-muted-foreground">
                    {cell.yearMonth}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {cell.isClosed && (
                    <Lock
                      className="h-3 w-3 text-muted-foreground"
                      aria-label="شهر مقفل"
                    />
                  )}
                  <StatusIcon
                    className={cn(
                      'h-4 w-4 shrink-0',
                      cell.state === 'PAID' && 'text-emerald-600',
                      cell.state === 'PARTIAL' && 'text-amber-600',
                      cell.state === 'UNPAID' && 'text-rose-600',
                      (cell.state === 'NO_DUES' ||
                        cell.state === 'NOT_PRESENT' ||
                        cell.state === 'UPCOMING') &&
                        'text-muted-foreground/70',
                    )}
                  />
                </div>
              </div>

              <div className="mt-2 space-y-1">
                <span
                  className={cn(
                    'inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold',
                    meta.badgeClass,
                  )}
                >
                  {canViewFinance || cell.state === 'NOT_PRESENT' || cell.state === 'UPCOMING'
                    ? meta.statusText
                    : `${cell.presentCount}/${cell.totalSessions} حصة`}
                </span>

                {canViewFinance && (
                  <div className="text-[11px] font-extrabold">
                    {cell.state === 'PAID' && (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(cell.totalPaid)}
                      </span>
                    )}
                    {cell.state === 'PARTIAL' && (
                      <span className="text-amber-700 dark:text-amber-400">
                        متبقي: {formatCurrency(cell.remaining)}
                      </span>
                    )}
                    {cell.state === 'UNPAID' && (
                      <span className="text-rose-600 dark:text-rose-400">
                        عليه: {formatCurrency(cell.remaining)}
                      </span>
                    )}
                    {cell.state === 'NO_DUES' && (
                      <span className="text-muted-foreground">
                        {cell.groupsCount} مجموعة
                      </span>
                    )}
                    {(cell.state === 'NOT_PRESENT' || cell.state === 'UPCOMING') && (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
