import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Combobox } from './combobox';

export interface SelectOption {
  value: string;
  label: string;
  sublabel?: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
  containerClassName?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  clearable?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      containerClassName,
      label,
      error,
      options,
      placeholder,
      id,
      searchable = false,
      searchPlaceholder,
      emptyText,
      clearable,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const selectId = id || generatedId;

    if (searchable) {
      const stringValue = props.value !== undefined ? String(props.value) : undefined;
      return (
        <Combobox
          id={selectId}
          label={label}
          error={error}
          options={options}
          value={stringValue}
          placeholder={placeholder}
          searchPlaceholder={searchPlaceholder}
          emptyText={emptyText}
          clearable={clearable}
          disabled={props.disabled}
          required={props.required}
          className={className}
          containerClassName={containerClassName}
          name={props.name}
          onChange={(val) => {
            if (props.onChange) {
              const syntheticEvent = {
                target: { value: val, name: props.name || '' },
                currentTarget: { value: val, name: props.name || '' },
              } as React.ChangeEvent<HTMLSelectElement>;
              props.onChange(syntheticEvent);
            }
          }}
        />
      );
    }

    return (
      <div className={cn('relative space-y-1.5', containerClassName)}>
        {label && (
          <label htmlFor={selectId} className="block text-xs font-semibold text-foreground">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              'flex h-9 w-full appearance-none rounded-lg border border-input bg-card pr-3 pl-8 text-xs text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer',
              error && 'border-destructive',
              className,
            )}
            {...props}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        </div>
        {error && <p className="text-xs font-medium text-destructive">{error}</p>}
      </div>
    );
  },
);
Select.displayName = 'Select';
