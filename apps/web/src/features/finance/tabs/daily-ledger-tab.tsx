import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  CalendarCheck,
  CalendarDays,
  RotateCcw,
  Search,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  StatCard,
} from '@/design-system';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  ARABIC_DAYS,
  formatCurrency,
  formatDateAr,
  formatTimeAr,
  formatYearMonthAr,
  getTodayIsoDate,
} from '@/lib/formatters';
import {
  DailyLedgerEntry,
  DailyLedgerEntryType,
  DailyLedgerResponse,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_OPTIONS,
} from '../finance.types';

interface DailyLedgerTabProps {
  yearMonth: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const LEDGER_TYPE_PILLS: Array<{ value: DailyLedgerEntryType; label: string }> = [
  { value: 'ALL', label: 'الكل' },
  { value: 'PAYMENT', label: 'تحصيلات الطلاب' },
  { value: 'TEACHER_PAYOUT', label: 'صرف المدرسين' },
  { value: 'ASSISTANT_PAYOUT', label: 'صرف المساعدين' },
  { value: 'EXPENSE', label: 'المصروفات التشغيلية' },
];

const ENTRY_TYPE_BADGES: Record<
  DailyLedgerEntry['type'],
  { label: string; variant: 'success' | 'purple' | 'info' | 'warning' }
> = {
  PAYMENT: { label: 'تحصيل طالب', variant: 'success' },
  TEACHER_PAYOUT: { label: 'صرف مدرس', variant: 'purple' },
  ASSISTANT_PAYOUT: { label: 'صرف مساعد', variant: 'info' },
  EXPENSE: { label: 'مصروف تشغيلي', variant: 'warning' },
};

function getWeekdayAr(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return ARABIC_DAYS[d.getDay()] ?? '';
}

export function DailyLedgerTab({
  yearMonth,
  selectedDate,
  onSelectDate,
}: DailyLedgerTabProps) {
  const [typeFilter, setTypeFilter] = React.useState<DailyLedgerEntryType>('ALL');
  const [paymentMethod, setPaymentMethod] = React.useState('');
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);

  const todayIso = getTodayIsoDate();

  const { data, isLoading } = useQuery<DailyLedgerResponse>({
    queryKey: [
      'finance',
      'daily-ledger',
      yearMonth,
      selectedDate,
      typeFilter,
      paymentMethod,
      debouncedSearch,
    ],
    queryFn: async () => {
      const res = await apiClient.get<DailyLedgerResponse>('/finance/daily-ledger', {
        params: {
          yearMonth,
          date: selectedDate || undefined,
          type: typeFilter !== 'ALL' ? typeFilter : undefined,
          paymentMethod: paymentMethod || undefined,
          search: debouncedSearch || undefined,
        },
      });
      return res.data;
    },
  });

  const summary = data?.summary;
  const staffPayoutsTotal =
    (summary?.teacherPayoutsTotal ?? 0) + (summary?.assistantPayoutsTotal ?? 0);
  const staffPayoutsCount =
    (summary?.teacherPayoutsCount ?? 0) + (summary?.assistantPayoutsCount ?? 0);
  const days = data?.daysSummary ?? [];
  const entries = data?.entries ?? [];

  return (
    <div className="space-y-5">
      {/* 1. Interactive Days Strip / Grid */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-sm font-extrabold text-foreground">
                أيام الحركة المالية في شهر {formatYearMonthAr(yearMonth)}
              </h3>
              <p className="text-xs text-muted-foreground">
                اختر يوماً معيناً لعرض كل ما تم تسجيله فيه من تحصيلات وصرفيات ومصروفات بشكل منظم
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={!selectedDate ? 'primary' : 'outline'}
              onClick={() => onSelectDate('')}
              className="h-8 text-xs font-bold"
            >
              كل أيام الشهر ({days.length} يوم نشط)
            </Button>
            <Button
              size="sm"
              variant={selectedDate === todayIso ? 'primary' : 'outline'}
              onClick={() => onSelectDate(todayIso)}
              className="h-8 gap-1 text-xs font-bold"
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              حركات اليوم ({formatDateAr(todayIso)})
            </Button>
          </div>
        </div>

        {days.length === 0 && !isLoading ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center text-xs text-muted-foreground">
            لا توجد حركات مالية مسجلة في هذا الشهر حتى الآن.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {days.map((day) => {
              const isSelected = selectedDate === day.date;
              const isToday = day.date === todayIso;
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() =>
                    onSelectDate(isSelected ? '' : day.date)
                  }
                  className={cn(
                    'flex flex-col justify-between rounded-xl border p-3 text-right transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/30 shadow-sm'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-accent/40',
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div>
                      <span className="text-xs font-extrabold text-foreground block">
                        {getWeekdayAr(day.date)} — {formatDateAr(day.date)}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {day.date}
                        {isToday ? ' • اليوم' : ''}
                      </span>
                    </div>
                    <Badge
                      variant={isSelected ? 'info' : 'neutral'}
                      className="text-[11px] shrink-0"
                    >
                      {day.totalTransactionsCount} حركة
                    </Badge>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 gap-1.5 border-t border-border/60 pt-2 text-[11px]">
                    <div>
                      <span className="text-muted-foreground block">الوارد (+)</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        +{formatCurrency(day.totalInflow)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">المنصرف (-)</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">
                        -{formatCurrency(day.totalOutflow)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[11px] pt-1">
                    <span className="text-muted-foreground">الصافي:</span>
                    <span
                      className={cn(
                        'font-extrabold',
                        day.netCashFlow >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400',
                      )}
                    >
                      {formatCurrency(day.netCashFlow)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* 2. Daily / Selected Period 4 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={
            selectedDate
              ? `تحصيلات الطلاب (${formatDateAr(selectedDate)})`
              : `إجمالي تحصيلات الطلاب (${formatYearMonthAr(yearMonth)})`
          }
          value={formatCurrency(summary?.paymentsTotal ?? 0)}
          subtitle={`${summary?.paymentsCount ?? 0} إيصال تحصيل مسجل`}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          title="صرفيات المدرسين والمساعدين"
          value={formatCurrency(staffPayoutsTotal)}
          subtitle={`${staffPayoutsCount} حركة صرف (${summary?.teacherPayoutsCount ?? 0} مدرس • ${summary?.assistantPayoutsCount ?? 0} مساعد)`}
          icon={Users}
          tone="purple"
        />
        <StatCard
          title="المصروفات التشغيلية"
          value={formatCurrency(summary?.expensesTotal ?? 0)}
          subtitle={`${summary?.expensesCount ?? 0} بند مصروفات مسجل`}
          icon={Building2}
          tone="warning"
        />
        <StatCard
          title={selectedDate ? 'صافي حركة الخزينة لليوم' : 'صافي حركة الخزينة للشهر'}
          value={formatCurrency(summary?.netCashFlow ?? 0)}
          subtitle={`الوارد ${formatCurrency(summary?.totalInflow ?? 0)} - المنصرف ${formatCurrency(summary?.totalOutflow ?? 0)}`}
          icon={Banknote}
          tone={(summary?.netCashFlow ?? 0) >= 0 ? 'success' : 'danger'}
        />
      </div>

      {/* 3. Filter Pills & Organized Transactions Table */}
      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {LEDGER_TYPE_PILLS.map((pill) => {
              const active = typeFilter === pill.value;
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setTypeFilter(pill.value)}
                  className={cn(
                    'rounded-lg px-3 py-1.5 text-xs font-bold transition-all',
                    active
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم، الكود، أو رقم الإيصال..."
                className="pr-9 h-9 text-xs"
              />
            </div>

            <Select
              placeholder="كل وسائل الدفع"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              options={PAYMENT_METHOD_OPTIONS}
              className="w-44"
            />

            {(selectedDate || typeFilter !== 'ALL' || paymentMethod || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onSelectDate('');
                  setTypeFilter('ALL');
                  setPaymentMethod('');
                  setSearch('');
                }}
                className="gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                إعادة ضبط
              </Button>
            )}
          </div>
        </div>

        {selectedDate && (
          <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2 text-xs">
            <span className="font-bold text-foreground">
              عرض الحركات المالية المسجلة في يوم:{' '}
              <span className="text-primary">
                {getWeekdayAr(selectedDate)} {formatDateAr(selectedDate)} ({selectedDate})
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelectDate('')}
              className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
            >
              عرض كل أيام الشهر
            </Button>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-right text-xs">
            <thead className="bg-muted/50 text-muted-foreground border-b border-border">
              <tr>
                <th className="px-3.5 py-3 font-bold whitespace-nowrap">التاريخ والوقت</th>
                <th className="px-3.5 py-3 font-bold whitespace-nowrap">نوع الحركة</th>
                <th className="px-3.5 py-3 font-bold whitespace-nowrap">رقم المرجع / الإيصال</th>
                <th className="px-3.5 py-3 font-bold whitespace-nowrap">الاسم / البيان</th>
                <th className="px-3.5 py-3 font-bold whitespace-nowrap">البند والتفاصيل</th>
                <th className="px-3.5 py-3 font-bold whitespace-nowrap">طريقة الدفع</th>
                <th className="px-3.5 py-3 font-bold whitespace-nowrap">المبلغ</th>
                <th className="px-3.5 py-3 font-bold whitespace-nowrap">المسؤول</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    جاري تحميل سجل اليومية...
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    {selectedDate
                      ? `لا توجد حركات مالية مسجلة في يوم ${formatDateAr(selectedDate)} تطابق معايير البحث`
                      : 'لا توجد حركات مالية مسجلة في هذا الشهر تطابق معايير البحث'}
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const badgeCfg = ENTRY_TYPE_BADGES[entry.type];
                  const isInflow = entry.direction === 'INFLOW';
                  return (
                    <tr
                      key={`${entry.type}-${entry.id}`}
                      className="hover:bg-accent/30 transition-colors"
                    >
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="font-bold text-foreground">
                          {formatDateAr(entry.date)}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {formatTimeAr(entry.createdAt)}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <Badge variant={badgeCfg.variant} className="text-[11px]">
                          {badgeCfg.label}
                        </Badge>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap font-mono">
                        <span className="inline-block rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                          {entry.referenceNumber}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="font-bold text-foreground">{entry.partyName}</div>
                        {entry.partyCode && (
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {entry.partyCode}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="font-medium text-foreground">{entry.categoryLabel}</div>
                        {entry.notes && (
                          <div className="text-[11px] text-muted-foreground line-clamp-1">
                            {entry.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <Badge variant="neutral" className="text-[11px]">
                          {PAYMENT_METHOD_LABELS[entry.paymentMethod] ?? entry.paymentMethod}
                        </Badge>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center gap-0.5 font-extrabold text-xs',
                            isInflow
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400',
                          )}
                        >
                          {isInflow ? (
                            <ArrowDownLeft className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          )}
                          {isInflow ? '+' : '-'}
                          {formatCurrency(entry.amount)}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-muted-foreground">
                        {entry.recordedByName || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
