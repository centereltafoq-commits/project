import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, Clock, PauseCircle, PlayCircle, UserPlus, XCircle } from 'lucide-react';
import {
  DEFAULT_PAGE_SIZE,
  EnrollmentStatus,
  PaginatedResult,
  PERMISSIONS,
} from '@edu-center/shared';
import {
  Badge,
  Button,
  MonthPicker,
  Select,
  ServerDataTable,
  TableColumn,
  useToast,
} from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import {
  formatCurrency,
  formatDateAr,
  formatYearMonthAr,
  getCurrentYearMonth,
} from '@/lib/formatters';
import { SubscribeStudentModal } from './subscribe-student-modal';
import {
  ENROLLMENT_STATUS_OPTIONS,
  EnrollmentMonthPaymentStatus,
  EnrollmentMonthSummary,
  EnrollmentRow,
  GroupDetailData,
} from './groups.types';

const STATUS_BADGE: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  ACTIVE: { label: 'نشط', variant: 'success' },
  PAUSED: { label: 'موقوف مؤقتاً', variant: 'warning' },
  CANCELLED: { label: 'متوقف', variant: 'danger' },
  COMPLETED: { label: 'مكتمل', variant: 'neutral' },
};

const PAYMENT_STATUS_BADGE: Record<
  EnrollmentMonthPaymentStatus,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  PAID: { label: 'مدفوع', variant: 'success' },
  PARTIAL: { label: 'سداد جزئي', variant: 'warning' },
  UNPAID: { label: 'غير مسدد', variant: 'danger' },
  NO_DUES: { label: 'لا توجد مستحقات', variant: 'neutral' },
};

function renderAttendanceSummaryCell(summary?: EnrollmentMonthSummary) {
  if (!summary || summary.totalSessions === 0) {
    return <span className="text-[11px] text-muted-foreground">لا توجد حصص منفذة</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span
        className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300"
        title="حصص الحضور"
      >
        <CheckCircle2 className="h-3 w-3" />
        {summary.presentCount} حاضر
      </span>
      <span
        className="inline-flex items-center gap-0.5 rounded-md bg-rose-500/10 px-1.5 py-0.5 font-semibold text-rose-700 dark:text-rose-300"
        title="حصص الغياب"
      >
        <XCircle className="h-3 w-3" />
        {summary.absentCount} غائب
      </span>
      {summary.excusedCount > 0 && (
        <span
          className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-700 dark:text-amber-300"
          title="غياب بعذر"
        >
          <Clock className="h-3 w-3" />
          {summary.excusedCount} عذر
        </span>
      )}
      <span className="text-muted-foreground">/ {summary.totalSessions}</span>
    </div>
  );
}

function renderPaymentSummaryCell(summary?: EnrollmentMonthSummary) {
  if (!summary || !summary.paymentStatus) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }

  const badgeMeta = PAYMENT_STATUS_BADGE[summary.paymentStatus];
  return (
    <div className="space-y-0.5">
      <Badge variant={badgeMeta.variant} className="text-[11px]">
        {badgeMeta.label}
      </Badge>
      {summary.paymentStatus === 'PAID' && (
        <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
          سُدد {formatCurrency(summary.totalPaid)}
        </p>
      )}
      {summary.paymentStatus === 'PARTIAL' && (
        <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
          دفع {formatCurrency(summary.totalPaid)} • متبقي {formatCurrency(summary.remaining)}
        </p>
      )}
      {summary.paymentStatus === 'UNPAID' && (
        <p className="text-[11px] text-rose-600 font-medium">
          مطلوب {formatCurrency(summary.totalDue)}
        </p>
      )}
    </div>
  );
}

export function GroupEnrollmentsSection({ group }: { group: GroupDetailData }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { hasPermission } = useAuth();
  const canManageEnrollments = hasPermission(PERMISSIONS.ENROLLMENTS_MANAGE);
  const canViewFinance = hasPermission(PERMISSIONS.FINANCE_VIEW);

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [yearMonth, setYearMonth] = React.useState(getCurrentYearMonth);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [subscribeOpen, setSubscribeOpen] = React.useState(false);

  const { data, isLoading } = useQuery<PaginatedResult<EnrollmentRow>>({
    queryKey: [
      'group-enrollments',
      group.id,
      page,
      limit,
      yearMonth,
      debouncedSearch,
      statusFilter,
    ],
    queryFn: async () => {
      const res = await apiClient.get(`/groups/${group.id}/enrollments`, {
        params: {
          page,
          limit,
          yearMonth,
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
        },
      });
      return res.data;
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({
      enrollmentId,
      status,
    }: {
      enrollmentId: string;
      status: EnrollmentStatus;
    }) => apiClient.patch<{ studentId: string }>(`/groups/enrollments/${enrollmentId}`, { status }),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['group-enrollments', group.id] });
      queryClient.invalidateQueries({ queryKey: ['group-detail', group.id] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['classroom-allocated-groups'] });
      queryClient.invalidateQueries({ queryKey: ['classroom-unallocated-groups'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile', data.studentId] });
      notify('تم تحديث حالة اشتراك الطالب مع الاحتفاظ بالسجل التاريخي', 'success');
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const monthLabel = formatYearMonthAr(yearMonth);

  const columns: TableColumn<EnrollmentRow>[] = [
    {
      key: 'student',
      header: 'الطالب',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div>
          <span className="font-bold text-foreground hover:text-primary transition-colors cursor-pointer text-xs">
            {row.studentName}
          </span>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="font-mono">{row.studentCode}</span>
            {row.studentPhone && (
              <>
                <span>•</span>
                <span className="font-mono" dir="ltr">
                  {row.studentPhone}
                </span>
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'attendanceSummary',
      header: `الحضور والغياب (${monthLabel})`,
      className: 'whitespace-nowrap',
      render: (row) => renderAttendanceSummaryCell(row.monthSummary),
    },
    ...(canViewFinance
      ? [
          {
            key: 'paymentSummary',
            header: `سداد (${monthLabel})`,
            className: 'whitespace-nowrap',
            render: (row: EnrollmentRow) => renderPaymentSummaryCell(row.monthSummary),
          },
        ]
      : []),
    {
      key: 'pricing',
      header: 'الاشتراك وتاريخ البدء',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div className="text-xs">
          <div>
            <span className="font-bold text-foreground">{formatCurrency(row.agreedMonthlyPrice)}</span>
            <span className="mr-1 text-[11px] text-emerald-600 font-medium">
              ({formatCurrency(row.agreedSessionPrice)} / حصة)
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            بدء: {formatDateAr(row.startDate)}
            {row.endDate && (
              <span className="mr-1.5 text-rose-600 font-medium">
                • توقف: {formatDateAr(row.endDate)}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'حالة الاشتراك',
      className: 'whitespace-nowrap',
      render: (row) => {
        const meta = STATUS_BADGE[row.status] ?? {
          label: row.status,
          variant: 'neutral' as const,
        };
        return <Badge variant={meta.variant} className="text-xs">{meta.label}</Badge>;
      },
    },
    ...(canManageEnrollments
      ? [
          {
            key: 'actions',
            header: 'إدارة الاشتراك',
            className: 'whitespace-nowrap text-left pl-4',
            render: (row: EnrollmentRow) => (
              <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                {row.status === EnrollmentStatus.ACTIVE ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-2.5 text-xs font-semibold"
                      onClick={() =>
                        statusMutation.mutate({
                          enrollmentId: row.id,
                          status: EnrollmentStatus.PAUSED,
                        })
                      }
                    >
                      <PauseCircle className="h-3.5 w-3.5" />
                      إيقاف مؤقت
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      className="h-8 gap-1 px-2.5 text-xs font-semibold"
                      onClick={() =>
                        statusMutation.mutate({
                          enrollmentId: row.id,
                          status: EnrollmentStatus.CANCELLED,
                        })
                      }
                    >
                      <Ban className="h-3.5 w-3.5" />
                      إنهاء
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="success"
                    className="h-8 gap-1 px-2.5 text-xs font-semibold"
                    onClick={() =>
                      statusMutation.mutate({
                        enrollmentId: row.id,
                        status: EnrollmentStatus.ACTIVE,
                      })
                    }
                  >
                    <PlayCircle className="h-3.5 w-3.5" />
                    استئناف
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  const visibleRows = data?.data ?? [];
  const quickCounts = React.useMemo(() => {
    let paid = 0;
    let partial = 0;
    let unpaid = 0;
    for (const row of visibleRows) {
      const st = row.monthSummary?.paymentStatus;
      if (st === 'PAID') paid += 1;
      else if (st === 'PARTIAL') partial += 1;
      else if (st === 'UNPAID') unpaid += 1;
    }
    return { paid, partial, unpaid };
  }, [visibleRows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-extrabold">سجل اشتراكات الطلاب بالمجموعة</h3>
          {canViewFinance && visibleRows.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300">
                مدفوع: {quickCounts.paid}
              </span>
              <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 font-semibold text-amber-700 dark:text-amber-300">
                جزئي: {quickCounts.partial}
              </span>
              <span className="rounded-full bg-rose-500/10 px-2.5 py-0.5 font-semibold text-rose-700 dark:text-rose-300">
                غير مسدد: {quickCounts.unpaid}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker
            value={yearMonth}
            onChange={(nextMonth) => {
              setYearMonth(nextMonth);
              setPage(1);
            }}
            className="w-44"
          />
          {canManageEnrollments && (
            <Button onClick={() => setSubscribeOpen(true)} className="gap-1.5">
              <UserPlus className="h-4 w-4" />
              تسجيل اشتراك طالب
            </Button>
          )}
        </div>
      </div>

      <ServerDataTable
        columns={columns}
        data={data?.data ?? []}
        meta={data?.meta}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(row) => navigate(`/students/${row.studentId}`)}
        searchPlaceholder="ابحث باسم الطالب أو الكود أو الهاتف..."
        searchValue={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        page={page}
        onPageChange={setPage}
        limit={limit}
        onLimitChange={(l) => {
          setLimit(l);
          setPage(1);
        }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              searchable
              clearable
              placeholder="كل حالات الاشتراك"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={ENROLLMENT_STATUS_OPTIONS}
              className="w-44"
            />
            {(statusFilter || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter('');
                  setSearch('');
                  setPage(1);
                }}
                className="gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                مسح الفلاتر
              </Button>
            )}
          </div>
        }
      />

      <SubscribeStudentModal
        open={subscribeOpen}
        onOpenChange={setSubscribeOpen}
        group={group}
      />
    </div>
  );
}
