import { Calendar, CalendarDays, LayoutGrid } from 'lucide-react';
import { Card } from '@/design-system';

export type ExplorerViewMode = 'YEAR_SUMMARY' | 'MONTHLY_CARDS';

interface YearSummaryHeaderProps {
  title: string;
  subtitle: string;
  viewMode: ExplorerViewMode;
  onChangeViewMode: (mode: ExplorerViewMode) => void;
  monthsCount: number;
  children?: React.ReactNode;
}

/**
 * Shared header card with view-mode toggle ("السنة كاملة (12 شهر)" vs "تفاصيل الشهور")
 * and optional filter slot for detailed monthly cards.
 */
export function YearSummaryHeader({
  title,
  subtitle,
  viewMode,
  onChangeViewMode,
  monthsCount,
  children,
}: YearSummaryHeaderProps) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="flex items-center gap-2 text-base font-black text-foreground">
            <Calendar className="h-5 w-5 text-primary" />
            {title}
          </h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>

        <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => onChangeViewMode('YEAR_SUMMARY')}
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
            onClick={() => onChangeViewMode('MONTHLY_CARDS')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              viewMode === 'MONTHLY_CARDS'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            تفاصيل الشهور ({monthsCount})
          </button>
        </div>
      </div>

      {children}
    </Card>
  );
}
