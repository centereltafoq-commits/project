import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, RotateCcw } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, PaginatedResult, SessionStatus } from '@edu-center/shared';
import {
  Badge,
  Button,
  DatePicker,
  MonthPicker,
  Select,
  ServerDataTable,
  TableColumn,
} from '@/design-system';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient } from '@/lib/api-client';
import { ARABIC_DAYS, formatDateAr, formatTimeRangeAr, getCurrentYearMonth } from '@/lib/formatters';
import { CompleteGroupSessionButton } from './complete-group-session-button';
import { AttendanceLookups, SessionRow } from './attendance.types';
import { SessionSheetModal } from './session-sheet-modal';

interface SessionsTabProps {
  lookups?: AttendanceLookups;
}

export function SessionsTab({ lookups }: SessionsTabProps) {
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);

  const [sessionDate, setSessionDate] = React.useState('');
  const [yearMonth, setYearMonth] = React.useState(getCurrentYearMonth());
  const [groupId, setGroupId] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');

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
      className: 'w-[16%] min-w-[125px] px-2.5 truncate',
      headerClassName: 'w-[16%] min-w-[125px] px-2.5',
      render: (row) => {
        const d = new Date(`${row.sessionDate}T00:00:00`);
        const dayName = Number.isNaN(d.getTime()) ? '' : ARABIC_DAYS[d.getDay()];
        return (
          <div className="truncate">
            <div
              className="font-bold text-foreground text-xs hover:text-primary transition-colors cursor-pointer truncate leading-snug"
              title={`${dayName} — ${formatDateAr(row.sessionDate)}`}
            >
              {dayName} — {formatDateAr(row.sessionDate)}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono truncate">
              {formatTimeRangeAr(row.startTime, row.endTime)}
            </div>
          </div>
        );
      },
    },
    {
      key: 'group',
      header: 'المجموعة والمادة',
      className: 'w-[23%] min-w-[145px] px-2.5 truncate',
      headerClassName: 'w-[23%] min-w-[145px] px-2.5',
      render: (row) => (
        <div className="truncate">
          <div className="font-bold text-foreground text-xs truncate leading-snug" title={row.groupName}>
            {row.groupName}
          </div>
          <div className="text-[10px] text-muted-foreground truncate">
            <span className="font-mono font-bold text-primary">{row.groupCode}</span> • {row.subject}
          </div>
        </div>
      ),
    },
    {
      key: 'teacher',
      header: 'المدرس / القاعة',
      className: 'w-[16%] min-w-[115px] px-2.5 truncate',
      headerClassName: 'w-[16%] min-w-[115px] px-2.5',
      render: (row) => (
        <div className="truncate">
          <div className="font-medium text-foreground text-xs truncate" title={row.teacherName}>
            {row.teacherName}
          </div>
          <div className="text-[10px] text-muted-foreground truncate">
            {row.classroomName ? `${row.classroomName} (${row.roomNumber})` : 'بدون قاعة'}
          </div>
        </div>
      ),
    },
    {
      key: 'groupProgress',
      header: 'حصة الاشتراك',
      className: 'w-[15%] min-w-[118px] whitespace-nowrap text-center px-1.5',
      headerClassName: 'w-[15%] min-w-[118px] text-center px-1.5',
      render: (row) => {
        if (row.status === SessionStatus.CANCELLED) {
          return (
            <Badge variant="danger" className="text-[11px] px-2 py-0.5">
              ملغاة
            </Badge>
          );
        }

        const target = Math.max(1, row.monthlySessionsCount ?? 4);
        if (typeof row.sessionSequenceInMonth === 'number') {
          const isExtra = row.sessionSequenceInMonth > target;
          return (
            <div className="flex flex-col items-center gap-0.5">
              <Badge variant={isExtra ? 'warning' : 'success'} className="text-[11px] px-2 py-0.5">
                {isExtra
                  ? `الحصة ${row.sessionSequenceInMonth} من ${target} (إضافية)`
                  : `الحصة ${row.sessionSequenceInMonth} من ${target}`}
              </Badge>
              <span className="text-[10px] text-muted-foreground">مكتملة</span>
            </div>
          );
        }

        const completed = row.completedSessionsInMonth ?? 0;
        return (
          <div className="flex flex-col items-center gap-0.5">
            <Badge variant="info" className="text-[11px] px-2 py-0.5">
              مجدولة
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              المنفذ: {completed} من {target}
            </span>
          </div>
        );
      },
    },
    {
      key: 'attendanceCount',
      header: 'كشف الطلاب',
      className: 'w-[12%] min-w-[100px] whitespace-nowrap text-center px-1.5',
      headerClassName: 'w-[12%] min-w-[100px] text-center px-1.5',
      render: (row) => {
        const total = Math.max(row.enrolledCount ?? 0, row.recordedCount);
        if (row.recordedCount > 0) {
          return (
            <Badge variant="purple" className="text-[11px] px-2 py-0.5">
              حضور {row.presentCount} من {total}
            </Badge>
          );
        }
        return (
          <span className="text-[11px] text-muted-foreground">
            {total > 0 ? `لم يُرصد (0 من ${total})` : 'لم يُرصد'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'إجراءات',
      className: 'w-[18%] min-w-[195px] whitespace-nowrap text-left pl-2 pr-1',
      headerClassName: 'w-[18%] min-w-[195px] text-left pl-2 pr-1',
      render: (row) => {
        const canQuickComplete = row.status === SessionStatus.SCHEDULED;
        return (
          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
            {canQuickComplete && (
              <CompleteGroupSessionButton
                sessionId={row.id}
                label="تحضير المجموعة"
                className="h-7.5 px-2.5 text-xs font-bold"
              />
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7.5 gap-1.5 px-2.5 text-xs font-bold"
              onClick={() => setActiveSheetSessionId(row.id)}
            >
              <ClipboardList className="h-3.5 w-3.5 text-primary" />
              كشف الحضور
            </Button>
          </div>
        );
      },
    },
  ];

  const hasActiveFilters = Boolean(sessionDate || groupId || statusFilter || search);

  return (
    <div className="space-y-4">
      <ServerDataTable
        tableClassName="w-full table-fixed border-collapse text-right text-xs"
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
              searchable
              clearable
              searchPlaceholder="ابحث في المجموعات..."
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
              className="w-52"
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

      <SessionSheetModal
        sessionId={activeSheetSessionId}
        onClose={() => setActiveSheetSessionId(null)}
      />
    </div>
  );
}
