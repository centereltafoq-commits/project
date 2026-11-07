import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Banknote, Lock, Plus } from 'lucide-react';
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
import { formatCurrency } from '@/lib/formatters';
import {
  FinanceLookups,
  PaymentRow,
  StudentMonthlyRecordRow,
} from '../finance.types';
import { CollectPaymentModal } from '../modals/collect-payment-modal';

interface StudentBillingTabProps {
  yearMonth: string;
  lookups?: FinanceLookups;
  onShowReceipt: (receipt: PaymentRow) => void;
}

export function StudentBillingTab({
  yearMonth,
  lookups,
  onShowReceipt,
}: StudentBillingTabProps) {
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

  const columns: TableColumn<StudentMonthlyRecordRow>[] = [
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
      key: 'group',
      header: 'المجموعة',
      render: (r) => (
        <div>
          <div className="font-semibold text-foreground">{r.groupName}</div>
          <div className="text-xs text-muted-foreground">{r.groupCode}</div>
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
          <div className="text-muted-foreground">
            غياب: {r.absentCount} | إذن: {r.excusedCount} | تعويض: {r.makeupAttendedCount}
          </div>
        </div>
      ),
    },
    {
      key: 'sessionPrice',
      header: 'سعر الحصة',
      render: (r) => (
        <div>
          <span className="font-semibold">{formatCurrency(r.sessionPriceSnapshot)}</span>
          {r.extraMakeupFees > 0 && (
            <div className="text-xs text-amber-600">
              + تعويضي {formatCurrency(r.extraMakeupFees)}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'totalDue',
      header: 'المستحق',
      render: (r) => <span className="font-bold">{formatCurrency(r.totalDue)}</span>,
    },
    {
      key: 'totalPaid',
      header: 'المدفوع',
      render: (r) => (
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(r.totalPaid)}
        </span>
      ),
    },
    {
      key: 'remaining',
      header: 'المتبقي',
      render: (r) =>
        r.remainingBalance > 0 ? (
          <Badge variant="danger">{formatCurrency(r.remainingBalance)}</Badge>
        ) : (
          <Badge variant="success">خالص</Badge>
        ),
    },
    {
      key: 'state',
      header: 'الحالة',
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
          variant={r.remainingBalance > 0 ? 'primary' : 'outline'}
          onClick={() => {
            setSelectedRecord(r);
            setCollectOpen(true);
          }}
        >
          <Banknote className="h-3.5 w-3.5" />
          تحصيل / إيصال
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <ServerDataTable
        columns={columns}
        data={data?.data ?? []}
        meta={data?.meta}
        isLoading={isLoading}
        rowKey={(r) => r.id}
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
          <>
            <Select
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
              onClick={() => {
                setOnlyUnpaid((prev) => !prev);
                setPage(1);
              }}
            >
              {onlyUnpaid ? 'عرض الكل' : 'المتأخرات فقط'}
            </Button>
            <Button
              size="sm"
              variant="success"
              onClick={() => {
                setSelectedRecord(null);
                setCollectOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              تسجيل دفعة / إيصال
            </Button>
          </>
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
