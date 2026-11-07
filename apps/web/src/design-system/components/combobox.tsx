import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface ComboboxOption {
  value: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  label?: string;
  error?: string;
  options: ComboboxOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  clearable?: boolean;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  containerClassName?: string;
  id?: string;
  name?: string;
  size?: 'sm' | 'md';
}

/**
 * Normalizes Arabic text for robust fuzzy searching:
 * - Removes diacritics / tashkeel
 * - Normalizes Alef forms (أ, إ, آ, ء) -> ا
 * - Normalizes Teh Marbuta (ة) -> ه
 * - Normalizes Alef Maqsura / Yaa (ى, ي) -> ي
 */
export function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // Tashkeel
    .replace(/[أإآء]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ى]/g, 'ي');
}

export const Combobox = React.forwardRef<HTMLButtonElement, ComboboxProps>(
  (
    {
      label,
      error,
      options = [],
      value: controlledValue,
      defaultValue = '',
      onChange,
      placeholder = 'اختر...',
      searchPlaceholder = 'ابحث بالاسم أو الكود...',
      emptyText = 'لا توجد نتائج مطابقة',
      clearable = true,
      disabled = false,
      required = false,
      className,
      containerClassName,
      id,
      name,
      size = 'sm',
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const comboboxId = id || generatedId;

    const [open, setOpen] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [highlightedIndex, setHighlightedIndex] = React.useState(0);

    const isControlled = controlledValue !== undefined;
    const [internalValue, setInternalValue] = React.useState(defaultValue);
    const currentValue = isControlled ? controlledValue : internalValue;

    const searchInputRef = React.useRef<HTMLInputElement>(null);
    const listRef = React.useRef<HTMLDivElement>(null);

    // Selected option lookup
    const selectedOption = React.useMemo(() => {
      return options.find((opt) => String(opt.value) === String(currentValue));
    }, [options, currentValue]);

    // Filter options using normalized Arabic
    const filteredOptions = React.useMemo(() => {
      if (!searchQuery.trim()) return options;
      const normalizedQuery = normalizeArabic(searchQuery);

      return options.filter((opt) => {
        const normLabel = normalizeArabic(opt.label);
        const normSub = opt.sublabel ? normalizeArabic(opt.sublabel) : '';
        const normVal = normalizeArabic(opt.value);
        return (
          normLabel.includes(normalizedQuery) ||
          normSub.includes(normalizedQuery) ||
          normVal.includes(normalizedQuery)
        );
      });
    }, [options, searchQuery]);

    // Reset highlight index when filtered list changes
    React.useEffect(() => {
      setHighlightedIndex(0);
    }, [filteredOptions]);

    // Auto-focus search input when opened
    React.useEffect(() => {
      if (open) {
        setSearchQuery('');
        setHighlightedIndex(0);
        // Small timeout to allow popover animation / mounting
        const timer = setTimeout(() => {
          searchInputRef.current?.focus();
        }, 30);
        return () => clearTimeout(timer);
      }
    }, [open]);

    // Scroll active item into view
    React.useEffect(() => {
      if (!open || !listRef.current) return;
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }, [highlightedIndex, open]);

    const selectValue = (val: string) => {
      if (!isControlled) {
        setInternalValue(val);
      }
      onChange?.(val);
      setOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (!isControlled) {
        setInternalValue('');
      }
      onChange?.('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].disabled) {
          selectValue(filteredOptions[highlightedIndex].value);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };

    const heightClass = size === 'md' ? 'h-10 text-sm' : 'h-9 text-xs';

    return (
      <div className={cn('relative space-y-1.5 text-right', containerClassName)} dir="rtl">
        {name && <input type="hidden" name={name} value={currentValue} />}
        {label && (
          <label
            htmlFor={comboboxId}
            className="block text-xs font-semibold text-foreground cursor-pointer select-none"
            onClick={() => !disabled && setOpen((prev) => !prev)}
          >
            {label}
            {required && <span className="text-destructive mr-1">*</span>}
          </label>
        )}

        <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
          <PopoverPrimitive.Trigger asChild>
            <button
              id={comboboxId}
              ref={ref}
              type="button"
              role="combobox"
              aria-expanded={open}
              aria-haspopup="listbox"
              disabled={disabled}
              onKeyDown={handleKeyDown}
              className={cn(
                'group flex w-full items-center justify-between rounded-lg border border-input bg-card px-3 text-foreground transition-all duration-150',
                'hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary',
                'disabled:cursor-not-allowed disabled:opacity-50',
                error && 'border-destructive focus-visible:ring-destructive',
                heightClass,
                className,
              )}
            >
              <span
                className={cn(
                  'truncate text-right flex-1 select-none',
                  !selectedOption && 'text-muted-foreground font-normal',
                  selectedOption && 'font-medium',
                )}
              >
                {selectedOption ? selectedOption.label : placeholder}
              </span>

              <div className="flex items-center gap-1.5 shrink-0 mr-2 text-muted-foreground">
                {clearable && Boolean(currentValue) && !disabled && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={handleClear}
                    title="إلغاء التحديد"
                    className="rounded p-0.5 hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </span>
                )}
                <ChevronsUpDown className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          </PopoverPrimitive.Trigger>

          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align="start"
              sideOffset={4}
              collisionPadding={12}
              className={cn(
                'z-[70] min-w-[200px] w-[var(--radix-popover-trigger-width)] max-w-[95vw] rounded-xl border border-border bg-card p-1.5 shadow-xl',
                'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
              )}
              dir="rtl"
              onKeyDown={handleKeyDown}
            >
              {/* Search Box */}
              <div className="relative mb-1 px-1 pt-1">
                <Search className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-8 w-full rounded-lg border border-input bg-muted/40 pr-8 pl-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:outline-none focus:ring-1 focus:ring-primary transition-all"
                  onKeyDown={(e) => {
                    // Prevent form submission on enter
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleKeyDown(e);
                    }
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                    title="مسح البحث"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Options Count / Info */}
              <div className="flex items-center justify-between px-2 py-1 text-[10px] text-muted-foreground border-b border-border/40 mb-1">
                <span>النتائج ({filteredOptions.length})</span>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-primary hover:underline"
                  >
                    إعادة ضبط
                  </button>
                )}
              </div>

              {/* Options List */}
              <div
                ref={listRef}
                role="listbox"
                className="max-h-60 overflow-y-auto overflow-x-hidden space-y-0.5 py-0.5 pr-0.5"
              >
                {filteredOptions.length === 0 ? (
                  <div className="py-6 px-3 text-center text-xs text-muted-foreground select-none">
                    <Search className="h-6 w-6 mx-auto mb-1.5 opacity-30 text-muted-foreground" />
                    <p>{emptyText}</p>
                    {searchQuery && (
                      <p className="mt-1 text-[11px] opacity-75 font-mono">
                        "{searchQuery}"
                      </p>
                    )}
                  </div>
                ) : (
                  filteredOptions.map((opt, idx) => {
                    const isSelected = String(opt.value) === String(currentValue);
                    const isHighlighted = idx === highlightedIndex;

                    return (
                      <div
                        key={opt.value}
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={opt.disabled}
                        onClick={() => !opt.disabled && selectValue(opt.value)}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        className={cn(
                          'flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs transition-colors cursor-pointer select-none text-right',
                          isHighlighted && !isSelected && 'bg-accent/80 text-foreground',
                          isSelected && 'bg-primary text-primary-foreground font-semibold',
                          opt.disabled && 'cursor-not-allowed opacity-40',
                        )}
                      >
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="truncate">{opt.label}</span>
                          {opt.sublabel && (
                            <span
                              className={cn(
                                'text-[10px] truncate',
                                isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground',
                              )}
                            >
                              {opt.sublabel}
                            </span>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="h-4 w-4 shrink-0 mr-1 text-primary-foreground" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>

        {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      </div>
    );
  },
);

Combobox.displayName = 'Combobox';

export { Combobox as SearchableSelect };
