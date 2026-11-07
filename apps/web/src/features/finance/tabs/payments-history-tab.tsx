import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
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
      render: (r) => (
        <Badge variant="info" className="font-mono">
          {r.receiptNumber}
        </Badge>
      ),
    },
    {
      key: 'student',
      header: 'الطالب',
      render: (r) => (
        <div>
          <div className="font-bold text-foreground">{r.studentName}</div>
          <div className="text-xs text-muted-foreground">
            {r.studentCode} • {r.studentPhone}
          </div>
        </div>
      ),
    },
    {
      key: 'allocations',
      header: 'توزيع المجموعات',
      render: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.allocations.length === 0 ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            r.allocations.map((a, idx) => (
              <Badge key={`${a.groupId}-${idx}`} variant="neutral">
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
      render: (r) => (
        <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(r.amount)}
        </span>
      ),
    },
    {
      key: 'method',
      header: 'وسيلة الدفع',
      render: (r) => (
        <Badge variant="purple">
          {PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod}
        </Badge>
      ),
    },
    {
      key: 'date',
      header: 'تاريخ ووقت السداد',
      render: (r) => formatDateTimeAr(r.paymentDate),
    },
    {
      key: 'receiver',
      header: 'المحصّل',
      render: (r) => r.receivedByName || '—',
    },
    {
      key: 'actions',
      header: 'إيصال الطباعة',
      render: (r) => (
        <Button size="sm" variant="outline" onClick={() => onShowReceipt(r)}>
          <Printer className="h-3.5 w-3.5" />
          عرض وطباعة
        </Button>
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
        <Select
          placeholder="كل وسائل الدفع"
          value={paymentMethod}
          onChange={(e) => {
            setPaymentMethod(e.target.value);
            setPage(1);
          }}
          options={PAYMENT_METHOD_OPTIONS}
          className="w-48"
        />
      }
    />
  );
}
