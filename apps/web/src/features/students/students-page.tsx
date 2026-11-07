import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Edit3, Eye, Plus } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, PaginatedResult } from '@edu-center/shared';
import {
  Badge,
  Button,
  PageHeader,
  Select,
  ServerDataTable,
  TableColumn,
} from '@/design-system';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient } from '@/lib/api-client';
import { formatDateAr } from '@/lib/formatters';
import { StudentFormModal } from './student-form-modal';
import {
  GRADE_LEVEL_OPTIONS,
  STUDENT_STATUS_META,
  STUDENT_STATUS_OPTIONS,
  StudentRow,
} from './students.types';

export function StudentsPage() {
  const navigate = useNavigate();

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [gradeFilter, setGradeFilter] = React.useState('');

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingStudent, setEditingStudent] = React.useState<StudentRow | null>(null);

  const { data, isLoading } = useQuery<PaginatedResult<StudentRow>>({
    queryKey: ['students', page, limit, debouncedSearch, statusFilter, gradeFilter],
    queryFn: async () => {
      const res = await apiClient.get('/students', {
        params: {
          page,
          limit,
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
          gradeLevel: gradeFilter || undefined,
        },
      });
      return res.data;
    },
  });

  const columns: TableColumn<StudentRow>[] = [
    {
      key: 'studentCode',
      header: 'كود الطالب',
      render: (row) => (
        <span className="font-mono text-xs font-bold text-primary">{row.studentCode}</span>
      ),
    },
    {
      key: 'fullName',
      header: 'الاسم الكامل',
      render: (row) => <span className="font-bold text-foreground">{row.fullName}</span>,
    },
    {
      key: 'gradeLevel',
      header: 'الصف الدراسي',
      render: (row) => <Badge variant="info">{row.gradeLevel}</Badge>,
    },
    {
      key: 'phone',
      header: 'هاتف الطالب',
      render: (row) => <span dir="ltr">{row.phone}</span>,
    },
    {
      key: 'guardianPhone',
      header: 'هاتف ولي الأمر',
      render: (row) => <span dir="ltr">{row.guardianPhone}</span>,
    },
    {
      key: 'activeGroupsCount',
      header: 'المجموعات النشطة',
      render: (row) => (
        <Badge variant="purple">{row.activeGroupsCount ?? 0} مجموعة</Badge>
      ),
    },
    {
      key: 'registrationDate',
      header: 'تاريخ التسجيل',
      render: (row) => formatDateAr(row.registrationDate),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => {
        const meta = STUDENT_STATUS_META[row.status] ?? {
          label: row.status,
          variant: 'neutral' as const,
        };
        return <Badge variant={meta.variant}>{meta.label}</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'إجراءات',
      render: (row) => (
        <div
          className="flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/students/${row.id}`)}
          >
            <Eye className="h-3.5 w-3.5" />
            الملف الدائم
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditingStudent(row);
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
        title="إدارة ملفات الطلاب الدائمة"
        description="متابعة بيانات الطلاب، الاشتراكات، السجل الشهري المالي، وسجل الحضور التراكمي"
        actions={
          <Button
            onClick={() => {
              setEditingStudent(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            تسجيل طالب جديد
          </Button>
        }
      />

      <ServerDataTable
        columns={columns}
        data={data?.data ?? []}
        meta={data?.meta}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/students/${r.id}`)}
        searchPlaceholder="ابحث بالاسم أو كود الطالب أو رقم الهاتف أو هاتف ولي الأمر..."
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
              placeholder="كل الصفوف الدراسية"
              value={gradeFilter}
              onChange={(e) => {
                setGradeFilter(e.target.value);
                setPage(1);
              }}
              options={GRADE_LEVEL_OPTIONS}
              className="w-44"
            />
            <Select
              placeholder="كل الحالات"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={STUDENT_STATUS_OPTIONS}
              className="w-40"
            />
          </>
        }
      />

      <StudentFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        student={editingStudent}
      />
    </div>
  );
}
