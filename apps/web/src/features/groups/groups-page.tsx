import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Edit3, Eye, GraduationCap, Plus, RotateCcw, Users } from 'lucide-react';
import {
  DEFAULT_PAGE_SIZE,
  PaginatedResult,
  PERMISSIONS,
} from '@edu-center/shared';
import {
  Badge,
  Button,
  PageHeader,
  Select,
  ServerDataTable,
  TableColumn,
} from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient } from '@/lib/api-client';
import { ARABIC_DAYS, formatCurrency } from '@/lib/formatters';
import { GradeLevelsModal } from '../grade-levels/grade-levels-modal';
import { useGradeLevels } from '../grade-levels/use-grade-levels';
import { GRADE_LEVEL_OPTIONS } from '../students/students.types';
import { GroupFormModal } from './group-form-modal';
import { GroupQuickViewModal } from './components/group-quick-view-modal';
import { GroupDetailData, GroupRow } from './groups.types';

export function GroupsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManageGroups = hasPermission(PERMISSIONS.GROUPS_MANAGE);

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [gradeFilter, setGradeFilter] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState('');

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingGroupId, setEditingGroupId] = React.useState<string | null>(null);
  const [quickViewGroup, setQuickViewGroup] = React.useState<GroupRow | null>(null);
  const [quickViewOpen, setQuickViewOpen] = React.useState(false);
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
      className: 'w-[23%] min-w-[150px] px-2.5 truncate',
      headerClassName: 'w-[23%] min-w-[150px] px-2.5',
      render: (row) => (
        <div onClick={() => navigate(`/groups/${row.id}`)} className="truncate">
          <p
            className="font-bold text-foreground hover:text-primary transition-colors cursor-pointer truncate leading-snug"
            title={row.name}
          >
            {row.name}
          </p>
          <span className="inline-block mt-0.5 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
            {row.groupCode}
          </span>
        </div>
      ),
    },
    {
      key: 'subjectGrade',
      header: 'المادة والصف',
      className: 'w-[14%] min-w-[100px] px-2.5 truncate',
      headerClassName: 'w-[14%] min-w-[100px] px-2.5',
      render: (row) => (
        <div className="truncate">
          <p className="font-semibold text-foreground text-xs leading-snug truncate" title={row.subject}>
            {row.subject}
          </p>
          <p className="text-[11px] text-muted-foreground truncate" title={row.gradeLevel}>
            {row.gradeLevel}
          </p>
        </div>
      ),
    },
    {
      key: 'teacher',
      header: 'المدرس الأساسي',
      className: 'w-[14%] min-w-[100px] px-2.5 truncate',
      headerClassName: 'w-[14%] min-w-[100px] px-2.5',
      render: (row) => (
        <span
          className="font-semibold text-foreground text-xs truncate block"
          title={row.primaryTeacherName || '—'}
        >
          {row.primaryTeacherName || '—'}
        </span>
      ),
    },
    {
      key: 'schedule',
      header: 'المواعيد والقاعة',
      className: 'w-[15%] min-w-[110px] px-2.5 truncate',
      headerClassName: 'w-[15%] min-w-[110px] px-2.5',
      render: (row) => {
        const slotsCount = row.scheduleSlots?.length ?? 0;
        const daysText = row.scheduleSlots?.length
          ? row.scheduleSlots.map((s) => ARABIC_DAYS[s.dayOfWeek % 7]).slice(0, 2).join('، ')
          : null;

        return (
          <div className="text-xs truncate">
            <span
              className="font-medium text-foreground flex items-center gap-1 truncate"
              title={daysText || 'لم تُحدد'}
            >
              <Calendar className="h-3 w-3 text-primary shrink-0" />
              <span className="truncate">
                {daysText ? `${daysText}${slotsCount > 2 ? ` (+${slotsCount - 2})` : ''}` : 'لم تُحدد'}
              </span>
            </span>
            {row.defaultClassroomName && (
              <span className="text-[10px] text-muted-foreground block truncate" title={row.defaultClassroomName}>
                {row.defaultClassroomName}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'students',
      header: 'المشتركون',
      className: 'w-[9%] min-w-[70px] whitespace-nowrap text-center px-1.5',
      headerClassName: 'w-[9%] min-w-[70px] text-center px-1.5',
      render: (row) => (
        <Badge
          variant={row.activeStudentsCount >= row.maxStudents ? 'danger' : 'purple'}
          className="text-[11px] px-1.5 py-0.5"
        >
          {row.activeStudentsCount} / {row.maxStudents}
        </Badge>
      ),
    },
    {
      key: 'monthlyPrice',
      header: 'الاشتراك',
      className: 'w-[9%] min-w-[75px] whitespace-nowrap px-2',
      headerClassName: 'w-[9%] min-w-[75px] px-2',
      render: (row) => (
        <div>
          <p className="font-bold text-foreground text-xs">{formatCurrency(row.monthlyPrice)}</p>
          <p className="text-[10px] text-emerald-600 font-medium">
            {formatCurrency(row.calculatedSessionPrice)} / حصة
          </p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      className: 'w-[7%] min-w-[55px] whitespace-nowrap text-center px-1',
      headerClassName: 'w-[7%] min-w-[55px] text-center px-1',
      render: (row) => (
        <Badge variant={row.isActive ? 'success' : 'neutral'} className="text-[11px] px-1.5 py-0.5">
          {row.isActive ? 'نشطة' : 'متوقفة'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'إجراءات',
      className: 'w-[9%] min-w-[90px] whitespace-nowrap text-left pl-2 pr-1',
      headerClassName: 'w-[9%] min-w-[90px] text-left pl-2 pr-1',
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="h-7.5 gap-1 px-2 text-xs font-bold"
            onClick={() => navigate(`/groups/${row.id}`)}
            title="التفاصيل والطلاب"
          >
            <Users className="h-3.5 w-3.5 text-primary" />
            التفاصيل
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7.5 w-7.5 p-0 text-muted-foreground hover:text-foreground hover:bg-accent"
            onClick={() => {
              setQuickViewGroup(row);
              setQuickViewOpen(true);
            }}
            title="نظرة سريعة"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          {canManageGroups && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7.5 w-7.5 p-0 text-muted-foreground hover:text-foreground hover:bg-accent"
              onClick={() => {
                setEditingGroupId(row.id);
                setModalOpen(true);
              }}
              title="تعديل بيانات المجموعة"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </Button>
          )}
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
          canManageGroups ? (
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
          ) : undefined
        }
      />

      <ServerDataTable
        tableClassName="w-full table-fixed border-collapse text-right text-xs"
        columns={columns}
        data={data?.data ?? []}
        meta={data?.meta}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => {
          setQuickViewGroup(r);
          setQuickViewOpen(true);
        }}
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
            {(gradeFilter || activeFilter || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setGradeFilter('');
                  setActiveFilter('');
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

      <GroupFormModal
        open={modalOpen}
        onOpenChange={(o) => {
          setModalOpen(o);
          if (!o) setEditingGroupId(null);
        }}
        group={editingGroupId ? editingDetail ?? null : null}
      />

      <GroupQuickViewModal
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
        group={quickViewGroup}
        onEdit={(grp) => {
          setEditingGroupId(grp.id);
          setModalOpen(true);
        }}
      />

      <GradeLevelsModal
        open={gradeLevelsModalOpen}
        onOpenChange={setGradeLevelsModalOpen}
      />
    </div>
  );
}
