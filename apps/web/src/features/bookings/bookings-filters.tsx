import { BookingRequestType, BookingStatus } from '@edu-center/shared';
import { DatePicker, Select } from '@/design-system';
import { cn } from '@/lib/cn';
import { BookingLookups } from './bookings.types';

export function SegmentedToggle<T extends string>({
  label,
  value,
  options,
  activeClass = 'border-primary bg-primary text-primary-foreground',
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  activeClass?: string;
  onChange: (val: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-semibold text-foreground">{label}</span>
      <div className="flex gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex-1 rounded-lg border py-2 text-xs font-bold transition-colors',
              value === opt.value ? activeClass : 'border-border bg-card text-foreground',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface BookingsFiltersProps {
  statusFilter: string;
  onStatusChange: (v: string) => void;
  typeFilter: string;
  onTypeChange: (v: string) => void;
  teacherFilter: string;
  onTeacherChange: (v: string) => void;
  fromDate: string;
  onFromDateChange: (v: string) => void;
  toDate: string;
  onToDateChange: (v: string) => void;
  lookups?: BookingLookups;
}

export function BookingsFilters({
  statusFilter,
  onStatusChange,
  typeFilter,
  onTypeChange,
  teacherFilter,
  onTeacherChange,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  lookups,
}: BookingsFiltersProps) {
  return (
    <>
      <Select
        placeholder="كل الحالات"
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        options={[
          { value: BookingStatus.PENDING, label: 'قيد المراجعة' },
          { value: BookingStatus.CONFIRMED, label: 'مؤكد' },
          { value: BookingStatus.REJECTED, label: 'مرفوض' },
          { value: BookingStatus.CANCELLED, label: 'ملغي' },
          { value: BookingStatus.COMPLETED, label: 'مكتمل' },
        ]}
        className="w-36"
      />
      <Select
        placeholder="كل الأنواع"
        value={typeFilter}
        onChange={(e) => onTypeChange(e.target.value)}
        options={[
          { value: BookingRequestType.STUDENT_WITH_TEACHER, label: 'طالب مع مدرس' },
          { value: BookingRequestType.TEACHER_WITH_CENTER, label: 'مدرس مع السنتر' },
        ]}
        className="w-36"
      />
      <Select
        placeholder="كل المدرسين"
        value={teacherFilter}
        onChange={(e) => onTeacherChange(e.target.value)}
        options={(lookups?.teachers ?? []).map((t) => ({ value: t.id, label: t.fullName }))}
        className="w-44"
      />
      <DatePicker
        placeholder="من تاريخ"
        value={fromDate}
        onChange={onFromDateChange}
        className="w-36"
      />
      <DatePicker
        placeholder="إلى تاريخ"
        value={toDate}
        onChange={onToDateChange}
        className="w-36"
      />
    </>
  );
}
