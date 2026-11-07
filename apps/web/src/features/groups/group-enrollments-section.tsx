import * as React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, PauseCircle, PlayCircle, UserPlus } from 'lucide-react';
import {
  DEFAULT_PAGE_SIZE,
  EnrollmentStatus,
  PaginatedResult,
} from '@edu-center/shared';
import {
  Badge,
  Button,
  Select,
  ServerDataTable,
  TableColumn,
  useToast,
} from '@/design-system';
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
  const { notify } = useToast();

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
    }) => apiClient.patch(`/groups/enrollments/${enrollmentId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-enrollments', group.id] });
      queryClient.invalidateQueries({ queryKey: ['group-detail', group.id] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      notify('تم تحديث حالة اشتراك الطالب مع الاحتفاظ بالسجل التاريخي', 'success');
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const columns: TableColumn<EnrollmentRow>[] = [
    {
      key: 'student',
      header: 'الطالب',
      render: (row) => (
        <div>
          <Link
            to={`/students/${row.studentId}`}
            className="font-bold text-primary hover:underline"
          >
            {row.studentName}
          </Link>
          <p className="font-mono text-xs text-muted-foreground">{row.studentCode}</p>
        </div>
      ),
    },
    {
      key: 'phones',
      header: 'هاتف الطالب / ولي الأمر',
      render: (row) => (
        <div className="text-xs" dir="ltr">
          <div>{row.studentPhone}</div>
          <div className="text-muted-foreground">{row.guardianPhone}</div>
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'تاريخ البدء / التوقف',
      render: (row) => (
        <div className="text-xs">
          <div>البدء: {formatDateAr(row.startDate)}</div>
          {row.endDate && <div className="text-rose-600">التوقف: {formatDateAr(row.endDate)}</div>}
        </div>
      ),
    },
    {
      key: 'pricing',
      header: 'الاشتراك / سعر الحصة',
      render: (row) => (
        <div>
          <span className="font-bold">{formatCurrency(row.agreedMonthlyPrice)}</span>
          <span className="mr-1 text-xs text-muted-foreground">
            ({formatCurrency(row.agreedSessionPrice)} للحصة)
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'حالة الاشتراك',
      render: (row) => {
        const meta = STATUS_BADGE[row.status] ?? {
          label: row.status,
          variant: 'neutral' as const,
        };
        return <Badge variant={meta.variant}>{meta.label}</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'إدارة الاشتراك',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {row.status === EnrollmentStatus.ACTIVE ? (
            <>
              <Button
                size="sm"
                variant="outline"
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
                onClick={() =>
                  statusMutation.mutate({
                    enrollmentId: row.id,
                    status: EnrollmentStatus.CANCELLED,
                  })
                }
              >
                <Ban className="h-3.5 w-3.5" />
                إنهاء الاشتراك
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="success"
              onClick={() =>
                statusMutation.mutate({
                  enrollmentId: row.id,
                  status: EnrollmentStatus.ACTIVE,
                })
              }
            >
              <PlayCircle className="h-3.5 w-3.5" />
              استئناف الاشتراك
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-extrabold">سجل اشتراكات الطلاب بالمجموعة</h3>
        <Button onClick={() => setSubscribeOpen(true)}>
          <UserPlus className="h-4 w-4" />
          تسجيل اشتراك طالب (يدعم منتصف الشهر)
        </Button>
      </div>

      <ServerDataTable
        columns={columns}
        data={data?.data ?? []}
        meta={data?.meta}
        isLoading={isLoading}
        rowKey={(r) => r.id}
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
          <Select
            placeholder="كل حالات الاشتراك"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={ENROLLMENT_STATUS_OPTIONS}
            className="w-44"
          />
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
