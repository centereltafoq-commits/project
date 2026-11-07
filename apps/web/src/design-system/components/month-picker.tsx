import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatYearMonthAr, getCurrentYearMonth } from '@/lib/formatters';
import { Button } from './button';

const ARABIC_MONTH_NAMES = [
  'يناير (01)',
  'فبراير (02)',
  'مارس (03)',
  'أبريل (04)',
  'مايو (05)',
  'يونيو (06)',
  'يوليو (07)',
  'أغسطس (08)',
  'سبتمبر (09)',
  'أكتوبر (10)',
  'نوفمبر (11)',
  'ديسمبر (12)',
];

export interface MonthPickerProps {
  label?: string;
  value: string; // YYYY-MM
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export function MonthPicker({
  label,
  value,
  onChange,
  className,
  disabled = false,
}: MonthPickerProps) {
  const [open, setOpen] = React.useState(false);

  // Parse initial year and month
  const [selectedYear, selectedMonth] = React.useMemo(() => {
    if (!value || !value.includes('-')) {
      const current = getCurrentYearMonth().split('-');
      return [Number(current[0]), Number(current[1])];
    }
    const [y, m] = value.split('-');
    return [Number(y) || new Date().getFullYear(), Number(m) || 1];
  }, [value]);

  const [viewYear, setViewYear] = React.useState<number>(selectedYear);

  React.useEffect(() => {
    if (open) {
      setViewYear(selectedYear);
    }
  }, [open, selectedYear]);

  const handleSelectMonth = (monthIndex1Based: number) => {
    const formattedMonth = String(monthIndex1Based).padStart(2, '0');
    onChange(`${viewYear}-${formattedMonth}`);
    setOpen(false);
  };

  const handleSetCurrentMonth = () => {
    const current = getCurrentYearMonth();
    onChange(current);
    setOpen(false);
  };

  return (
    <div className={cn('relative inline-flex flex-col text-right', className)}>
      {label && (
        <span className="mb-1 text-xs font-semibold text-muted-foreground">
          {label}
        </span>
      )}

      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="flex h-10 items-center justify-between gap-2.5 rounded-lg border border-input bg-card px-3 py-2 text-sm font-bold text-foreground transition-all hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary shrink-0" />
              <span>{formatYearMonthAr(value) || value}</span>
            </span>
          </button>
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="end"
            dir="rtl"
            className="z-50 w-72 rounded-2xl border border-border bg-card p-3 shadow-2xl outline-none backdrop-blur animate-in fade-in-50 zoom-in-95"
          >
            {/* Header with year navigation */}
            <div className="mb-3 flex items-center justify-between border-b border-border pb-2.5">
              <button
                type="button"
                onClick={() => setViewYear((y) => y + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-accent"
                title="السنة القادمة"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <span className="text-base font-extrabold text-foreground">
                {viewYear}
              </span>

              <button
                type="button"
                onClick={() => setViewYear((y) => y - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-accent"
                title="السنة السابقة"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            {/* Months grid (3 columns x 4 rows) */}
            <div className="grid grid-cols-3 gap-1.5">
              {ARABIC_MONTH_NAMES.map((name, idx) => {
                const monthNum = idx + 1;
                const isSelected = viewYear === selectedYear && monthNum === selectedMonth;
                const isCurrentMonth =
                  viewYear === new Date().getFullYear() &&
                  monthNum === new Date().getMonth() + 1;

                return (
                  <button
                    key={monthNum}
                    type="button"
                    onClick={() => handleSelectMonth(monthNum)}
                    className={cn(
                      'flex h-11 items-center justify-center rounded-xl text-xs font-bold transition-all',
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-foreground hover:bg-primary/10 hover:text-primary',
                      !isSelected && isCurrentMonth && 'border border-primary text-primary font-extrabold',
                    )}
                  >
                    {name}
                  </button>
                );
              })}
            </div>

            {/* Quick Actions Footer */}
            <div className="mt-3 flex items-center justify-between border-t border-border pt-2 text-xs">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSetCurrentMonth}
              >
                الشهر الحالي
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                إغلاق
              </Button>
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}
