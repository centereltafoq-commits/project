import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer, RotateCcw } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, PaginatedResult } from '@edu-center/shared';
import {
  Badge,
  Button,
  Select,
  ServerDataTable,
  TableColumn,
} from '@/design-system';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient } from '@/lib/api-client';
import { formatCurrency, formatDateTimeAr } from '@/lib/formatters';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_OPTIONS,
  PaymentRow,
} from '../finance.types';

interface PaymentsHistoryTabProps {
  yearMonth: string;
  onShowReceipt: (receipt: PaymentRow) => void;
}

export function PaymentsHistoryTab({
  yearMonth,
  onShowReceipt,
}: PaymentsHistoryTabProps) {
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [paymentMethod, setPaymentMethod] = React.useState('');

  React.useEffect(() => {
    setPage(1);
  }, [yearMonth]);

  const { data, isLoading } = useQuery<PaginatedResult<PaymentRow>>({
    queryKey: [
      'finance',
      'payments',
      yearMonth,
      page,
      limit,
      debouncedSearch,
      paymentMethod,
    ],
    queryFn: async () => {
      const res = await apiClient.get('/finance/payments', {
        params: {
          yearMonth,
          page,
          limit,
          search: debouncedSearch || undefined,
          paymentMethod: paymentMethod || undefined,
        },
      });
      return res.data;
    },
  });

  const columns: TableColumn<PaymentRow>[] = [
    {
      key: 'receipt',
      header: 'رقم الإيصال',
      className: 'whitespace-nowrap font-mono',
      render: (r) => (
        <span className="inline-block rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">
          {r.receiptNumber}
        </span>
      ),
    },
    {
      key: 'student',
      header: 'الطالب',
      className: 'whitespace-nowrap',
      render: (r) => (
        <div>
          <div className="font-bold text-foreground text-xs">{r.studentName}</div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {r.studentCode}
            {r.studentPhone ? ` • ${r.studentPhone}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'allocations',
      header: 'توزيع المجموعات',
      render: (r) => (
        <div className="flex flex-wrap gap-1 max-w-xs">
          {r.allocations.length === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            r.allocations.map((a, idx) => (
              <Badge key={`${a.groupId}-${idx}`} variant="neutral" className="text-[11px] whitespace-nowrap">
                {a.groupName}: {formatCurrency(a.allocatedAmount)}
              </Badge>
            ))
          )}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'المبلغ المحصّل',
      className: 'whitespace-nowrap font-extrabold text-emerald-600 dark:text-emerald-400 text-xs',
      render: (r) => formatCurrency(r.amount),
    },
    {
      key: 'method',
      header: 'وسيلة الدفع',
      className: 'whitespace-nowrap',
      render: (r) => (
        <Badge variant="purple" className="text-xs">
          {PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod}
        </Badge>
      ),
    },
    {
      key: 'date',
      header: 'تاريخ ووقت السداد',
      className: 'whitespace-nowrap text-xs text-muted-foreground',
      render: (r) => formatDateTimeAr(r.paymentDate),
    },
    {
      key: 'receiver',
      header: 'المحصّل',
      className: 'whitespace-nowrap text-xs',
      render: (r) => r.receivedByName || '—',
    },
    {
      key: 'actions',
      header: 'إجراءات',
      className: 'whitespace-nowrap text-left pl-4',
      render: (r) => (
        <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2.5 text-xs font-bold"
            onClick={() => onShowReceipt(r)}
          >
            <Printer className="h-3.5 w-3.5 text-primary" />
            إيصال
          </Button>
        </div>
      ),
    },
  ];

  return (
    <ServerDataTable
      columns={columns}
      data={data?.data ?? []}
      meta={data?.meta}
      isLoading={isLoading}
      rowKey={(r) => r.id}
      onRowClick={(r) => onShowReceipt(r)}
      searchPlaceholder="ابحث برقم الإيصال أو اسم الطالب أو الكود أو الهاتف..."
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
      emptyTitle="لا توجد إيصالات مدفوعات مسجلة في هذا الشهر"
      filters={
        <div className="flex flex-wrap items-center gap-2">
          <Select
            searchable
            placeholder="كل وسائل الدفع"
            value={paymentMethod}
            onChange={(e) => {
              setPaymentMethod(e.target.value);
              setPage(1);
            }}
            options={PAYMENT_METHOD_OPTIONS}
            className="w-48"
          />
          {(paymentMethod || search) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPaymentMethod('');
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
  );
}
