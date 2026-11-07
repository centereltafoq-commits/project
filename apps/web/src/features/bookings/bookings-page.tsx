import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, Plus } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, PaginatedResult, PERMISSIONS } from '@edu-center/shared';
import {
  Badge,
  Button,
  PageHeader,
  ServerDataTable,
  useToast,
} from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { ApproveBookingModal } from './approve-booking-modal';
import { buildBookingColumns } from './bookings-columns';
import { BookingsFilters } from './bookings-filters';
import { BookingLookups, BookingRow } from './bookings.types';
import { BookingQuickViewModal } from './components/booking-quick-view-modal';
import { CreateBookingModal } from './create-booking-modal';

export function BookingsPage() {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission(PERMISSIONS.BOOKINGS_CREATE);
  const canApprove =
    hasPermission(PERMISSIONS.BOOKINGS_APPROVE_ADMIN) ||
    hasPermission(PERMISSIONS.BOOKINGS_APPROVE_TEACHER);

  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);

  const [statusFilter, setStatusFilter] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('');
  const [teacherFilter, setTeacherFilter] = React.useState('');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');

  const [createOpen, setCreateOpen] = React.useState(false);
  const [selectedBooking, setSelectedBooking] = React.useState<BookingRow | null>(null);
  const [quickViewBooking, setQuickViewBooking] = React.useState<BookingRow | null>(null);
  const [quickViewOpen, setQuickViewOpen] = React.useState(false);

  const { data: lookups } = useQuery<BookingLookups>({
    queryKey: ['bookings-lookups'],
    queryFn: async () => (await apiClient.get('/bookings/lookups')).data,
  });

  const { data, isLoading } = useQuery<PaginatedResult<BookingRow>>({
    queryKey: [
      'bookings',
      page,
      limit,
      debouncedSearch,
      statusFilter,
      typeFilter,
      teacherFilter,
      fromDate,
      toDate,
    ],
    queryFn: async () =>
      (
        await apiClient.get('/bookings', {
          params: {
            page,
            limit,
            search: debouncedSearch || undefined,
            status: statusFilter || undefined,
            requestType: typeFilter || undefined,
            teacherId: teacherFilter || undefined,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
          },
        })
      ).data,
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => apiClient.post(`/bookings/${id}/complete`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      notify('تم تحديث حالة الحجز إلى مكتمل', 'success');
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const columns = React.useMemo(
    () =>
      buildBookingColumns({
        canApprove,
        onReview: setSelectedBooking,
        onComplete: (id) => completeMutation.mutate(id),
        onQuickView: (row) => {
          setQuickViewBooking(row);
          setQuickViewOpen(true);
        },
      }),
    [completeMutation, canApprove],
  );

  const hasActiveFilters = Boolean(
    statusFilter || typeFilter || teacherFilter || fromDate || toDate || search,
  );

  const handleResetFilters = () => {
    setStatusFilter('');
    setTypeFilter('');
    setTeacherFilter('');
    setFromDate('');
    setToDate('');
    setSearch('');
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="طلبات حجز المواعيد وتنسيق القاعات"
        description="نظام تنظيمي لحجوزات (طالب مع مدرس) و(مدرس مع السنتر) مع فحص التعارضات تلقائياً بدون أي تأثير مالي"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="neutral" className="hidden py-1.5 px-3 sm:inline-flex">
              <CalendarCheck className="h-3.5 w-3.5" />
              تنظيمي فقط (لا يُنشئ مطالبات مالية)
            </Badge>
            {canCreate && (
              <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                طلب حجز جديد
              </Button>
            )}
          </div>
        }
      />

      <ServerDataTable
        columns={columns}
        data={data?.data ?? []}
        meta={data?.meta}
        isLoading={isLoading}
        rowKey={(r) => r.id}
        onRowClick={(r) => {
          setQuickViewBooking(r);
          setQuickViewOpen(true);
        }}
        searchPlaceholder="ابحث بالغرض أو اسم المدرس أو الطالب..."
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
          <BookingsFilters
            statusFilter={statusFilter}
            onStatusChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            typeFilter={typeFilter}
            onTypeChange={(v) => {
              setTypeFilter(v);
              setPage(1);
            }}
            teacherFilter={teacherFilter}
            onTeacherChange={(v) => {
              setTeacherFilter(v);
              setPage(1);
            }}
            fromDate={fromDate}
            onFromDateChange={(v) => {
              setFromDate(v);
              setPage(1);
            }}
            toDate={toDate}
            onToDateChange={(v) => {
              setToDate(v);
              setPage(1);
            }}
            lookups={lookups}
            hasActiveFilters={hasActiveFilters}
            onReset={handleResetFilters}
          />
        }
      />

      <BookingQuickViewModal
        open={quickViewOpen}
        onOpenChange={setQuickViewOpen}
        booking={quickViewBooking}
        canApprove={canApprove}
        onReview={(b) => setSelectedBooking(b)}
        onComplete={(id) => completeMutation.mutate(id)}
      />

      <CreateBookingModal open={createOpen} onOpenChange={setCreateOpen} lookups={lookups} />
      <ApproveBookingModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
      />
    </div>
  );
}
