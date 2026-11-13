import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, RotateCcw } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, PaginatedResult } from '@edu-center/shared';
import { Badge, Button, PageHeader, Select, ServerDataTable, TableColumn } from '@/design-system';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient } from '@/lib/api-client';
import { formatDateTimeAr } from '@/lib/formatters';
import { translateAuditAction, translateAuditEntity } from '@/lib/translations';
import {
  AuditLogQuickViewModal,
  AuditLogRow,
} from './components/audit-log-quick-view-modal';

export function AuditLogsPage() {
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [entityType, setEntityType] = React.useState('');

  const [quickViewLog, setQuickViewLog] = React.useState<AuditLogRow | null>(null);
  const [quickViewOpen, setQuickViewOpen] = React.useState(false);

  const { data, isLoading } = useQuery<PaginatedResult<AuditLogRow>>({
    queryKey: ['audit-logs', page, limit, debouncedSearch, entityType],
    queryFn: async () => {
      const res = await apiClient.get('/audit-logs', {
        params: {
          page,
          limit,
          search: debouncedSearch || undefined,
          entityType: entityType || undefined,
        },
      });
      return res.data;
    },
  });

  const columns: TableColumn<AuditLogRow>[] = [
    {
      key: 'createdAt',
      header: 'التاريخ والوقت',
      className: 'whitespace-nowrap font-mono',
      render: (r) => (
        <span className="text-xs font-medium text-muted-foreground font-mono">
          {formatDateTimeAr(r.createdAt)}
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'المستخدم المنفّذ',
      className: 'whitespace-nowrap',
      render: (r) => (
        <span className="font-bold text-foreground text-xs hover:text-primary transition-colors cursor-pointer">
          {r.actorName || 'النظام'}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'العملية',
      className: 'whitespace-nowrap',
      render: (r) => {
        const actionMeta = translateAuditAction(r.action);
        const actionLabel = r.actionAr || actionMeta.label;
        return <Badge variant={actionMeta.variant} className="text-xs">{actionLabel}</Badge>;
      },
    },
    {
      key: 'entityType',
      header: 'القسم / الكيان',
      className: 'whitespace-nowrap',
      render: (r) => {
        const entityLabel = r.entityTypeAr || translateAuditEntity(r.entityType);
        return <Badge variant="neutral" className="text-xs">{entityLabel}</Badge>;
      },
    },
    {
      key: 'entityId',
      header: 'معرّف السجل',
      className: 'whitespace-nowrap font-mono',
      render: (r) => (
        <span className="font-mono text-xs text-muted-foreground">
          {r.entityId?.slice(0, 8) || '—'}
        </span>
      ),
    },
    {
      key: 'ip',
      header: 'عنوان IP',
      className: 'whitespace-nowrap font-mono',
      render: (r) => (
        <span className="font-mono text-xs text-muted-foreground" dir="ltr">
          {r.ipAddress || '—'}
        </span>
      ),
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
            onClick={() => {
              setQuickViewLog(r);
              setQuickViewOpen(true);
            }}
          >
            <Eye className="h-3.5 w-3.5 text-primary" />
            تفاصيل
          </Button>
        </div>
      ),
    },
  ];

  const hasActiveFilters = Boolean(entityType || search);

  return (
    <div>
      <PageHeader
        title="سجل العمليات والتعديلات (Audit Logs)"
        description="توثيق كامل وغير قابل للحذف لكافة العمليات الإدارية والمالية والحضور داخل السنتر"
      />

      <ServerDataTable
        columns={columns}
        data={data?.data ?? []}
        meta={data?.meta}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => {
          setQuickViewLog(r);
          setQuickViewOpen(true);
        }}
        searchPlaceholder="ابحث باسم المستخدم أو نوع العملية..."
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v);
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
              searchable
              searchPlaceholder="ابحث في الأقسام..."
              placeholder="كل الأقسام"
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value);
                setPage(1);
              }}
              className="w-48"
              options={[
                { value: 'AUTH', label: 'المصادقة وتسجيل الدخول' },
                { value: 'USER', label: 'المستخدمون' },
                { value: 'ROLE', label: 'الأدوار والصلاحيات' },
                { value: 'STUDENT', label: 'الطلاب' },
                { value: 'TEACHER', label: 'المدرسون' },
                { value: 'ASSISTANT', label: 'المساعدون' },
                { value: 'GROUP', label: 'المجموعات الدراسية' },
                { value: 'GRADE_LEVEL', label: 'الصفوف الدراسية' },
                { value: 'ENROLLMENT', label: 'الاشتراكات' },
                { value: 'ATTENDANCE', label: 'الحضور والغياب' },
                { value: 'PAYMENT', label: 'مدفوعات الطلاب' },
                { value: 'PAYOUT', label: 'صرف مستحقات المدرسين والمساعدين' },
                { value: 'EXPENSE', label: 'المصروفات' },
                { value: 'MONTHLY_SETTLEMENT', label: 'التسويات المالية الشهرية' },
                { value: 'CLASSROOM', label: 'القاعات الدراسية' },
                { value: 'CLASSROOM_MAINTENANCE', label: 'صيانة القاعات' },
                { value: 'BACKUP', label: 'النسخ الاحتياطي' },
                { value: 'SETTINGS', label: 'إعدادات النظام' },
              ]}
            />
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEntityType('');
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

      <AuditLogQuickViewModal
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
        log={quickViewLog}
      />
    </div>
  );
}
