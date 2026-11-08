import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Banknote, Lock, Plus, RotateCcw } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, PaginatedResult, PERMISSIONS } from '@edu-center/shared';
import {
  Badge,
  Button,
  Select,
  ServerDataTable,
  TableColumn,
} from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/formatters';
import {
  FinanceLookups,
  PaymentRow,
  StudentMonthlyRecordRow,
} from '../finance.types';
import { CollectPaymentModal } from '../modals/collect-payment-modal';

interface StudentBillingTabProps {
  yearMonth: string;
  isMonthClosed?: boolean;
  lookups?: FinanceLookups;
  onShowReceipt: (receipt: PaymentRow) => void;
}

export function StudentBillingTab({
  yearMonth,
  isMonthClosed = false,
  lookups,
  onShowReceipt,
}: StudentBillingTabProps) {
  const { hasPermission } = useAuth();
  const canCollect = hasPermission(PERMISSIONS.FINANCE_COLLECT_PAYMENT) && !isMonthClosed;

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [groupId, setGroupId] = React.useState('');
  const [onlyUnpaid, setOnlyUnpaid] = React.useState(false);

  const [collectOpen, setCollectOpen] = React.useState(false);
  const [selectedRecord, setSelectedRecord] =
    React.useState<StudentMonthlyRecordRow | null>(null);

  React.useEffect(() => {
    setPage(1);
  }, [yearMonth]);

  const { data, isLoading } = useQuery<PaginatedResult<StudentMonthlyRecordRow>>({
    queryKey: ['finance', 'student-records', yearMonth, page, limit, debouncedSearch, groupId, onlyUnpaid],
    queryFn: async () =>
      (
        await apiClient.get('/finance/student-records', {
          params: {
            yearMonth,
            page,
            limit,
            search: debouncedSearch || undefined,
            groupId: groupId || undefined,
            onlyUnpaid: onlyUnpaid ? 'true' : undefined,
          },
        })
      ).data,
  });

  const columns = React.useMemo<TableColumn<StudentMonthlyRecordRow>[]>(() => {
    const cols: TableColumn<StudentMonthlyRecordRow>[] = [
      {
        key: 'student',
        header: 'الطالب',
        render: (r) => (
          <div>
            <div className="font-bold text-foreground text-xs">{r.studentName}</div>
            <div className="font-mono text-[11px] text-muted-foreground">
              {r.studentCode} • {r.studentPhone}
            </div>
          </div>
        ),
      },
      {
        key: 'group',
        header: 'المجموعة',
        render: (r) => (
          <div className="max-w-[200px]">
            <div className="font-semibold text-foreground text-xs truncate" title={r.groupName}>
              {r.groupName}
            </div>
            <span className="inline-block rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
              {r.groupCode}
            </span>
          </div>
        ),
      },
      {
        key: 'attendance',
        header: 'الحضور / المؤهل',
        render: (r) => (
          <div className="text-xs space-y-0.5">
            <span className="font-bold text-foreground">
              حضر {r.presentCount + r.makeupAttendedCount} من {r.eligibleSessions} حصة
            </span>
            <div className="text-[11px] text-muted-foreground">
              غياب: {r.absentCount} | إذن: {r.excusedCount} {r.makeupAttendedCount > 0 && `| تعويض: ${r.makeupAttendedCount}`}
            </div>
          </div>
        ),
      },
      {
        key: 'sessionPrice',
        header: 'سعر الحصة',
        render: (r) => (
          <div>
            <span className="font-medium text-xs">{formatCurrency(r.sessionPriceSnapshot)}</span>
            {r.extraMakeupFees > 0 && (
              <div className="text-[10px] text-amber-600 font-medium">
                + تعويضي {formatCurrency(r.extraMakeupFees)}
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'totalDue',
        header: 'المستحق',
        className: 'font-bold text-xs',
        render: (r) => formatCurrency(r.totalDue),
      },
      {
        key: 'totalPaid',
        header: 'المدفوع',
        className: 'font-semibold text-emerald-600 dark:text-emerald-400 text-xs',
        render: (r) => formatCurrency(r.totalPaid),
      },
      {
        key: 'remaining',
        header: 'المتبقي',
        render: (r) =>
          r.remainingBalance > 0 ? (
            <Badge variant="danger" className="font-bold">
              {formatCurrency(r.remainingBalance)}
            </Badge>
          ) : (
            <Badge variant="success">خالص</Badge>
          ),
      },
      {
        key: 'state',
        header: 'الحالة',
        render: (r) =>
          r.isClosed ? (
            <Badge variant="purple" className="gap-1">
              <Lock className="h-3 w-3" />
              مغلق
            </Badge>
          ) : (
            <Badge variant="neutral">مفتوح</Badge>
          ),
      },
    ];

    if (canCollect) {
      cols.push({
        key: 'actions',
        header: 'إجراءات',
        className: 'text-left pl-3',
        render: (r) => (
          <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant={r.remainingBalance > 0 ? 'primary' : 'outline'}
              className="h-8 gap-1 px-3 text-xs font-semibold"
              onClick={() => {
                setSelectedRecord(r);
                setCollectOpen(true);
              }}
            >
              <Banknote className="h-3.5 w-3.5" />
              تحصيل
            </Button>
          </div>
        ),
      });
    }

    return cols;
  }, [canCollect]);

  return (
    <div className="space-y-4">
      <ServerDataTable
        columns={columns}
        data={data?.data ?? []}
        meta={data?.meta}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={
          canCollect
            ? (r) => {
                setSelectedRecord(r);
                setCollectOpen(true);
              }
            : undefined
        }
        searchPlaceholder="ابحث باسم الطالب أو الكود أو الهاتف أو اسم المجموعة..."
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
        emptyTitle="لا توجد سجلات مستحقات طلاب لهذا الشهر"
        emptyDescription="اضغط «إعادة احتساب الشهر» لتوليد وتحديث مستحقات الطلاب حسب الحضور الفعلي."
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              searchable
              clearable
              searchPlaceholder="ابحث في المجموعات..."
              placeholder="كل المجموعات الدراسية"
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value);
                setPage(1);
              }}
              options={(lookups?.groups ?? []).map((g) => ({
                value: g.id,
                label: `${g.name} (${g.code})`,
              }))}
              className="w-52"
            />
            <Button
              size="sm"
              variant={onlyUnpaid ? 'danger' : 'outline'}
              className="h-9 px-3 text-xs"
              onClick={() => {
                setOnlyUnpaid((prev) => !prev);
                setPage(1);
              }}
            >
              {onlyUnpaid ? 'عرض الكل' : 'المتأخرات فقط'}
            </Button>
            {(groupId || onlyUnpaid || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setGroupId('');
                  setOnlyUnpaid(false);
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
          canCollect ? (
            <Button
              size="sm"
              variant="success"
              className="h-9 gap-1.5 px-3.5 text-xs font-semibold shadow-sm"
              onClick={() => {
                setSelectedRecord(null);
                setCollectOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              تسجيل دفعة / إيصال
            </Button>
          ) : null
        }
      />

      <CollectPaymentModal
        open={collectOpen}
        onOpenChange={setCollectOpen}
        yearMonth={yearMonth}
        presetRecord={selectedRecord}
        lookups={lookups}
        onReceiptCreated={onShowReceipt}
      />
    </div>
  );
}
