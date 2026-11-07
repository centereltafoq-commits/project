import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, ClipboardList, RotateCcw, Sparkles } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, PaginatedResult, PERMISSIONS, SessionStatus } from '@edu-center/shared';
import {
  Badge,
  Button,
  DatePicker,
  MonthPicker,
  Select,
  ServerDataTable,
  TableColumn,
} from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient } from '@/lib/api-client';
import { ARABIC_DAYS, formatDateAr, formatTimeRangeAr, getCurrentYearMonth } from '@/lib/formatters';
import {
  AttendanceLookups,
  SESSION_STATUS_META,
  SessionRow,
} from './attendance.types';
import { CreateSessionModal, GenerateMonthModal } from './session-modals';
import { SessionSheetModal } from './session-sheet-modal';

interface SessionsTabProps {
  lookups?: AttendanceLookups;
}

export function SessionsTab({ lookups }: SessionsTabProps) {
  const { hasPermission } = useAuth();
  const canManageSessions = hasPermission(PERMISSIONS.SESSIONS_MANAGE);

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);

  const [sessionDate, setSessionDate] = React.useState('');
  const [yearMonth, setYearMonth] = React.useState(getCurrentYearMonth());
  const [groupId, setGroupId] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');

  const [createOpen, setCreateOpen] = React.useState(false);
  const [generateOpen, setGenerateOpen] = React.useState(false);
  const [activeSheetSessionId, setActiveSheetSessionId] = React.useState<string | null>(null);

  const { data, isLoading } = useQuery<PaginatedResult<SessionRow>>({
    queryKey: [
      'attendance-sessions',
      page,
      limit,
      debouncedSearch,
      sessionDate,
      yearMonth,
      groupId,
      statusFilter,
    ],
    queryFn: async () => {
      const res = await apiClient.get('/attendance/sessions', {
        params: {
          page,
          limit,
          search: debouncedSearch || undefined,
          sessionDate: sessionDate || undefined,
          yearMonth: !sessionDate && yearMonth ? yearMonth : undefined,
          groupId: groupId || undefined,
          status: statusFilter || undefined,
        },
      });
      return res.data;
    },
  });

  const columns: TableColumn<SessionRow>[] = [
    {
      key: 'date',
      header: 'التاريخ والوقت',
      className: 'whitespace-nowrap',
      render: (row) => {
        const d = new Date(`${row.sessionDate}T00:00:00`);
        const dayName = Number.isNaN(d.getTime()) ? '' : ARABIC_DAYS[d.getDay()];
        return (
          <div>
            <div className="font-bold text-foreground text-xs hover:text-primary transition-colors cursor-pointer">
              {dayName} — {formatDateAr(row.sessionDate)}
            </div>
            <div className="text-[11px] text-muted-foreground font-mono">
              {formatTimeRangeAr(row.startTime, row.endTime)}
            </div>
          </div>
        );
      },
    },
    {
      key: 'group',
      header: 'المجموعة والمادة',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div>
          <div className="font-bold text-foreground text-xs">{row.groupName}</div>
          <div className="text-[11px] text-muted-foreground">
            <span className="font-mono">{row.groupCode}</span> • {row.subject}
          </div>
        </div>
      ),
    },
    {
      key: 'teacher',
      header: 'المدرس / القاعة',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div>
          <div className="font-medium text-foreground text-xs">{row.teacherName}</div>
          <div className="text-[11px] text-muted-foreground">
            {row.classroomName ? `${row.classroomName} (${row.roomNumber})` : 'بدون قاعة'}
          </div>
        </div>
      ),
    },
    {
      key: 'attendanceCount',
      header: 'ملخص الرصد',
      className: 'whitespace-nowrap',
      render: (row) =>
        row.recordedCount > 0 ? (
          <Badge variant="purple" className="text-xs">
            حضور {row.presentCount} من {row.recordedCount}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">لم يُرصد بعد</span>
        ),
    },
    {
      key: 'status',
      header: 'الحالة',
      className: 'whitespace-nowrap',
      render: (row) => {
        const meta = SESSION_STATUS_META[row.status] ?? {
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
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 px-3 text-xs font-bold"
            onClick={() => setActiveSheetSessionId(row.id)}
          >
            <ClipboardList className="h-3.5 w-3.5 text-primary" />
            كشف الحضور
          </Button>
        </div>
      ),
    },
  ];

  const hasActiveFilters = Boolean(sessionDate || groupId || statusFilter || search);

  return (
    <div className="space-y-4">
      {canManageSessions && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => setGenerateOpen(true)} className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            توليد حصص الشهر تلقائياً
          </Button>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <CalendarPlus className="h-4 w-4" />
            إنشاء حصة مفردة
          </Button>
        </div>
      )}

      <ServerDataTable
        columns={columns}
        data={data?.data ?? []}
        meta={data?.meta}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => setActiveSheetSessionId(r.id)}
        searchPlaceholder="ابحث بالمجموعة أو الكود أو اسم المدرس أو عنوان الدرس..."
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
            <DatePicker
              placeholder="تصفية بيوم محدد"
              value={sessionDate}
              onChange={(d) => {
                setSessionDate(d);
                setPage(1);
              }}
              className="w-44"
            />
            <MonthPicker
              value={yearMonth}
              disabled={Boolean(sessionDate)}
              onChange={(m) => {
                setYearMonth(m);
                setPage(1);
              }}
              className="w-44"
            />
            <Select
              placeholder="كل المجموعات"
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value);
                setPage(1);
              }}
              options={(lookups?.groups ?? []).map((g) => ({
                value: g.id,
                label: `${g.name} (${g.groupCode})`,
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
                { value: SessionStatus.SCHEDULED, label: 'مجدولة' },
                { value: SessionStatus.COMPLETED, label: 'مكتملة' },
                { value: SessionStatus.CANCELLED, label: 'ملغاة' },
              ]}
              className="w-36"
            />
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSessionDate('');
                  setGroupId('');
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

      <CreateSessionModal open={createOpen} onOpenChange={setCreateOpen} lookups={lookups} />
      <GenerateMonthModal open={generateOpen} onOpenChange={setGenerateOpen} lookups={lookups} />
      <SessionSheetModal
        sessionId={activeSheetSessionId}
        onClose={() => setActiveSheetSessionId(null)}
      />
    </div>
  );
}
