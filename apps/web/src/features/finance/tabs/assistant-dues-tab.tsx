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
import {
  ASSISTANT_METHOD_LABELS,
  AssistantMonthlyRecordRow,
  FinanceLookups,
} from '../finance.types';
import { PayoutModal, PayoutTargetPreset } from '../modals/payout-modal';
import { PayoutsSubtable } from './payouts-subtable';

interface AssistantDuesTabProps {
  yearMonth: string;
  lookups?: FinanceLookups;
}

export function AssistantDuesTab({ yearMonth, lookups }: AssistantDuesTabProps) {
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

  const duesQuery = useQuery<PaginatedResult<AssistantMonthlyRecordRow>>({
    queryKey: ['finance', 'assistant-records', yearMonth, page, limit, debouncedSearch],
    enabled: viewMode === 'dues',
    queryFn: async () =>
      (
        await apiClient.get('/finance/assistant-records', {
          params: {
            yearMonth,
            page,
            limit,
            search: debouncedSearch || undefined,
          },
        })
      ).data,
  });

  const duesColumns: TableColumn<AssistantMonthlyRecordRow>[] = [
    {
      key: 'assistant',
      header: 'المساعد',
      render: (r) => (
        <div>
          <div className="font-bold text-foreground">{r.assistantName}</div>
          <div className="text-xs text-muted-foreground">
            {r.assistantCode} • {r.assistantPhone}
          </div>
        </div>
      ),
    },
    {
      key: 'method',
      header: 'طريقة الاحتساب',
      render: (r) => (
        <Badge variant="info">
          {ASSISTANT_METHOD_LABELS[r.calculationMethodSnapshot] ??
            r.calculationMethodSnapshot}
        </Badge>
      ),
    },
    {
      key: 'details',
      header: 'تفصيل المعادلة',
      render: (r) => (
        <span className="text-xs text-muted-foreground line-clamp-2 max-w-xs">
          {r.detailsNote || '—'}
        </span>
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
              id: r.assistantId,
              name: r.assistantName,
              code: r.assistantCode,
              remainingBalance: r.remainingBalance,
            });
            setPayoutOpen(true);
          }}
        >
          <HandCoins className="h-3.5 w-3.5" />
          صرف دفعة للمساعد
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
        {viewMode === 'dues' ? 'سجل صرفيات المساعدين' : 'العودة لملخص المستحقات'}
      </Button>
      <Button
        size="sm"
        onClick={() => {
          setPreset(null);
          setPayoutOpen(true);
        }}
      >
        <Plus className="h-4 w-4" />
        صرف دفعة للمساعد
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
          searchPlaceholder="ابحث باسم المساعد أو الكود أو الهاتف..."
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
        <PayoutsSubtable
          mode="assistant"
          yearMonth={yearMonth}
          filters={toolbarFilters}
        />
      )}

      <PayoutModal
        mode="assistant"
        open={payoutOpen}
        onOpenChange={setPayoutOpen}
        yearMonth={yearMonth}
        preset={preset}
        options={(lookups?.assistants ?? []).map((a) => ({
          value: a.id,
          label: `${a.fullName} (${a.code})`,
        }))}
      />
    </div>
  );
}
