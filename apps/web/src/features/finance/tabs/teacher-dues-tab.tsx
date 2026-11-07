import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { HandCoins, History, Lock, Plus } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, PaginatedResult } from '@edu-center/shared';
import {
  Badge,
  Button,
  ServerDataTable,
  TableColumn,
} from '@/design-system';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/formatters';
import { FinanceLookups, TeacherMonthlyRecordRow } from '../finance.types';
import { PayoutModal, PayoutTargetPreset } from '../modals/payout-modal';
import { PayoutsSubtable } from './payouts-subtable';

interface TeacherDuesTabProps {
  yearMonth: string;
  lookups?: FinanceLookups;
}

export function TeacherDuesTab({ yearMonth, lookups }: TeacherDuesTabProps) {
  const [viewMode, setViewMode] = React.useState<'dues' | 'payouts'>('dues');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);

  const [payoutOpen, setPayoutOpen] = React.useState(false);
  const [preset, setPreset] = React.useState<PayoutTargetPreset | null>(null);

  React.useEffect(() => {
    setPage(1);
  }, [yearMonth]);

  const duesQuery = useQuery<PaginatedResult<TeacherMonthlyRecordRow>>({
    queryKey: ['finance', 'teacher-records', yearMonth, page, limit, debouncedSearch],
    enabled: viewMode === 'dues',
    queryFn: async () =>
      (
        await apiClient.get('/finance/teacher-records', {
          params: {
            yearMonth,
            page,
            limit,
            search: debouncedSearch || undefined,
          },
        })
      ).data,
  });

  const duesColumns: TableColumn<TeacherMonthlyRecordRow>[] = [
    {
      key: 'teacher',
      header: 'المدرس',
      render: (r) => (
        <div>
          <div className="font-bold text-foreground">{r.teacherName}</div>
          <div className="text-xs text-muted-foreground">
            {r.teacherCode} • {r.specialization}
          </div>
        </div>
      ),
    },
    {
      key: 'activity',
      header: 'المجموعات والحصص',
      render: (r) => (
        <span className="text-xs font-semibold">
          {r.groupsCount} مجموعات • {r.executedSessionsCount} حصة منفذة
        </span>
      ),
    },
    {
      key: 'breakdown',
      header: 'تفصيل حصة المجموعات',
      render: (r) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {r.groupBreakdown.map((g) => (
            <Badge key={g.groupId} variant="neutral" title={g.calculationBreakdown ?? ''}>
              {g.groupName}: {formatCurrency(g.teacherAmount)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'totalDues',
      header: 'إجمالي المستحق',
      render: (r) => <span className="font-bold">{formatCurrency(r.totalDues)}</span>,
    },
    {
      key: 'paidOut',
      header: 'تم صرفه',
      render: (r) => (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(r.totalPaidOut)}
        </span>
      ),
    },
    {
      key: 'remaining',
      header: 'المتبقي للصرف',
      render: (r) =>
        r.remainingBalance > 0 ? (
          <Badge variant="warning">{formatCurrency(r.remainingBalance)}</Badge>
        ) : (
          <Badge variant="success">تمت التصفية</Badge>
        ),
    },
    {
      key: 'state',
      header: 'الإغلاق',
      render: (r) =>
        r.isClosed ? (
          <Badge variant="purple">
            <Lock className="h-3 w-3" />
            مغلق
          </Badge>
        ) : (
          <Badge variant="neutral">مفتوح</Badge>
        ),
    },
    {
      key: 'actions',
      header: 'إجراءات',
      render: (r) => (
        <Button
          size="sm"
          onClick={() => {
            setPreset({
              id: r.teacherId,
              name: r.teacherName,
              code: r.teacherCode,
              remainingBalance: r.remainingBalance,
            });
            setPayoutOpen(true);
          }}
        >
          <HandCoins className="h-3.5 w-3.5" />
          صرف دفعة للمدرس
        </Button>
      ),
    },
  ];

  const toolbarFilters = (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setViewMode((m) => (m === 'dues' ? 'payouts' : 'dues'))}
      >
        <History className="h-3.5 w-3.5" />
        {viewMode === 'dues' ? 'سجل صرفيات المدرسين' : 'العودة لملخص المستحقات'}
      </Button>
      <Button
        size="sm"
        onClick={() => {
          setPreset(null);
          setPayoutOpen(true);
        }}
      >
        <Plus className="h-4 w-4" />
        صرف دفعة للمدرس
      </Button>
    </>
  );

  return (
    <div className="space-y-4">
      {viewMode === 'dues' ? (
        <ServerDataTable
          columns={duesColumns}
          data={duesQuery.data?.data ?? []}
          meta={duesQuery.data?.meta}
          isLoading={duesQuery.isLoading}
          rowKey={(r) => r.id}
          searchPlaceholder="ابحث باسم المدرس أو الكود أو التخصص..."
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
          filters={toolbarFilters}
        />
      ) : (
        <PayoutsSubtable mode="teacher" yearMonth={yearMonth} filters={toolbarFilters} />
      )}

      <PayoutModal
        mode="teacher"
        open={payoutOpen}
        onOpenChange={setPayoutOpen}
        yearMonth={yearMonth}
        preset={preset}
        options={(lookups?.teachers ?? []).map((t) => ({
          value: t.id,
          label: `${t.fullName} (${t.code})`,
        }))}
      />
    </div>
  );
}
