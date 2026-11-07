import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Edit3, Plus } from 'lucide-react';
import {
  DEFAULT_PAGE_SIZE,
  MakeupStatus,
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
import {
  AttendanceLookups,
  MAKEUP_STATUS_META,
  MakeupSessionRow,
} from './attendance.types';
import { MakeupModal } from './makeup-modal';

interface MakeupsTabProps {
  lookups?: AttendanceLookups;
}

export function MakeupsTab({ lookups }: MakeupsTabProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { hasPermission } = useAuth();
  const canManageMakeup = hasPermission(PERMISSIONS.MAKEUP_MANAGE);

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [studentFilter, setStudentFilter] = React.useState('');

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingRow, setEditingRow] = React.useState<MakeupSessionRow | null>(null);

  const { data, isLoading } = useQuery<PaginatedResult<MakeupSessionRow>>({
    queryKey: ['attendance-makeups', page, limit, debouncedSearch, statusFilter, studentFilter],
    queryFn: async () => {
      const res = await apiClient.get('/attendance/makeups', {
        params: {
          page,
          limit,
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
          studentId: studentFilter || undefined,
        },
      });
      return res.data;
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) =>
      apiClient.patch(`/attendance/makeups/${id}`, { status: MakeupStatus.COMPLETED }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-makeups'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      notify('تم إثبات حضور الحصة التعويضية وتحديث سجل الحضور الأصلي', 'success');
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const columns: TableColumn<MakeupSessionRow>[] = [
    {
      key: 'student',
      header: 'الطالب',
      render: (row) => (
        <div>
          <div className="font-bold text-foreground">{row.studentName}</div>
          <div className="text-xs text-muted-foreground">{row.studentCode}</div>
        </div>
      ),
    },
    {
      key: 'original',
      header: 'الحصة الأصلية وتاريخ الغياب',
      render: (row) => (
        <div>
          <div className="font-semibold text-foreground">{row.groupName}</div>
          <div className="text-xs text-muted-foreground">
            غياب بتاريخ: {formatDateAr(row.absenceDate)}
          </div>
        </div>
      ),
    },
    {
      key: 'scheduledAt',
      header: 'موعد التعويض والقاعة',
      render: (row) => (
        <div>
          <div className="font-medium text-foreground">
            {row.scheduledAt
              ? new Date(row.scheduledAt).toLocaleString('ar-EG', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : 'غير محدد بعد'}
          </div>
          <div className="text-xs text-muted-foreground">
            {row.classroomName ? `${row.classroomName} (${row.roomNumber})` : 'بدون قاعة'}
          </div>
        </div>
      ),
    },
    {
      key: 'fee',
      header: 'التكلفة',
      render: (row) =>
        row.isFree ? (
          <Badge variant="success">مجاني</Badge>
        ) : (
          <Badge variant="warning">{formatCurrency(row.extraFee)}</Badge>
        ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => {
        const meta = MAKEUP_STATUS_META[row.status] ?? {
          label: row.status,
          variant: 'neutral' as const,
        };
        return <Badge variant={meta.variant}>{meta.label}</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'إجراءات',
      render: (row) =>
        canManageMakeup ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {row.status !== MakeupStatus.COMPLETED && row.status !== MakeupStatus.CANCELLED && (
              <Button
                size="sm"
                variant="success"
                onClick={() => completeMutation.mutate(row.id)}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                إثبات الحضور
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingRow(row);
                setModalOpen(true);
              }}
            >
              <Edit3 className="h-3.5 w-3.5" />
              تعديل
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      {canManageMakeup && (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setEditingRow(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            جدولة حصة تعويضية
          </Button>
        </div>
      )}

      <ServerDataTable
        columns={columns}
        data={data?.data ?? []}
        meta={data?.meta}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        searchPlaceholder="ابحث باسم الطالب أو الكود أو اسم المجموعة..."
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
          <>
            <Select
              placeholder="كل الطلاب"
              value={studentFilter}
              onChange={(e) => {
                setStudentFilter(e.target.value);
                setPage(1);
              }}
              options={(lookups?.students ?? []).map((s) => ({
                value: s.id,
                label: `${s.fullName} (${s.studentCode})`,
              }))}
              className="w-48"
            />
            <Select
              placeholder="كل الحالات"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: MakeupStatus.PENDING, label: 'قيد الانتظار' },
                { value: MakeupStatus.SCHEDULED, label: 'مجدولة' },
                { value: MakeupStatus.COMPLETED, label: 'تم الحضور' },
                { value: MakeupStatus.CANCELLED, label: 'ملغاة' },
              ]}
              className="w-40"
            />
          </>
        }
      />

      <MakeupModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editingRow={editingRow}
        lookups={lookups}
      />
    </div>
  );
}
