import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarRange, Edit3, Plus, Search, Wrench } from 'lucide-react';
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
import { AvailableClassroomsModal } from './available-classrooms-modal';
import { ClassroomFormModal } from './classroom-form-modal';
import { ClassroomMaintenanceModal } from './classroom-maintenance-modal';
import { ClassroomScheduleModal } from './classroom-schedule-modal';
import {
  CLASSROOM_STATUS_META,
  CLASSROOM_STATUS_OPTIONS,
  ClassroomRow,
} from './classrooms.types';

export function ClassroomsPage() {
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = React.useState('');

  const [formOpen, setFormOpen] = React.useState(false);
  const [editingRoom, setEditingRoom] = React.useState<ClassroomRow | null>(null);
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
      render: (row) => (
        <span className="font-mono text-xs font-bold text-primary">{row.roomNumber}</span>
      ),
    },
    {
      key: 'name',
      header: 'اسم القاعة',
      render: (row) => <span className="font-bold text-foreground">{row.name}</span>,
    },
    {
      key: 'capacity',
      header: 'السعة / المقاعد',
      render: (row) => (
        <span>
          <strong>{row.maxCapacity}</strong> سعة قصوى ({row.seatsCount} مقعد)
        </span>
      ),
    },
    {
      key: 'equipment',
      header: 'التجهيزات',
      render: (row) =>
        row.equipment?.length ? (
          <div className="flex flex-wrap gap-1">
            {row.equipment.slice(0, 3).map((eq, idx) => (
              <Badge key={idx} variant="info">
                {eq}
              </Badge>
            ))}
            {row.equipment.length > 3 && (
              <Badge variant="neutral">+{row.equipment.length - 3}</Badge>
            )}
          </div>
        ) : (
          '—'
        ),
    },
    {
      key: 'status',
      header: 'الحالة',
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
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => setScheduleRoom(row)}>
            <CalendarRange className="h-3.5 w-3.5" />
            الجدول الأسبوعي
          </Button>
          <Button size="sm" variant="outline" onClick={() => setMaintRoom(row)}>
            <Wrench className="h-3.5 w-3.5" />
            الصيانة ({row.upcomingMaintenancesCount ?? 0})
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditingRoom(row);
              setFormOpen(true);
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
        title="إدارة القاعات الدراسية وجدول الإشغال"
        description="متابعة القاعات، السعة القصوى، التجهيزات، الصيانة، والبحث الذكي عن القاعات المتاحة"
        actions={
          <>
            <Button variant="outline" onClick={() => setAvailOpen(true)}>
              <Search className="h-4 w-4" />
              فحص القاعات المتاحة
            </Button>
            <Button
              onClick={() => {
                setEditingRoom(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              إضافة قاعة جديدة
            </Button>
          </>
        }
      />

      <ServerDataTable
        columns={columns}
        data={data?.data ?? []}
        meta={data?.meta}
        isLoading={isLoading}
        rowKey={(r) => r.id}
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
        }
      />

      <ClassroomFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        classroom={editingRoom}
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
