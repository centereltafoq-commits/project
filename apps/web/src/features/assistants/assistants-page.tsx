import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Edit3, Eye, Plus, RotateCcw } from 'lucide-react';
import {
  AssistantCalculationMethod,
  DEFAULT_PAGE_SIZE,
  PaginatedResult,
  PERMISSIONS,
} from '@edu-center/shared';
import {
  Badge,
  Button,
  PageHeader,
  Select,
  ServerDataTable,
  TableColumn,
} from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/formatters';
import { AssistantFormModal } from './assistant-form-modal';
import { AssistantQuickViewModal } from './components/assistant-quick-view-modal';
import {
  ASSISTANT_CALC_METHOD_LABELS,
  ASSISTANT_CALC_METHOD_OPTIONS,
  ASSISTANT_STATUS_OPTIONS,
  AssistantRow,
} from './assistants.types';

export function AssistantsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManageAssistants = hasPermission(PERMISSIONS.ASSISTANTS_MANAGE);

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = React.useState('');
  const [methodFilter, setMethodFilter] = React.useState('');

  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingAssistant, setEditingAssistant] = React.useState<AssistantRow | null>(null);
  const [quickViewAssistant, setQuickViewAssistant] = React.useState<AssistantRow | null>(null);
  const [quickViewOpen, setQuickViewOpen] = React.useState(false);

  const { data, isLoading } = useQuery<PaginatedResult<AssistantRow>>({
    queryKey: ['assistants', page, limit, debouncedSearch, statusFilter, methodFilter],
    queryFn: async () => {
      const res = await apiClient.get('/assistants', {
        params: {
          page,
          limit,
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
          calculationMethod: methodFilter || undefined,
        },
      });
      return res.data;
    },
  });

  const columns: TableColumn<AssistantRow>[] = [
    {
      key: 'assistantCode',
      header: 'كود المساعد',
      className: 'whitespace-nowrap font-mono',
      render: (row) => (
        <span className="inline-block rounded-md bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
          {row.assistantCode}
        </span>
      ),
    },
    {
      key: 'fullName',
      header: 'الاسم الكامل',
      className: 'whitespace-nowrap',
      render: (row) => (
        <span className="font-bold text-foreground hover:text-primary transition-colors cursor-pointer">
          {row.fullName}
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'رقم الهاتف',
      className: 'whitespace-nowrap font-mono',
      render: (row) => (
        <span dir="ltr" className="font-mono text-xs font-semibold text-foreground">
          {row.phone || '—'}
        </span>
      ),
    },
    {
      key: 'calculationMethod',
      header: 'نظام المستحقات والقيمة',
      className: 'whitespace-nowrap',
      render: (row) => {
        const isPct =
          row.calculationMethod === AssistantCalculationMethod.SESSION_COMMISSION_PERCENT;
        const valStr = isPct ? `${Number(row.rateValue)}%` : formatCurrency(row.rateValue);
        return (
          <div className="flex items-center gap-2">
            <Badge variant="info">
              {ASSISTANT_CALC_METHOD_LABELS[row.calculationMethod] ?? row.calculationMethod}
            </Badge>
            <span className="font-extrabold text-xs text-foreground font-mono">
              ({valStr})
            </span>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'الحالة',
      className: 'whitespace-nowrap',
      render: (row) =>
        row.status === 'ACTIVE' ? (
          <Badge variant="success">نشط</Badge>
        ) : (
          <Badge variant="danger">متوقف</Badge>
        ),
    },
    {
      key: 'actions',
      header: 'إجراءات',
      className: 'whitespace-nowrap text-left pl-4',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 px-3 text-xs font-bold"
            onClick={() => {
              setQuickViewAssistant(row);
              setQuickViewOpen(true);
            }}
          >
            <Eye className="h-3.5 w-3.5 text-primary" />
            تفاصيل
          </Button>
          {canManageAssistants && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setEditingAssistant(row);
                setModalOpen(true);
              }}
            >
              <Edit3 className="h-3.5 w-3.5" />
              تعديل
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="إدارة المساعدين ونظام المستحقات المرن"
        description="متابعة المساعدين والمجموعات المرتبطة بهم وطرق احتساب مستحقاتهم الـ 6 المختلفة"
        actions={
          canManageAssistants ? (
            <Button
              onClick={() => {
                setEditingAssistant(null);
                setModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              إضافة مساعد جديد
            </Button>
          ) : null
        }
      />

      <ServerDataTable
        columns={columns}
        data={data?.data ?? []}
        meta={data?.meta}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => {
          setQuickViewAssistant(r);
          setQuickViewOpen(true);
        }}
        searchPlaceholder="ابحث باسم المساعد أو الكود أو رقم الهاتف..."
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
              placeholder="كل طرق الاحتساب"
              value={methodFilter}
              onChange={(e) => {
                setMethodFilter(e.target.value);
                setPage(1);
              }}
              options={ASSISTANT_CALC_METHOD_OPTIONS}
              className="w-56"
            />
            <Select
              placeholder="كل الحالات"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              options={ASSISTANT_STATUS_OPTIONS}
              className="w-36"
            />
            {(methodFilter || statusFilter || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMethodFilter('');
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

      <AssistantFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        assistant={editingAssistant}
      />

      <AssistantQuickViewModal
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
        assistant={quickViewAssistant}
        onEdit={(a) => {
          setEditingAssistant(a);
          setModalOpen(true);
        }}
      />
    </div>
  );
}
