import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, PaginatedResult } from '@edu-center/shared';
import {
  Badge,
  Button,
  Card,
  Select,
  ServerDataTable,
  TableColumn,
  useToast,
} from '@/design-system';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { formatCurrency, formatDateAr } from '@/lib/formatters';
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_CATEGORY_OPTIONS,
  ExpenseRow,
  PAYMENT_METHOD_LABELS,
} from '../finance.types';
import { ExpenseFormModal } from '../modals/expense-form-modal';

interface ExpensesResponse extends PaginatedResult<ExpenseRow> {
  summary?: {
    monthTotal: number;
    filteredTotal: number;
    byCategory: Record<string, number>;
  };
}

interface ExpensesTabProps {
  yearMonth: string;
}

export function ExpensesTab({ yearMonth }: ExpensesTabProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [categoryFilter, setCategoryFilter] = React.useState('');

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ExpenseRow | null>(null);

  React.useEffect(() => {
    setPage(1);
  }, [yearMonth]);

  const { data, isLoading } = useQuery<ExpensesResponse>({
    queryKey: ['finance', 'expenses', yearMonth, page, limit, debouncedSearch, categoryFilter],
    queryFn: async () =>
      (
        await apiClient.get('/finance/expenses', {
          params: {
            yearMonth,
            page,
            limit,
            search: debouncedSearch || undefined,
            category: categoryFilter || undefined,
          },
        })
      ).data,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/finance/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      notify('تم حذف المصروف بنجاح', 'success');
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const columns: TableColumn<ExpenseRow>[] = [
    {
      key: 'category',
      header: 'بند المصروف',
      className: 'whitespace-nowrap',
      render: (r) => (
        <Badge variant="warning" className="text-xs">
          {EXPENSE_CATEGORY_LABELS[r.category] ?? r.category}
        </Badge>
      ),
    },
    {
      key: 'title',
      header: 'البيان / الوصف',
      className: 'whitespace-nowrap',
      render: (r) => (
        <div>
          <div className="font-bold text-foreground text-xs">{r.title}</div>
          {r.notes && <div className="text-[11px] text-muted-foreground">{r.notes}</div>}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'القيمة',
      className: 'whitespace-nowrap font-extrabold text-rose-600 dark:text-rose-400 text-xs',
      render: (r) => formatCurrency(r.amount),
    },
    {
      key: 'method',
      header: 'وسيلة السداد',
      className: 'whitespace-nowrap text-xs',
      render: (r) => PAYMENT_METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod,
    },
    {
      key: 'date',
      header: 'التاريخ',
      className: 'whitespace-nowrap text-xs text-muted-foreground',
      render: (r) => formatDateAr(r.expenseDate),
    },
    {
      key: 'by',
      header: 'المسجِّل',
      className: 'whitespace-nowrap text-xs',
      render: (r) => r.recordedByName || '—',
    },
    {
      key: 'actions',
      header: 'إجراءات',
      className: 'whitespace-nowrap text-left pl-4',
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2.5 text-xs font-semibold"
            onClick={() => {
              setEditing(r);
              setModalOpen(true);
            }}
          >
            <Edit3 className="h-3.5 w-3.5" />
            تعديل
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600"
            onClick={() => {
              if (window.confirm(`هل أنت متأكد من حذف المصروف «${r.title}»؟`)) {
                deleteMutation.mutate(r.id);
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {data?.summary && (
        <Card className="p-4 flex flex-wrap items-center justify-between gap-3 bg-muted/20">
          <div>
            <span className="text-xs text-muted-foreground block">
              إجمالي مصروفات الشهر المحدد
            </span>
            <span className="text-xl font-extrabold text-rose-600 dark:text-rose-400">
              {formatCurrency(data.summary.monthTotal)}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(data.summary.byCategory).map(([cat, sum]) => (
              <Badge key={cat} variant="neutral" className="text-xs">
                {EXPENSE_CATEGORY_LABELS[cat] ?? cat}: {formatCurrency(sum)}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <ServerDataTable
        columns={columns}
        data={data?.data ?? []}
        meta={data?.meta}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => {
          setEditing(r);
          setModalOpen(true);
        }}
        searchPlaceholder="ابحث في بيان المصروف أو الملاحظات..."
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
              placeholder="كل بنود المصروفات"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              options={EXPENSE_CATEGORY_OPTIONS}
              className="w-48"
            />
            {(categoryFilter || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCategoryFilter('');
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
        actions={
          <Button
            size="sm"
            className="h-9 gap-1.5 px-3.5 text-xs font-semibold shadow-sm"
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            تسجيل مصروف جديد
          </Button>
        }
      />

      <ExpenseFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        yearMonth={yearMonth}
        editing={editing}
      />
    </div>
  );
}
