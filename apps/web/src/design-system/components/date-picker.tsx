import * as React from 'react';
import { DayPicker } from 'react-day-picker';
import { arEG } from 'date-fns/locale';
import { format, parseISO } from 'date-fns';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './button';

export interface DatePickerProps {
  label?: string;
  value?: string; // YYYY-MM-DD
  onChange?: (date: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
}

export function DatePicker({
  label,
  value,
  onChange,
  placeholder = 'اختر التاريخ...',
  error,
  disabled = false,
  minDate,
  maxDate,
  className,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    try {
      const parsed = parseISO(value);
      return isNaN(parsed.getTime()) ? undefined : parsed;
    } catch {
      return undefined;
    }
  }, [value]);

  const handleSelect = (date: Date | undefined) => {
    if (!date) {
      onChange?.('');
    } else {
      onChange?.(format(date, 'yyyy-MM-dd'));
    }
    setOpen(false);
  };

  const formattedDisplay = React.useMemo(() => {
    if (!selectedDate) return null;
    return format(selectedDate, 'dd MMMM yyyy', { locale: arEG });
  }, [selectedDate]);

  return (
    <div className={cn('space-y-1.5 text-right', className)}>
      {label && (
        <label className="block text-sm font-semibold text-foreground">
          {label}
        </label>
      )}

      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger asChild>
          <div className="relative">
            <button
              type="button"
              disabled={disabled}
              className={cn(
                'flex h-10 w-full items-center justify-between rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
                !value && 'text-muted-foreground',
                error && 'border-destructive focus:ring-destructive',
              )}
            >
              <span className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">{formattedDisplay || placeholder}</span>
              </span>
            </button>

            {value && !disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange?.('');
                }}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </PopoverPrimitive.Trigger>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            dir="rtl"
            className="z-50 rounded-2xl border border-border bg-card p-3 shadow-2xl outline-none backdrop-blur animate-in fade-in-50 zoom-in-95"
          >
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={handleSelect}
              locale={arEG}
              dir="rtl"
              disabled={[
                ...(minDate ? [{ before: minDate }] : []),
                ...(maxDate ? [{ after: maxDate }] : []),
              ]}
              showOutsideDays
              classNames={{
                root: 'p-1',
                months: 'flex flex-col space-y-3',
                month: 'space-y-3',
                month_caption: 'flex justify-center pt-1 relative items-center px-8',
                caption_label: 'text-sm font-bold text-foreground',
                nav: 'flex items-center justify-between absolute inset-x-1 top-1',
                button_previous:
                  'h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 border border-border rounded-lg inline-flex items-center justify-center transition-colors hover:bg-accent',
                button_next:
                  'h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 border border-border rounded-lg inline-flex items-center justify-center transition-colors hover:bg-accent',
                month_grid: 'w-full border-collapse space-y-1',
                weekdays: 'flex',
                weekday:
                  'text-muted-foreground rounded-md w-9 font-semibold text-[0.8rem] text-center',
                week: 'flex w-full mt-1.5',
                day: 'text-center text-sm p-0 relative focus-within:relative focus-within:z-20',
                day_button:
                  'h-9 w-9 p-0 font-medium rounded-xl transition-all hover:bg-primary/10 hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring flex items-center justify-center',
                selected:
                  'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground font-bold shadow-sm rounded-xl',
                today: 'border border-primary text-primary font-bold rounded-xl',
                outside: 'text-muted-foreground opacity-30',
                disabled: 'text-muted-foreground opacity-20 hover:bg-transparent pointer-events-none',
              }}
            />

            <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onChange?.(format(new Date(), 'yyyy-MM-dd'));
                  setOpen(false);
                }}
              >
                اليوم
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

      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
