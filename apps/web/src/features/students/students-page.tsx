import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Download,
  Edit3,
  Eye,
  GraduationCap,
  Plus,
  QrCode,
  RotateCcw,
  Upload,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';
import { DEFAULT_PAGE_SIZE, PaginatedResult, PERMISSIONS, StudentStatus } from '@edu-center/shared';
import {
  Badge,
  Button,
  Card,
  PageHeader,
  Select,
  ServerDataTable,
  TableColumn,
  useToast,
} from '@/design-system';
import { ExcelImportModal } from '@/components/excel-import-modal';
import { useAuth } from '@/features/auth/auth-context';
import { useCenterSettings } from '@/features/settings/center-settings-context';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { downloadBlobFile } from '@/lib/file-download';
import { formatDateAr } from '@/lib/formatters';
import { printStudentQrCard } from '@/lib/print-service';
import { GradeLevelsModal } from '../grade-levels/grade-levels-modal';
import { useGradeLevels } from '../grade-levels/use-grade-levels';
import { StudentFormModal } from './student-form-modal';
import { StudentQuickViewModal } from './components/student-quick-view-modal';
import { StudentQrPdfModal } from './components/student-qr-pdf-modal';
import {
  STUDENT_STATUS_META,
  STUDENT_STATUS_OPTIONS,
  StudentRow,
  StudentsSummary,
} from './students.types';

export function StudentsPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const { hasPermission } = useAuth();
  const { settings } = useCenterSettings();
  const canCreate = hasPermission(PERMISSIONS.STUDENTS_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.STUDENTS_UPDATE);
  const canExport =
    hasPermission(PERMISSIONS.STUDENTS_VIEW) && hasPermission(PERMISSIONS.REPORTS_EXPORT);
  const canManageGradeLevels = hasPermission(PERMISSIONS.GROUPS_MANAGE);

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [gradeFilter, setGradeFilter] = React.useState('');

  const [modalOpen, setModalOpen] = React.useState(false);
  const [importModalOpen, setImportModalOpen] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [editingStudent, setEditingStudent] = React.useState<StudentRow | null>(null);
  const [quickViewStudent, setQuickViewStudent] = React.useState<StudentRow | null>(null);
  const [quickViewOpen, setQuickViewOpen] = React.useState(false);
  const [gradeLevelsModalOpen, setGradeLevelsModalOpen] = React.useState(false);
  const [qrPdfModalOpen, setQrPdfModalOpen] = React.useState(false);
  const { options: dynamicGradeOptions } = useGradeLevels(false);
  const baseGradeOptions = dynamicGradeOptions;

  const { data, isLoading } = useQuery<PaginatedResult<StudentRow> & { summary?: StudentsSummary }>({
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

  const gradeOptions = React.useMemo(() => {
    const map = new Map(baseGradeOptions.map((o) => [o.value, o]));
    for (const row of data?.data ?? []) {
      if (row.gradeLevel && !map.has(row.gradeLevel)) {
        map.set(row.gradeLevel, { value: row.gradeLevel, label: row.gradeLevel });
      }
    }
    if (gradeFilter && !map.has(gradeFilter)) {
      map.set(gradeFilter, { value: gradeFilter, label: gradeFilter });
    }
    return Array.from(map.values());
  }, [baseGradeOptions, data?.data, gradeFilter]);

  const columns: TableColumn<StudentRow>[] = [
    {
      key: 'studentCode',
      header: 'كود الطالب',
      className: 'whitespace-nowrap font-mono',
      render: (row) => (
        <span className="inline-block rounded-md bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
          {row.studentCode}
        </span>
      ),
    },
    {
      key: 'fullName',
      header: 'الاسم الكامل',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span className="font-bold text-foreground hover:text-primary transition-colors cursor-pointer">
          {row.fullName}
        </span>
      ),
    },
    {
      key: 'gradeLevel',
      header: 'الصف الدراسي',
      className: 'whitespace-nowrap',
      render: (row) => <Badge variant="info">{row.gradeLevel}</Badge>,
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
            onClick={() => navigate(`/students/${row.id}`)}
          >
            <GraduationCap className="h-3.5 w-3.5" />
            ملف الطالب
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2.5 text-xs font-bold"
            title="بطاقة سريعة"
            onClick={() => {
              setQuickViewStudent(row);
              setQuickViewOpen(true);
            }}
          >
            <Eye className="h-3.5 w-3.5 text-primary" />
            سريع
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2.5 text-xs font-bold"
            title="طباعة كارت QR"
            onClick={() =>
              printStudentQrCard({
                student: {
                  studentCode: row.studentCode,
                  fullName: row.fullName,
                  gradeLevel: row.gradeLevel,
                  phone: row.phone,
                  guardianPhone: row.guardianPhone,
                },
                settings,
              })
            }
          >
            <QrCode className="h-3.5 w-3.5 text-emerald-600" />
            QR
          </Button>
          {canUpdate && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setEditingStudent(row);
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
        '/students/export',
        `students-${today}.xlsx`,
        {
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
          gradeLevel: gradeFilter || undefined,
        },
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      notify('تم تصدير سجل الطلاب بصيغة Excel بنجاح', 'success');
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const summary: StudentsSummary = data?.summary ?? {
    totalCount: data?.meta?.totalItems ?? 0,
    activeCount: 0,
    inactiveCount: 0,
  };

  const studentSummaryCards = [
    {
      key: 'total',
      label: 'إجمالي الطلاب',
      value: summary.totalCount,
      subtitle: 'جميع ملفات الطلاب المسجلة',
      icon: Users,
      iconClass: 'bg-primary/10 text-primary',
      activeRing: statusFilter === '' ? 'border-primary/40 shadow-sm' : '',
      onClick: () => {
        setStatusFilter('');
        setPage(1);
      },
    },
    {
      key: 'active',
      label: 'الطلاب النشطين',
      value: summary.activeCount,
      subtitle: 'الملفات المفعّلة حالياً',
      icon: UserCheck,
      iconClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
      activeRing: statusFilter === StudentStatus.ACTIVE ? 'border-emerald-500/50 shadow-sm' : '',
      onClick: () => {
        setStatusFilter(statusFilter === StudentStatus.ACTIVE ? '' : StudentStatus.ACTIVE);
        setPage(1);
      },
    },
    {
      key: 'inactive',
      label: 'الطلاب غير النشطين',
      value: summary.inactiveCount,
      subtitle: 'موقوف مؤقتاً أو مؤرشف',
      icon: UserX,
      iconClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
      activeRing:
        statusFilter === StudentStatus.SUSPENDED || statusFilter === StudentStatus.ARCHIVED
          ? 'border-amber-500/50 shadow-sm'
          : '',
      onClick: () => {
        setStatusFilter(
          statusFilter === StudentStatus.SUSPENDED ? StudentStatus.ARCHIVED : StudentStatus.SUSPENDED,
        );
        setPage(1);
      },
    },
  ] as const;

  return (
    <div>
      <PageHeader
        title="إدارة ملفات الطلاب الدائمة"
        description="متابعة بيانات الطلاب، الاشتراكات، السجل الشهري المالي، وسجل الحضور التراكمي"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setQrPdfModalOpen(true)}
              className="h-9 gap-1.5 px-3 border-primary/35 text-primary hover:bg-primary/5"
            >
              <QrCode className="h-3.5 w-3.5" />
              كروت QR للطلاب (PDF)
            </Button>
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
            {canCreate && (
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
            {canManageGradeLevels && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setGradeLevelsModalOpen(true)}
                className="h-9 gap-1.5 px-3"
              >
                <GraduationCap className="h-3.5 w-3.5" />
                الصفوف الدراسية
              </Button>
            )}
            {canCreate && (
              <Button
                size="sm"
                onClick={() => {
                  setEditingStudent(null);
                  setModalOpen(true);
                }}
                className="h-9 gap-1.5 px-3.5"
              >
                <Plus className="h-3.5 w-3.5" />
                تسجيل طالب جديد
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {studentSummaryCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.key}
              role="button"
              tabIndex={0}
              onClick={item.onClick}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  item.onClick();
                }
              }}
              className={`cursor-pointer p-4 transition-all hover:border-primary/40 ${item.activeRing}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground">{item.label}</p>
                  <p className="text-2xl font-extrabold text-foreground">
                    {item.value.toLocaleString('en-US')}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{item.subtitle}</p>
                </div>
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.iconClass}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

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
          <div className="flex flex-wrap items-center gap-2">
            <Select
              searchable
              clearable
              searchPlaceholder="ابحث في الصفوف..."
              placeholder="كل الصفوف الدراسية"
              value={gradeFilter}
              onChange={(e) => {
                setGradeFilter(e.target.value);
                setPage(1);
              }}
              options={gradeOptions}
              className="w-48"
            />
            <Select
              searchable
              clearable
              placeholder="كل الحالات"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={STUDENT_STATUS_OPTIONS}
              className="w-40"
            />
            {(gradeFilter || statusFilter || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setGradeFilter('');
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

      <StudentFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        student={editingStudent}
      />

      <StudentQuickViewModal
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
        student={quickViewStudent}
        onEdit={(st) => {
          setEditingStudent(st);
          setModalOpen(true);
        }}
      />

      <GradeLevelsModal
        open={gradeLevelsModalOpen}
        onOpenChange={setGradeLevelsModalOpen}
      />

      {qrPdfModalOpen && (
        <StudentQrPdfModal
          open={qrPdfModalOpen}
          onOpenChange={setQrPdfModalOpen}
          initialGradeFilter={gradeFilter}
        />
      )}

      <ExcelImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        title="استيراد بيانات الطلاب من Excel"
        entityLabelPlural="الطلاب"
        templateUrl="/students/import/template"
        templateFilename="students-import-template.xlsx"
        previewUrl="/students/import/preview"
        commitUrl="/students/import/commit"
        previewColumns={[
          { key: 'fullName', label: 'اسم الطالب' },
          { key: 'phone', label: 'هاتف الطالب', dir: 'ltr' },
          { key: 'guardianPhone', label: 'هاتف ولي الأمر', dir: 'ltr' },
          { key: 'gradeLevel', label: 'الصف الدراسي' },
        ]}
        invalidateQueryKeys={[
          ['students'],
          ['dashboard-summary'],
          ['reports-filter-options'],
          ['report-data', 'students'],
        ]}
      />
    </div>
  );
}
