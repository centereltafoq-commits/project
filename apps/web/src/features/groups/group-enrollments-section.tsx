import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, PauseCircle, PlayCircle, UserPlus } from 'lucide-react';
import {
  DEFAULT_PAGE_SIZE,
  EnrollmentStatus,
  PaginatedResult,
  PERMISSIONS,
} from '@edu-center/shared';
import {
  Badge,
  Button,
  Select,
  ServerDataTable,
  TableColumn,
  useToast,
} from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { formatCurrency, formatDateAr } from '@/lib/formatters';
import { SubscribeStudentModal } from './subscribe-student-modal';
import {
  ENROLLMENT_STATUS_OPTIONS,
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

export function GroupEnrollmentsSection({ group }: { group: GroupDetailData }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { hasPermission } = useAuth();
  const canManageEnrollments = hasPermission(PERMISSIONS.ENROLLMENTS_MANAGE);

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [subscribeOpen, setSubscribeOpen] = React.useState(false);

  const { data, isLoading } = useQuery<PaginatedResult<EnrollmentRow>>({
    queryKey: ['group-enrollments', group.id, page, limit, debouncedSearch, statusFilter],
    queryFn: async () => {
      const res = await apiClient.get(`/groups/${group.id}/enrollments`, {
        params: {
          page,
          limit,
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
          <p className="font-mono text-[11px] text-muted-foreground">{row.studentCode}</p>
        </div>
      ),
    },
    {
      key: 'phones',
      header: 'هاتف الطالب / ولي الأمر',
      className: 'whitespace-nowrap font-mono',
      render: (row) => (
        <div className="text-xs" dir="ltr">
          <div className="font-mono text-xs">{row.studentPhone || '—'}</div>
          <div className="text-[11px] text-muted-foreground">{row.guardianPhone || '—'}</div>
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'تاريخ البدء / التوقف',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div className="text-xs">
          <div>البدء: {formatDateAr(row.startDate)}</div>
          {row.endDate && <div className="text-rose-600 font-medium">التوقف: {formatDateAr(row.endDate)}</div>}
        </div>
      ),
    },
    {
      key: 'pricing',
      header: 'الاشتراك / سعر الحصة',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div className="text-xs">
          <span className="font-bold text-foreground">{formatCurrency(row.agreedMonthlyPrice)}</span>
          <span className="mr-1 text-[11px] text-emerald-600 font-medium">
            ({formatCurrency(row.agreedSessionPrice)} / حصة)
          </span>
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-extrabold">سجل اشتراكات الطلاب بالمجموعة</h3>
        {canManageEnrollments && (
          <Button onClick={() => setSubscribeOpen(true)} className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            تسجيل اشتراك طالب
          </Button>
        )}
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
