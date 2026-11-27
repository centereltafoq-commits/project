import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  Building2,
  Calculator,
  CalendarDays,
  GraduationCap,
  Lock,
  Receipt,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Badge,
  Button,
  DatePicker,
  MonthPicker,
  PageHeader,
  StatCard,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from '@/design-system';
import { PERMISSIONS } from '@edu-center/shared';
import { useAuth } from '@/features/auth/auth-context';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import {
  formatCurrency,
  formatDateAr,
  formatYearMonthAr,
  getCurrentYearMonth,
  getTodayIsoDate,
} from '@/lib/formatters';
import {
  FinanceLookups,
  MonthExecutiveSummary,
  PaymentRow,
} from './finance.types';
import { CloseMonthModal } from './modals/close-month-modal';
import { ReceiptPrintModal } from './modals/receipt-print-modal';
import { AssistantDuesTab } from './tabs/assistant-dues-tab';
import { DailyLedgerTab } from './tabs/daily-ledger-tab';
import { ExpensesTab } from './tabs/expenses-tab';
import { PaymentsHistoryTab } from './tabs/payments-history-tab';
import { StudentBillingTab } from './tabs/student-billing-tab';
import { TeacherDuesTab } from './tabs/teacher-dues-tab';

const VALID_FINANCE_TABS = new Set([
  'student-billing',
  'daily-ledger',
  'payments-history',
  'teacher-dues',
  'assistant-dues',
  'expenses',
]);

export function FinancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { hasPermission } = useAuth();
  const canCloseMonth = hasPermission(PERMISSIONS.FINANCE_CLOSE_MONTH);
  const canRecalculateMonth =
    hasPermission(PERMISSIONS.FINANCE_VIEW) ||
    hasPermission(PERMISSIONS.FINANCE_COLLECT_PAYMENT) ||
    hasPermission(PERMISSIONS.FINANCE_PAYOUTS) ||
    canCloseMonth;

  const rawTab = searchParams.get('tab');
  const activeTab = rawTab && VALID_FINANCE_TABS.has(rawTab) ? rawTab : 'student-billing';

  const handleTabChange = (nextTab: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', nextTab);
        return next;
      },
      { replace: true },
    );
  };

  const [yearMonth, setYearMonth] = React.useState(getCurrentYearMonth());
  const [selectedDate, setSelectedDate] = React.useState('');
  const [closeConfirmOpen, setCloseConfirmOpen] = React.useState(false);
  const [activeReceipt, setActiveReceipt] = React.useState<PaymentRow | null>(null);

  const handleYearMonthChange = (nextYearMonth: string) => {
    setYearMonth(nextYearMonth);
    if (selectedDate && !selectedDate.startsWith(nextYearMonth)) {
      setSelectedDate('');
    }
  };

  const handleDateChange = (nextDate: string) => {
    setSelectedDate(nextDate);
    if (nextDate && nextDate.slice(0, 7) !== yearMonth) {
      setYearMonth(nextDate.slice(0, 7));
    }
  };

  const { data: lookups } = useQuery<FinanceLookups>({
    queryKey: ['finance', 'lookups'],
    queryFn: async () => (await apiClient.get('/finance/lookups')).data,
  });

  const { data: summary } = useQuery<MonthExecutiveSummary>({
    queryKey: ['finance', 'month-summary', yearMonth],
    queryFn: async () =>
      (await apiClient.get('/finance/month-summary', { params: { yearMonth } })).data,
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => apiClient.post('/finance/recalculate-month', { yearMonth }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-profile'] });
      queryClient.invalidateQueries({ queryKey: ['assistant-profile'] });
      queryClient.invalidateQueries({ queryKey: ['report-data'] });
      notify(
        `تم إعادة احتساب السجلات المفتوحة لشهر ${formatYearMonthAr(yearMonth)} بنجاح`,
        'success',
      );
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const closeMonthMutation = useMutation({
    mutationFn: async () => apiClient.post('/finance/close-month', { yearMonth }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      queryClient.invalidateQueries({ queryKey: ['teacher-profile'] });
      queryClient.invalidateQueries({ queryKey: ['assistant-profile'] });
      queryClient.invalidateQueries({ queryKey: ['report-data'] });
      setCloseConfirmOpen(false);
      notify(
        `تم إغلاق شهر ${formatYearMonthAr(yearMonth)} مالياً وتجميد الأسعار التاريخية بنجاح`,
        'success',
      );
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const staffTotalDues =
    (summary?.teachers.totalDues ?? 0) + (summary?.assistants.totalDues ?? 0);
  const staffRemaining =
    (summary?.teachers.remainingBalance ?? 0) +
    (summary?.assistants.remainingBalance ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="الإدارة المالية والمحاسبية الشاملة"
        description="احتساب الحضور الفعلي للطلاب، الإيصالات، نسب المدرسين والمساعدين، المصروفات، والإغلاق الشهري"
        actions={
          <div className="flex flex-wrap items-center gap-2 no-print">
            <MonthPicker
              value={yearMonth}
              onChange={handleYearMonthChange}
            />
            {summary?.isMonthClosed && (
              <Badge variant="purple" className="gap-1 whitespace-nowrap">
                <Lock className="h-3 w-3" />
                مغلق
              </Badge>
            )}

            {canRecalculateMonth && (
              <Button
                variant="outline"
                disabled={summary?.isMonthClosed}
                isLoading={recalculateMutation.isPending}
                onClick={() => recalculateMutation.mutate()}
                className="gap-1.5"
              >
                <Calculator className="h-4 w-4" />
                إعادة احتساب الشهر
              </Button>
            )}

            {canCloseMonth && (
              <Button
                variant="danger"
                disabled={summary?.isMonthClosed}
                onClick={() => setCloseConfirmOpen(true)}
                className="gap-1.5"
              >
                <Lock className="h-4 w-4" />
                إغلاق الشهر مالياً
              </Button>
            )}
          </div>
        }
      />

      {/* شريط الفلترة اليومية داخل الشهر */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm no-print">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span>عرض ومتابعة حركات يوم محدد:</span>
          </div>
          <DatePicker
            value={selectedDate}
            onChange={handleDateChange}
            placeholder="تحديد يوم معين بالشهر..."
            className="w-56"
          />
          <Button
            variant={selectedDate === getTodayIsoDate() ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              const today = getTodayIsoDate();
              handleDateChange(selectedDate === today ? '' : today);
              if (activeTab === 'student-billing') {
                handleTabChange('daily-ledger');
              }
            }}
            className="h-10 gap-1.5 text-xs font-bold"
          >
            <CalendarDays className="h-4 w-4" />
            حركات اليوم
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {selectedDate ? (
            <>
              <Badge variant="info" className="gap-1.5 px-2.5 py-1 text-xs">
                <span>يتم تصفية الجداول ليوم: {formatDateAr(selectedDate)}</span>
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate('')}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                عرض كل الشهر
              </Button>
            </>
          ) : (
            <span className="text-muted-foreground">
              يتم الآن عرض إجمالي حركات شهر{' '}
              <strong className="text-foreground">{formatYearMonthAr(yearMonth)}</strong>
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 no-print">
        <StatCard
          title={`مستحقات الطلاب (${formatYearMonthAr(yearMonth)})`}
          value={formatCurrency(summary?.students.totalDue ?? 0)}
          subtitle={`المتبقي للتحصيل: ${formatCurrency(summary?.students.remainingBalance ?? 0)}`}
          icon={GraduationCap}
          tone="primary"
        />
        <StatCard
          title="إجمالي المحصّل من الطلاب"
          value={formatCurrency(summary?.students.totalPaid ?? 0)}
          subtitle="بناءً على الإيصالات المسجلة"
          icon={Wallet}
          tone="success"
        />
        <StatCard
          title="مستحقات المدرسين والمساعدين"
          value={formatCurrency(staffTotalDues)}
          subtitle={`المتبقي للصرف: ${formatCurrency(staffRemaining)}`}
          icon={Users}
          tone="purple"
        />
        <StatCard
          title="مصروفات السنتر الشهرية"
          value={formatCurrency(summary?.expenses.totalAmount ?? 0)}
          subtitle="إيجار ومرافق ومستلزمات وإدارة"
          icon={Building2}
          tone="warning"
        />
        <StatCard
          title="صافي ربح السنتر"
          value={formatCurrency(summary?.netCenterProfit ?? 0)}
          subtitle="إجمالي نصيب السنتر عن الطلاب (دون خصم المساعدين والمصروفات)"
          icon={TrendingUp}
          tone={(summary?.netCenterProfit ?? 0) >= 0 ? 'success' : 'danger'}
        />
        <StatCard
          title="صافي التدفق النقدي"
          value={formatCurrency(summary?.netCashFlow ?? 0)}
          subtitle="المحصل - المنصرف فعلياً بالخزينة"
          icon={Banknote}
          tone={(summary?.netCashFlow ?? 0) >= 0 ? 'success' : 'danger'}
        />
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="no-print">
          <TabsTrigger value="student-billing">
            <GraduationCap className="h-4 w-4" />
            تحصيل ومستحقات الطلاب
          </TabsTrigger>
          <TabsTrigger value="daily-ledger">
            <CalendarDays className="h-4 w-4" />
            سجل اليومية (باليوم)
          </TabsTrigger>
          <TabsTrigger value="payments-history">
            <Receipt className="h-4 w-4" />
            سجل الإيصالات والمدفوعات
          </TabsTrigger>
          <TabsTrigger value="teacher-dues">
            <Users className="h-4 w-4" />
            مستحقات وصرفيات المدرسين
          </TabsTrigger>
          <TabsTrigger value="assistant-dues">
            <UserCheck className="h-4 w-4" />
            مستحقات وصرفيات المساعدين
          </TabsTrigger>
          <TabsTrigger value="expenses">
            <Building2 className="h-4 w-4" />
            مصروفات السنتر
          </TabsTrigger>
        </TabsList>

        <TabsContent value="student-billing">
          <StudentBillingTab
            yearMonth={yearMonth}
            isMonthClosed={Boolean(summary?.isMonthClosed)}
            lookups={lookups}
            onShowReceipt={(r) => setActiveReceipt(r)}
          />
        </TabsContent>
        <TabsContent value="daily-ledger">
          <DailyLedgerTab
            yearMonth={yearMonth}
            selectedDate={selectedDate}
            onSelectDate={handleDateChange}
          />
        </TabsContent>
        <TabsContent value="payments-history">
          <PaymentsHistoryTab
            yearMonth={yearMonth}
            selectedDate={selectedDate}
            onClearDate={() => setSelectedDate('')}
            onShowReceipt={(r) => setActiveReceipt(r)}
          />
        </TabsContent>
        <TabsContent value="teacher-dues">
          <TeacherDuesTab
            yearMonth={yearMonth}
            selectedDate={selectedDate}
            isMonthClosed={Boolean(summary?.isMonthClosed)}
            lookups={lookups}
          />
        </TabsContent>
        <TabsContent value="assistant-dues">
          <AssistantDuesTab
            yearMonth={yearMonth}
            selectedDate={selectedDate}
            isMonthClosed={Boolean(summary?.isMonthClosed)}
            lookups={lookups}
          />
        </TabsContent>
        <TabsContent value="expenses">
          <ExpensesTab
            yearMonth={yearMonth}
            selectedDate={selectedDate}
            onClearDate={() => setSelectedDate('')}
            isMonthClosed={Boolean(summary?.isMonthClosed)}
          />
        </TabsContent>
      </Tabs>

      <ReceiptPrintModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />

      <CloseMonthModal
        open={closeConfirmOpen}
        onOpenChange={setCloseConfirmOpen}
        yearMonth={yearMonth}
        isLoading={closeMonthMutation.isPending}
        onConfirm={() => closeMonthMutation.mutate()}
      />
    </div>
  );
}
