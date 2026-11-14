import * as React from 'react';
import { RotateCcw } from 'lucide-react';
import { Button, Card, DatePicker, MonthPicker, Select } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { cn } from '@/lib/cn';
import { formatDateAr, formatYearMonthAr, getTodayIsoDate } from '@/lib/formatters';
import {
  ALL_REPORTS_DEFINITIONS,
  ReportDefinition,
  ReportFilterOptionsData,
  ReportTypeSlug,
} from '../reports.types';

interface ReportsToolbarProps {
  activeReport: ReportTypeSlug;
  onSelectReport: (slug: ReportTypeSlug) => void;
  activeDefinition: ReportDefinition;
  yearMonth: string;
  onYearMonthChange: (val: string) => void;
  date: string;
  onDateChange: (val: string) => void;
  groupId: string;
  onGroupChange: (val: string) => void;
  teacherId: string;
  onTeacherChange: (val: string) => void;
  studentId: string;
  onStudentChange: (val: string) => void;
  search: string;
  onResetFilters: () => void;
  filterOptions?: ReportFilterOptionsData;
}

export function ReportsToolbar({
  activeReport,
  onSelectReport,
  activeDefinition,
  yearMonth,
  onYearMonthChange,
  date,
  onDateChange,
  groupId,
  onGroupChange,
  teacherId,
  onTeacherChange,
  studentId,
  onStudentChange,
  search,
  onResetFilters,
  filterOptions,
}: ReportsToolbarProps) {
  const { hasPermission } = useAuth();
  const selectedGroupLabel = filterOptions?.groups.find((g) => g.id === groupId)?.label;
  const selectedTeacherLabel = filterOptions?.teachers.find((t) => t.id === teacherId)?.label;
  const selectedStudentLabel = filterOptions?.students.find((s) => s.id === studentId)?.label;

  const permittedReports = React.useMemo(
    () =>
      ALL_REPORTS_DEFINITIONS.filter(
        (rep) => !rep.requiredPermission || hasPermission(rep.requiredPermission as any),
      ),
    [hasPermission],
  );

  return (
    <div className="space-y-4">
      {/* ترويسة الطباعة الرسمية (@media print) */}
      <div className="hidden border-b-2 border-black pb-4 print:block">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold">نظام إدارة السنتر التعليمي — التقرير الرسمي</p>
            <h1 className="mt-1 text-xl font-extrabold">{activeDefinition.fullTitle}</h1>
          </div>
          <div className="text-left text-xs">
            <p>تاريخ الطباعة: {formatDateAr(new Date())}</p>
            <p>الشهر المالي: {formatYearMonthAr(yearMonth)}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs">
          {date && <span>اليوم المحدد: {formatDateAr(date)}</span>}
          {selectedGroupLabel && <span>المجموعة: {selectedGroupLabel}</span>}
          {selectedTeacherLabel && <span>المدرس: {selectedTeacherLabel}</span>}
          {selectedStudentLabel && <span>الطالب: {selectedStudentLabel}</span>}
          {search && <span>بحث نصي: &quot;{search}&quot;</span>}
        </div>
      </div>

      {/* شريط اختيار التقارير المصرح بها */}
      <Card className="p-3 no-print">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {permittedReports.map((rep) => {
            const Icon = rep.icon;
            const isSelected = rep.slug === activeReport;
            return (
              <button
                key={rep.slug}
                type="button"
                onClick={() => onSelectReport(rep.slug)}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-right text-xs font-bold transition-all',
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-muted/30 text-foreground hover:border-primary/40 hover:bg-accent',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="line-clamp-1">{rep.shortTitle}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* شريط الفلاتر الموحد */}
      <Card className="p-4 no-print">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-1.5">
            <MonthPicker
              label="الشهر المالي"
              value={yearMonth}
              disabled={!activeDefinition.usesMonth}
              onChange={onYearMonthChange}
              className="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className="block truncate text-xs font-bold text-muted-foreground">
                تحديد يوم معين
              </label>
              {activeDefinition.usesDate && (
                <button
                  type="button"
                  onClick={() => {
                    const today = getTodayIsoDate();
                    onDateChange(date === today ? '' : today);
                  }}
                  className="text-[11px] font-bold text-primary hover:underline"
                >
                  {date ? 'عرض كل الشهر' : 'تقرير اليوم'}
                </button>
              )}
            </div>
            <DatePicker
              value={date}
              onChange={onDateChange}
              disabled={!activeDefinition.usesDate}
              placeholder="كل أيام الشهر..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-muted-foreground">المجموعة</label>
            <Select
              searchable
              clearable
              searchPlaceholder="ابحث باسم أو كود المجموعة..."
              placeholder="كل المجموعات"
              value={groupId}
              disabled={!activeDefinition.usesGroup}
              onChange={(e) => onGroupChange(e.target.value)}
              options={
                filterOptions?.groups.map((g) => ({
                  value: g.id,
                  label: `${g.code} - ${g.label}`,
                })) ?? []
              }
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-muted-foreground">المدرس</label>
            <Select
              searchable
              clearable
              searchPlaceholder="ابحث باسم المدرس..."
              placeholder="كل المدرسين"
              value={teacherId}
              disabled={!activeDefinition.usesTeacher}
              onChange={(e) => onTeacherChange(e.target.value)}
              options={
                filterOptions?.teachers.map((t) => ({
                  value: t.id,
                  label: t.label,
                })) ?? []
              }
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-muted-foreground">الطالب</label>
            <Select
              searchable
              clearable
              searchPlaceholder="ابحث باسم أو كود الطالب..."
              placeholder="كل الطلاب"
              value={studentId}
              disabled={!activeDefinition.usesStudent}
              onChange={(e) => onStudentChange(e.target.value)}
              options={
                filterOptions?.students.map((s) => ({
                  value: s.id,
                  label: `${s.code} - ${s.label}`,
                })) ?? []
              }
            />
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              variant="outline"
              size="md"
              className="w-full"
              onClick={onResetFilters}
            >
              <RotateCcw className="h-4 w-4" />
              إعادة ضبط الفلاتر
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
