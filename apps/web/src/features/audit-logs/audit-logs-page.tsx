import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_PAGE_SIZE, PaginatedResult } from '@edu-center/shared';
import { Badge, PageHeader, Select, ServerDataTable, TableColumn } from '@/design-system';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient } from '@/lib/api-client';
import { formatDateAr } from '@/lib/formatters';

interface AuditLogRow {
  id: string;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export function AuditLogsPage() {
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [entityType, setEntityType] = React.useState('');

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
      render: (r) => (
        <span className="text-xs font-medium text-muted-foreground">
          {formatDateAr(r.createdAt)} - {new Date(r.createdAt).toLocaleTimeString('ar-EG')}
        </span>
      ),
    },
    {
      key: 'actor',
      header: 'المستخدم المنفّذ',
      render: (r) => <span className="font-bold">{r.actorName || 'النظام'}</span>,
    },
    {
      key: 'action',
      header: 'العملية',
      render: (r) => <Badge variant="info">{r.action}</Badge>,
    },
    {
      key: 'entityType',
      header: 'القسم / الكيان',
      render: (r) => <Badge variant="neutral">{r.entityType}</Badge>,
    },
    {
      key: 'entityId',
      header: 'معرّف السجل',
      render: (r) => <span className="font-mono text-xs">{r.entityId?.slice(0, 8) || '—'}</span>,
    },
    {
      key: 'ip',
      header: 'عنوان IP',
      render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.ipAddress || '—'}</span>,
    },
  ];

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
          <Select
            placeholder="كل الأقسام"
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
            className="w-44"
            options={[
              { value: 'AUTH', label: 'تسجيل الدخول' },
              { value: 'USER', label: 'المستخدمون' },
              { value: 'ROLE', label: 'الأدوار والصلاحيات' },
              { value: 'STUDENT', label: 'الطلاب' },
              { value: 'TEACHER', label: 'المدرسون' },
              { value: 'ASSISTANT', label: 'المساعدون' },
              { value: 'GROUP', label: 'المجموعات' },
              { value: 'ENROLLMENT', label: 'الاشتراكات' },
              { value: 'ATTENDANCE', label: 'الحضور والغياب' },
              { value: 'PAYMENT', label: 'المدفوعات' },
              { value: 'EXPENSE', label: 'المصروفات' },
              { value: 'BOOKING', label: 'الحجوزات' },
              { value: 'CLASSROOM', label: 'القاعات' },
            ]}
          />
        }
      />
    </div>
  );
}

