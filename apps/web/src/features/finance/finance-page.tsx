import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Calculator,
  CalendarDays,
  GraduationCap,
  Lock,
  Receipt,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Badge,
  Button,
  MonthPicker,
  PageHeader,
  StatCard,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from '@/design-system';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import {
  formatCurrency,
  formatYearMonthAr,
  getCurrentYearMonth,
} from '@/lib/formatters';
import {
  FinanceLookups,
  MonthExecutiveSummary,
  PaymentRow,
} from './finance.types';
import { CloseMonthModal } from './modals/close-month-modal';
import { ReceiptPrintModal } from './modals/receipt-print-modal';
import { AssistantDuesTab } from './tabs/assistant-dues-tab';
import { ExpensesTab } from './tabs/expenses-tab';
import { PaymentsHistoryTab } from './tabs/payments-history-tab';
import { StudentBillingTab } from './tabs/student-billing-tab';
import { TeacherDuesTab } from './tabs/teacher-dues-tab';

export function FinancePage() {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const [yearMonth, setYearMonth] = React.useState(getCurrentYearMonth());
  const [closeConfirmOpen, setCloseConfirmOpen] = React.useState(false);
  const [activeReceipt, setActiveReceipt] = React.useState<PaymentRow | null>(null);

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
            <div className="flex items-center gap-2">
              <MonthPicker
                value={yearMonth}
                onChange={setYearMonth}
              />
              {summary?.isMonthClosed && (
                <Badge variant="purple" className="gap-1 whitespace-nowrap">
                  <Lock className="h-3 w-3" />
                  مغلق
                </Badge>
              )}
            </div>

            <Button
              variant="outline"
              isLoading={recalculateMutation.isPending}
              onClick={() => recalculateMutation.mutate()}
              className="gap-1.5"
            >
              <Calculator className="h-4 w-4" />
              إعادة احتساب الشهر
            </Button>

            <Button
              variant="danger"
              disabled={summary?.isMonthClosed}
              onClick={() => setCloseConfirmOpen(true)}
              className="gap-1.5"
            >
              <Lock className="h-4 w-4" />
              إغلاق الشهر مالياً
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 no-print">
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
      </div>

      <Tabs defaultValue="student-billing">
        <TabsList className="no-print">
          <TabsTrigger value="student-billing">
            <GraduationCap className="h-4 w-4" />
            تحصيل ومستحقات الطلاب
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
            lookups={lookups}
            onShowReceipt={(r) => setActiveReceipt(r)}
          />
        </TabsContent>
        <TabsContent value="payments-history">
          <PaymentsHistoryTab
            yearMonth={yearMonth}
            onShowReceipt={(r) => setActiveReceipt(r)}
          />
        </TabsContent>
        <TabsContent value="teacher-dues">
          <TeacherDuesTab yearMonth={yearMonth} lookups={lookups} />
        </TabsContent>
        <TabsContent value="assistant-dues">
          <AssistantDuesTab yearMonth={yearMonth} lookups={lookups} />
        </TabsContent>
        <TabsContent value="expenses">
          <ExpensesTab yearMonth={yearMonth} />
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
