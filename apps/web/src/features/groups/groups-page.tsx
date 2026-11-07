import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Edit3, Eye, GraduationCap, Plus } from 'lucide-react';
import {
  DEFAULT_PAGE_SIZE,
  GroupRevenueSplitMethod,
  PaginatedResult,
} from '@edu-center/shared';
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
import { formatCurrency } from '@/lib/formatters';
import { GradeLevelsModal } from '../grade-levels/grade-levels-modal';
import { useGradeLevels } from '../grade-levels/use-grade-levels';
import { GRADE_LEVEL_OPTIONS } from '../students/students.types';
import { GroupFormModal } from './group-form-modal';
import { GroupDetailData, GroupRow } from './groups.types';

export function GroupsPage() {
  const navigate = useNavigate();

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [gradeFilter, setGradeFilter] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState('');

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingGroupId, setEditingGroupId] = React.useState<string | null>(null);
  const [gradeLevelsModalOpen, setGradeLevelsModalOpen] = React.useState(false);

  const { options: dynamicGradeOptions } = useGradeLevels(true);
  const gradeOptions = dynamicGradeOptions.length > 0 ? dynamicGradeOptions : GRADE_LEVEL_OPTIONS;

  const { data, isLoading } = useQuery<PaginatedResult<GroupRow>>({
    queryKey: ['groups', page, limit, debouncedSearch, gradeFilter, activeFilter],
    queryFn: async () => {
      const res = await apiClient.get('/groups', {
        params: {
          page,
          limit,
          search: debouncedSearch || undefined,
          gradeLevel: gradeFilter || undefined,
          isActive: activeFilter || undefined,
        },
      });
      return res.data;
    },
  });

  const { data: editingDetail } = useQuery<GroupDetailData>({
    queryKey: ['group-detail', editingGroupId],
    enabled: Boolean(editingGroupId && modalOpen),
    queryFn: async () => (await apiClient.get(`/groups/${editingGroupId}`)).data,
  });

  const columns: TableColumn<GroupRow>[] = [
    {
      key: 'name',
      header: 'المجموعة',
      render: (row) => (
        <div>
          <p className="font-bold text-foreground">{row.name}</p>
          <p className="font-mono text-xs text-primary">{row.groupCode}</p>
        </div>
      ),
    },
    {
      key: 'subjectGrade',
      header: 'المادة والصف',
      render: (row) => (
        <div>
          <p className="font-semibold">{row.subject}</p>
          <p className="text-xs text-muted-foreground">{row.gradeLevel}</p>
        </div>
      ),
    },
    {
      key: 'teacher',
      header: 'المدرس الأساسي',
      render: (row) => <span className="font-semibold">{row.primaryTeacherName}</span>,
    },
    {
      key: 'students',
      header: 'المشتركون النشطون',
      render: (row) => (
        <Badge variant="purple">
          {row.activeStudentsCount} / {row.maxStudents} طالب
        </Badge>
      ),
    },
    {
      key: 'monthlyPrice',
      header: 'الاشتراك الشهري',
      render: (row) => (
        <div>
          <p className="font-bold">{formatCurrency(row.monthlyPrice)}</p>
          <p className="text-xs text-muted-foreground">{row.monthlySessionsCount} حصص شهرياً</p>
        </div>
      ),
    },
    {
      key: 'sessionPrice',
      header: 'سعر الحصة',
      render: (row) => (
        <span className="font-semibold text-emerald-600">
          {formatCurrency(row.calculatedSessionPrice)}
        </span>
      ),
    },
    {
      key: 'split',
      header: 'تقسيم المدرس / السنتر',
      render: (row) =>
        row.revenueSplitMethod === GroupRevenueSplitMethod.CUSTOM_PERCENTAGE ? (
          <Badge variant="info">نسبة المدرس: {Number(row.teacherPercentage ?? 0)}%</Badge>
        ) : (
          <span className="text-xs font-semibold">
            {formatCurrency(row.teacherSharePerStudent)} /{' '}
            {formatCurrency(row.centerSharePerStudent)}
          </span>
        ),
    },
    {
      key: 'actions',
      header: 'إجراءات',
      render: (row) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="outline" onClick={() => navigate(`/groups/${row.id}`)}>
            <Eye className="h-3.5 w-3.5" />
            الاشتراكات والتفاصيل
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditingGroupId(row.id);
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
        title="المجموعات الدراسية والاشتراكات والسياسات المالية"
        description="إدارة المجموعات، تسعير الحصص التلقائي، قواعد تقسيم العائد، واشتراكات الطلاب المرنة"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setGradeLevelsModalOpen(true)}
              className="gap-1.5"
            >
              <GraduationCap className="h-4 w-4" />
              إدارة الصفوف الدراسية
            </Button>
            <Button
              onClick={() => {
                setEditingGroupId(null);
                setModalOpen(true);
              }}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              إنشاء مجموعة جديدة
            </Button>
          </div>
        }
      />

      <ServerDataTable
        columns={columns}
        data={data?.data ?? []}
        meta={data?.meta}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/groups/${r.id}`)}
        searchPlaceholder="ابحث باسم المجموعة أو الكود أو المادة..."
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
              options={gradeOptions}
              className="w-44"
            />
            <Select
              placeholder="كل الحالات"
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value);
                setPage(1);
              }}
              options={[
                { value: 'true', label: 'نشطة فقط' },
                { value: 'false', label: 'متوقفة' },
              ]}
              className="w-36"
            />
          </>
        }
      />

      <GroupFormModal
        open={modalOpen}
        onOpenChange={(o) => {
          setModalOpen(o);
          if (!o) setEditingGroupId(null);
        }}
        group={editingGroupId ? editingDetail ?? null : null}
      />

      <GradeLevelsModal
        open={gradeLevelsModalOpen}
        onOpenChange={setGradeLevelsModalOpen}
      />
    </div>
  );
}
