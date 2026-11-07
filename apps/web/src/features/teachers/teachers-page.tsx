import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Edit3, Eye, Plus, RotateCcw } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, PaginatedResult, PERMISSIONS } from '@edu-center/shared';
import {
  Badge,
  Button,
  Input,
  PageHeader,
  Select,
  ServerDataTable,
  TableColumn,
} from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient } from '@/lib/api-client';
import { formatDateAr } from '@/lib/formatters';
import { TeacherFormModal } from './teacher-form-modal';
import { TeacherQuickViewModal } from './components/teacher-quick-view-modal';
import {
  TEACHER_STATUS_META,
  TEACHER_STATUS_OPTIONS,
  TeacherRow,
} from './teachers.types';

export function TeachersPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManageTeachers = hasPermission(PERMISSIONS.TEACHERS_MANAGE);

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [specFilter, setSpecFilter] = React.useState('');
  const debouncedSpec = useDebounce(specFilter, 300);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingTeacher, setEditingTeacher] = React.useState<TeacherRow | null>(null);
  const [quickViewTeacher, setQuickViewTeacher] = React.useState<TeacherRow | null>(null);
  const [quickViewOpen, setQuickViewOpen] = React.useState(false);

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
      className: 'whitespace-nowrap font-mono',
      render: (row) => (
        <span className="inline-block rounded-md bg-purple-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-purple-600 dark:text-purple-400">
          {row.teacherCode}
        </span>
      ),
    },
    {
      key: 'fullName',
      header: 'اسم المدرس',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span className="font-bold text-foreground hover:text-primary transition-colors cursor-pointer">
          {row.fullName}
        </span>
      ),
    },
    {
      key: 'specialization',
      header: 'التخصص',
      className: 'whitespace-nowrap',
      render: (row) => <Badge variant="info">{row.specialization}</Badge>,
    },
    {
      key: 'phone',
      header: 'رقم الهاتف',
      className: 'whitespace-nowrap font-mono',
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs font-semibold text-foreground">
          {row.phone || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      className: 'whitespace-nowrap',
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
      className: 'whitespace-nowrap text-left pl-4',
      render: (row) => (
        <div
          className="flex items-center justify-end gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 px-3 text-xs font-bold"
            onClick={() => {
              setQuickViewTeacher(row);
              setQuickViewOpen(true);
            }}
          >
            <Eye className="h-3.5 w-3.5 text-primary" />
            تفاصيل
          </Button>
          {canManageTeachers && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setEditingTeacher(row);
                setModalOpen(true);
              }}
            >
              <Edit3 className="h-3.5 w-3.5" />
              تعديل
            </Button>
          )}
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
          canManageTeachers ? (
            <Button
              onClick={() => {
                setEditingTeacher(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              إضافة مدرس جديد
            </Button>
          ) : null
        }
      />

      <ServerDataTable
        columns={columns}
        data={data?.data ?? []}
        meta={data?.meta}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => {
          setQuickViewTeacher(r);
          setQuickViewOpen(true);
        }}
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
          <div className="flex flex-wrap items-center gap-2">
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
            {(specFilter || statusFilter || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSpecFilter('');
                  setStatusFilter('');
                  setSearch('');
                  setPage(1);
                }}
                className="gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                مسح الفلاتر
              </Button>
            )}
          </div>
        }
      />

      <TeacherFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        teacher={editingTeacher}
      />

      <TeacherQuickViewModal
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
        teacher={quickViewTeacher}
        onEdit={(t) => {
          setEditingTeacher(t);
          setModalOpen(true);
        }}
      />
    </div>
  );
}
