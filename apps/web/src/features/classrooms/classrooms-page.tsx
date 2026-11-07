import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarRange, Edit3, Eye, Plus, RotateCcw, Search, Wrench } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, PaginatedResult, PERMISSIONS } from '@edu-center/shared';
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
import { AvailableClassroomsModal } from './available-classrooms-modal';
import { ClassroomFormModal } from './classroom-form-modal';
import { ClassroomMaintenanceModal } from './classroom-maintenance-modal';
import { ClassroomScheduleModal } from './classroom-schedule-modal';
import { ClassroomQuickViewModal } from './components/classroom-quick-view-modal';
import {
  CLASSROOM_STATUS_META,
  CLASSROOM_STATUS_OPTIONS,
  ClassroomRow,
} from './classrooms.types';

export function ClassroomsPage() {
  const { hasPermission } = useAuth();
  const canManageClassrooms = hasPermission(PERMISSIONS.CLASSROOMS_MANAGE);
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = React.useState('');

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingRoom, setEditingRoom] = React.useState<ClassroomRow | null>(null);
  const [quickViewRoom, setQuickViewRoom] = React.useState<ClassroomRow | null>(null);
  const [quickViewOpen, setQuickViewOpen] = React.useState(false);
  const [maintRoom, setMaintRoom] = React.useState<ClassroomRow | null>(null);
  const [scheduleRoom, setScheduleRoom] = React.useState<ClassroomRow | null>(null);
  const [availOpen, setAvailOpen] = React.useState(false);

  const { data, isLoading } = useQuery<PaginatedResult<ClassroomRow>>({
    queryKey: ['classrooms', page, limit, debouncedSearch, statusFilter],
    queryFn: async () => {
      const res = await apiClient.get('/classrooms', {
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

  const columns: TableColumn<ClassroomRow>[] = [
    {
      key: 'roomNumber',
      header: 'رقم القاعة',
      className: 'whitespace-nowrap font-mono',
      render: (row) => (
        <span className="inline-block rounded-md bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
          قاعة #{row.roomNumber}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'اسم القاعة',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span className="font-bold text-foreground hover:text-primary transition-colors cursor-pointer">
          {row.name}
        </span>
      ),
    },
    {
      key: 'capacity',
      header: 'السعة والمقاعد',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div className="text-xs">
          <span className="font-bold text-foreground">{row.maxCapacity} طالب</span>
          <span className="text-muted-foreground mr-1">({row.seatsCount} مقعد)</span>
        </div>
      ),
    },
    {
      key: 'equipment',
      header: 'التجهيزات',
      render: (row) =>
        row.equipment?.length ? (
          <div className="flex flex-wrap items-center gap-1 max-w-xs">
            {row.equipment.slice(0, 2).map((eq, idx) => (
              <Badge key={idx} variant="info" className="text-[11px] whitespace-nowrap">
                {eq}
              </Badge>
            ))}
            {row.equipment.length > 2 && (
              <Badge variant="neutral" className="text-[11px] whitespace-nowrap">
                +{row.equipment.length - 2}
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      key: 'status',
      header: 'الحالة',
      className: 'whitespace-nowrap',
      render: (row) => {
        const meta = CLASSROOM_STATUS_META[row.status] ?? {
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
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2.5 text-xs font-bold"
            onClick={() => {
              setQuickViewRoom(row);
              setQuickViewOpen(true);
            }}
          >
            <Eye className="h-3.5 w-3.5 text-primary" />
            تفاصيل
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setScheduleRoom(row)}
          >
            <CalendarRange className="h-3.5 w-3.5 text-primary" />
            الجدول
          </Button>
          {canManageClassrooms && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setEditingRoom(row);
                setFormOpen(true);
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
        title="إدارة القاعات الدراسية وجدول الإشغال"
        description="متابعة القاعات، السعة القصوى، التجهيزات، الصيانة، والبحث الذكي عن القاعات المتاحة"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setAvailOpen(true)} className="gap-1.5">
              <Search className="h-4 w-4" />
              فحص القاعات المتاحة
            </Button>
            {canManageClassrooms && (
              <Button
                onClick={() => {
                  setEditingRoom(null);
                  setFormOpen(true);
                }}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                إضافة قاعة جديدة
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
        onRowClick={(r) => {
          setQuickViewRoom(r);
          setQuickViewOpen(true);
        }}
        searchPlaceholder="ابحث برقم القاعة أو اسمها..."
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
              placeholder="كل الحالات"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={CLASSROOM_STATUS_OPTIONS}
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
                <RotateCcw className="h-3.5 w-3.5" />
                مسح الفلاتر
              </Button>
            )}
          </div>
        }
      />

      <ClassroomFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        classroom={editingRoom}
      />

      <ClassroomQuickViewModal
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
        classroom={quickViewRoom}
        onEdit={(rm) => {
          setEditingRoom(rm);
          setFormOpen(true);
        }}
        onOpenSchedule={(rm) => setScheduleRoom(rm)}
        onOpenMaintenance={(rm) => setMaintRoom(rm)}
      />

      <ClassroomMaintenanceModal
        open={Boolean(maintRoom)}
        onOpenChange={(o) => !o && setMaintRoom(null)}
        classroom={maintRoom}
      />

      <ClassroomScheduleModal
        open={Boolean(scheduleRoom)}
        onOpenChange={(o) => !o && setScheduleRoom(null)}
        classroom={scheduleRoom}
      />

      <AvailableClassroomsModal open={availOpen} onOpenChange={setAvailOpen} />
    </div>
  );
}
