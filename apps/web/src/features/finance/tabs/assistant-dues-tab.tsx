import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { HandCoins, History, Lock, Plus, RotateCcw } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, PaginatedResult, PERMISSIONS } from '@edu-center/shared';
import {
  Badge,
  Button,
  ServerDataTable,
  TableColumn,
} from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
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
  selectedDate?: string;
  isMonthClosed?: boolean;
  lookups?: FinanceLookups;
}

export function AssistantDuesTab({
  yearMonth,
  selectedDate,
  lookups,
}: AssistantDuesTabProps) {
  const { hasPermission } = useAuth();
  const canPayout = hasPermission(PERMISSIONS.FINANCE_PAYOUTS);

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

  const duesColumns = React.useMemo<TableColumn<AssistantMonthlyRecordRow>[]>(() => {
    const cols: TableColumn<AssistantMonthlyRecordRow>[] = [
      {
        key: 'assistant',
        header: 'المساعد',
        className: 'whitespace-nowrap',
        render: (r) => (
          <div>
            <div className="font-bold text-foreground text-xs">{r.assistantName}</div>
            <div className="font-mono text-[11px] text-muted-foreground">
              {r.assistantCode} • {r.assistantPhone}
            </div>
          </div>
        ),
      },
      {
        key: 'method',
        header: 'طريقة الاحتساب',
        className: 'whitespace-nowrap',
        render: (r) => (
          <Badge variant="info" className="text-xs">
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
        className: 'whitespace-nowrap font-bold text-xs',
        render: (r) => formatCurrency(r.totalDues),
      },
      {
        key: 'paidOut',
        header: 'تم صرفه',
        className: 'whitespace-nowrap font-semibold text-emerald-600 dark:text-emerald-400 text-xs',
        render: (r) => formatCurrency(r.totalPaidOut),
      },
      {
        key: 'remaining',
        header: 'المتبقي للصرف',
        className: 'whitespace-nowrap',
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
        className: 'whitespace-nowrap',
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
    ];

    if (canPayout) {
      cols.push({
        key: 'actions',
        header: 'إجراءات',
        className: 'whitespace-nowrap text-left pl-4',
        render: (r) => (
          <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              className="h-8 gap-1 px-2.5 text-xs font-semibold"
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
              صرف دفعة
            </Button>
          </div>
        ),
      });
    }

    return cols;
  }, [canPayout]);

  const toolbarFilters = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="h-9 gap-1 text-xs"
        onClick={() => setViewMode((m) => (m === 'dues' ? 'payouts' : 'dues'))}
      >
        <History className="h-3.5 w-3.5" />
        {viewMode === 'dues' ? 'سجل صرفيات المساعدين' : 'العودة لملخص المستحقات'}
      </Button>
      {search && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setSearch('');
            setPage(1);
          }}
          className="gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          مسح البحث
        </Button>
      )}
    </div>
  );

  const toolbarActions = canPayout ? (
    <Button
      size="sm"
      className="h-9 gap-1.5 px-3.5 text-xs font-semibold shadow-sm"
      onClick={() => {
        setPreset(null);
        setPayoutOpen(true);
      }}
    >
      <Plus className="h-4 w-4" />
      صرف دفعة للمساعد
    </Button>
  ) : null;

  return (
    <div className="space-y-4">
      {viewMode === 'dues' ? (
        <ServerDataTable
          columns={duesColumns}
          data={duesQuery.data?.data ?? []}
          meta={duesQuery.data?.meta}
          isLoading={duesQuery.isLoading}
          rowKey={(r) => r.id}
          onRowClick={
            canPayout
              ? (r) => {
                  setPreset({
                    id: r.assistantId,
                    name: r.assistantName,
                    code: r.assistantCode,
                    remainingBalance: r.remainingBalance,
                  });
                  setPayoutOpen(true);
                }
              : undefined
          }
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
          actions={toolbarActions}
        />
      ) : (
        <PayoutsSubtable
          mode="assistant"
          yearMonth={yearMonth}
          selectedDate={selectedDate}
          filters={toolbarFilters}
        />
      )}

      <PayoutModal
        mode="assistant"
        open={payoutOpen}
        onOpenChange={setPayoutOpen}
        yearMonth={yearMonth}
        preset={preset}
        options={(lookups?.assistants ?? []).map((a) => {
          const rec = duesQuery.data?.data.find((r) => r.assistantId === a.id);
          return {
            value: a.id,
            label: `${a.fullName} (${a.code})`,
            remainingBalance: rec?.remainingBalance,
          };
        })}
      />
    </div>
  );
}
