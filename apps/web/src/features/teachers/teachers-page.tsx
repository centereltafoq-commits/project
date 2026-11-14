import * as React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Download, Edit3, ExternalLink, Eye, Plus, RotateCcw, Upload } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, PaginatedResult, PERMISSIONS } from '@edu-center/shared';
import {
  Badge,
  Button,
  Input,
  PageHeader,
  Select,
  ServerDataTable,
  TableColumn,
  useToast,
} from '@/design-system';
import { ExcelImportModal } from '@/components/excel-import-modal';
import { useAuth } from '@/features/auth/auth-context';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { downloadBlobFile } from '@/lib/file-download';
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
  const { notify } = useToast();
  const { hasPermission } = useAuth();
  const canViewAllTeachers = hasPermission(PERMISSIONS.TEACHERS_VIEW);
  const canViewOwnTeacher = hasPermission(PERMISSIONS.TEACHERS_VIEW_OWN);
  const canManageTeachers = hasPermission(PERMISSIONS.TEACHERS_MANAGE);
  const canExport =
    canViewAllTeachers && hasPermission(PERMISSIONS.REPORTS_EXPORT);

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [specFilter, setSpecFilter] = React.useState('');
  const debouncedSpec = useDebounce(specFilter, 300);

  const [modalOpen, setModalOpen] = React.useState(false);
  const [importModalOpen, setImportModalOpen] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [editingTeacher, setEditingTeacher] = React.useState<TeacherRow | null>(null);
  const [quickViewTeacher, setQuickViewTeacher] = React.useState<TeacherRow | null>(null);
  const [quickViewOpen, setQuickViewOpen] = React.useState(false);

  const { data: ownProfile, isLoading: ownLoading } = useQuery<{ teacher: { id: string } }>({
    queryKey: ['teacher-own-profile-redirect'],
    enabled: !canViewAllTeachers && canViewOwnTeacher,
    queryFn: async () => (await apiClient.get('/teachers/me/profile')).data,
  });

  const { data, isLoading } = useQuery<PaginatedResult<TeacherRow>>({
    queryKey: ['teachers', page, limit, debouncedSearch, statusFilter, debouncedSpec],
    enabled: canViewAllTeachers,
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

  if (!canViewAllTeachers && canViewOwnTeacher) {
    if (ownLoading) {
      return <div className="h-32 animate-pulse rounded-xl bg-muted" />;
    }
    if (ownProfile?.teacher?.id) {
      return <Navigate to={`/teachers/${ownProfile.teacher.id}`} replace />;
    }
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        لا يوجد ملف مدرس مرتبط بحسابك الحالي. يرجى مراجعة إدارة السنتر.
      </div>
    );
  }

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
            variant="primary"
            className="h-8 gap-1.5 px-3 text-xs font-bold"
            onClick={() => navigate(`/teachers/${row.id}`)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            ملف المدرس
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 px-2.5 text-xs font-bold"
            onClick={() => {
              setQuickViewTeacher(row);
              setQuickViewOpen(true);
            }}
          >
            <Eye className="h-3.5 w-3.5 text-primary" />
            نظرة سريعة
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

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await downloadBlobFile(
        '/teachers/export',
        `teachers-${today}.xlsx`,
        {
          search: debouncedSearch || undefined,
          employmentStatus: statusFilter || undefined,
          specialization: debouncedSpec || undefined,
        },
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      notify('تم تصدير سجل المدرسين بصيغة Excel بنجاح', 'success');
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="إدارة المدرسين والمستحقات الشهرية"
        description="ملفات المدرسين، المجموعات المسندة، أوقات الإتاحة الأسبوعية، وحسابات المستحقات والصرف"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canExport && (
              <Button
                size="sm"
                variant="success"
                onClick={handleExportExcel}
                isLoading={isExporting}
                className="h-9 gap-1.5 px-3"
              >
                <Download className="h-3.5 w-3.5" />
                تصدير Excel
              </Button>
            )}
            {canManageTeachers && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setImportModalOpen(true)}
                className="h-9 gap-1.5 px-3"
              >
                <Upload className="h-3.5 w-3.5" />
                استيراد من Excel
              </Button>
            )}
            {canManageTeachers && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingTeacher(null);
                  setModalOpen(true);
                }}
                className="h-9 gap-1.5 px-3.5"
              >
                <Plus className="h-3.5 w-3.5" />
                إضافة مدرس جديد
              </Button>
            )}
          </div>
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
              searchable
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

      <ExcelImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        title="استيراد بيانات المدرسين من Excel"
        entityLabelPlural="المدرسين"
        templateUrl="/teachers/import/template"
        templateFilename="teachers-import-template.xlsx"
        previewUrl="/teachers/import/preview"
        commitUrl="/teachers/import/commit"
        previewColumns={[
          { key: 'fullName', label: 'اسم المدرس' },
          { key: 'phone', label: 'رقم الهاتف', dir: 'ltr' },
          { key: 'specialization', label: 'التخصص' },
        ]}
        invalidateQueryKeys={[['teachers']]}
      />
    </div>
  );
}
