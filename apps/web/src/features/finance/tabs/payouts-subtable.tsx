import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_PAGE_SIZE, PaginatedResult } from '@edu-center/shared';
import { Badge, ServerDataTable, TableColumn } from '@/design-system';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient } from '@/lib/api-client';
import { formatCurrency, formatDateAr, formatDateTimeAr } from '@/lib/formatters';
import { PAYMENT_METHOD_LABELS } from '../finance.types';

interface GenericPayoutRow {
  id: string;
  referenceNumber: string;
  teacherName?: string;
  teacherCode?: string;
  assistantName?: string;
  assistantCode?: string;
  amount: number;
  payoutDate: string;
  paymentMethod: string;
  paidByName: string | null;
}

interface PayoutsSubtableProps {
  mode: 'teacher' | 'assistant';
  yearMonth: string;
  selectedDate?: string;
  filters?: React.ReactNode;
}

export function PayoutsSubtable({
  mode,
  yearMonth,
  selectedDate,
  filters,
}: PayoutsSubtableProps) {
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);

  const isTeacher = mode === 'teacher';
  const endpoint = isTeacher ? '/finance/teacher-payouts' : '/finance/assistant-payouts';
  const queryKeyName = isTeacher ? 'teacher-payouts' : 'assistant-payouts';

  React.useEffect(() => {
    setPage(1);
  }, [yearMonth, selectedDate]);

  const { data, isLoading } = useQuery<PaginatedResult<GenericPayoutRow>>({
    queryKey: ['finance', queryKeyName, yearMonth, selectedDate, page, limit, debouncedSearch],
    queryFn: async () =>
      (
        await apiClient.get(endpoint, {
          params: {
            yearMonth,
            date: selectedDate || undefined,
            page,
            limit,
            search: debouncedSearch || undefined,
          },
        })
      ).data,
  });

  const columns: TableColumn<GenericPayoutRow>[] = [
    {
      key: 'ref',
      header: 'رقم المرجع',
      className: 'whitespace-nowrap font-mono',
      render: (r) => (
        <span className="inline-block rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
          {r.referenceNumber}
        </span>
      ),
    },
    {
      key: 'recipient',
      header: isTeacher ? 'المدرس' : 'المساعد',
      className: 'whitespace-nowrap',
      render: (r) => (
        <div>
          <span className="font-bold text-foreground text-xs">
            {r.teacherName ?? r.assistantName}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground mr-1.5">
            ({r.teacherCode ?? r.assistantCode})
          </span>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'المبلغ المصروف',
      className: 'whitespace-nowrap font-extrabold text-foreground text-xs',
      render: (r) => formatCurrency(r.amount),
    },
    {
      key: 'method',
      header: 'وسيلة الصرف',
      className: 'whitespace-nowrap',
      render: (r) => (
        <Badge variant="purple" className="text-xs">
          {PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod}
        </Badge>
      ),
    },
    {
      key: 'date',
      header: 'تاريخ ووقت الصرف',
      className: 'whitespace-nowrap text-xs text-muted-foreground',
      render: (r) => formatDateTimeAr(r.payoutDate),
    },
    {
      key: 'paidBy',
      header: 'بواسطة',
      className: 'whitespace-nowrap text-xs',
      render: (r) => r.paidByName || '—',
    },
  ];

  return (
    <ServerDataTable
      columns={columns}
      data={data?.data ?? []}
      meta={data?.meta}
      isLoading={isLoading}
      rowKey={(r) => r.id}
      searchPlaceholder={
        isTeacher
          ? 'ابحث برقم المرجع أو اسم المدرس...'
          : 'ابحث برقم المرجع أو اسم المساعد...'
      }
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
      emptyTitle={
        selectedDate
          ? `لا توجد حركات صرف مسجلة في يوم ${formatDateAr(selectedDate)}`
          : 'لا توجد حركات صرف مسجلة في هذا الشهر'
      }
      filters={filters}
    />
  );
}
