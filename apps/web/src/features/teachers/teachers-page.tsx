import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Edit3, Eye, Plus } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, PaginatedResult } from '@edu-center/shared';
import {
  Badge,
  Button,
  Input,
  PageHeader,
  Select,
  ServerDataTable,
  TableColumn,
} from '@/design-system';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient } from '@/lib/api-client';
import { formatDateAr } from '@/lib/formatters';
import { TeacherFormModal } from './teacher-form-modal';
import {
  TEACHER_STATUS_META,
  TEACHER_STATUS_OPTIONS,
  TeacherRow,
} from './teachers.types';

export function TeachersPage() {
  const navigate = useNavigate();

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [specFilter, setSpecFilter] = React.useState('');
  const debouncedSpec = useDebounce(specFilter, 300);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingTeacher, setEditingTeacher] = React.useState<TeacherRow | null>(null);

  const { data, isLoading } = useQuery<PaginatedResult<TeacherRow>>({
    queryKey: ['teachers', page, limit, debouncedSearch, statusFilter, debouncedSpec],
    queryFn: async () => {
      const res = await apiClient.get('/teachers', {
        params: {
          page,
          limit,
          search: debouncedSearch || undefined,
          employmentStatus: statusFilter || undefined,
          specialization: debouncedSpec || undefined,
        },
      });
      return res.data;
    },
  });

  const columns: TableColumn<TeacherRow>[] = [
    {
      key: 'teacherCode',
      header: 'كود المدرس',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-primary">{row.teacherCode}</span>
      ),
    },
    {
      key: 'fullName',
      header: 'اسم المدرس',
      render: (row) => <span className="font-bold text-foreground">{row.fullName}</span>,
    },
    {
      key: 'specialization',
      header: 'التخصص',
      render: (row) => <Badge variant="info">{row.specialization}</Badge>,
    },
    {
      key: 'phone',
      header: 'رقم الهاتف',
      render: (row) => <span dir="ltr">{row.phone}</span>,
    },
    {
      key: 'assignedGroupsCount',
      header: 'المجموعات المسندة',
      render: (row) => (
        <Badge variant="purple">{row.assignedGroupsCount ?? 0} مجموعة</Badge>
      ),
    },
    {
      key: 'bookingsPerm',
      header: 'اعتماد الحجوزات',
      render: (row) =>
        row.canApproveBookings ? (
          <Badge variant="success">مسموح</Badge>
        ) : (
          <Badge variant="neutral">إدارة فقط</Badge>
        ),
    },
    {
      key: 'contractDate',
      header: 'تاريخ التعاقد',
      render: (row) => formatDateAr(row.contractDate),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => {
        const meta = TEACHER_STATUS_META[row.employmentStatus] ?? {
          label: row.employmentStatus,
          variant: 'success' as const,
        };
        return <Badge variant={meta.variant}>{meta.label}</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'إجراءات',
      render: (row) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={() => navigate(`/teachers/${row.id}`)}>
            <Eye className="h-3.5 w-3.5" />
            الملف والمستحقات
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditingTeacher(row);
              setModalOpen(true);
            }}
          >
            <Edit3 className="h-3.5 w-3.5" />
            تعديل
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="إدارة المدرسين والمستحقات الشهرية"
        description="ملفات المدرسين، المجموعات المسندة، أوقات الإتاحة الأسبوعية، وحسابات المستحقات والصرف"
        actions={
          <Button
            onClick={() => {
              setEditingTeacher(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            إضافة مدرس جديد
          </Button>
        }
      />

      <ServerDataTable
        columns={columns}
        data={data?.data ?? []}
        meta={data?.meta}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/teachers/${r.id}`)}
        searchPlaceholder="ابحث باسم المدرس أو الكود أو الهاتف أو التخصص..."
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
            <Input
              placeholder="فلترة بالتخصص..."
              value={specFilter}
              onChange={(e) => {
                setSpecFilter(e.target.value);
                setPage(1);
              }}
              className="w-44"
            />
            <Select
              placeholder="كل حالات التعاقد"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={TEACHER_STATUS_OPTIONS}
              className="w-40"
            />
          </>
        }
      />

      <TeacherFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        teacher={editingTeacher}
      />
    </div>
  );
}
