import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, DatePicker, Input, Modal, Textarea, useToast } from '@/design-system';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { formatCurrency, getTodayIsoDate } from '@/lib/formatters';
import {
  LookupStudentOption,
  StudentMultiSelectList,
} from './components/student-multi-select-list';
import { GroupDetailData } from './groups.types';

interface SubscribeStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: GroupDetailData;
}

interface BulkSubscribeResponse {
  enrolledCount: number;
  skippedAlreadyEnrolledCount: number;
  createdIds: string[];
}

export function SubscribeStudentModal({
  open,
  onOpenChange,
  group,
}: SubscribeStudentModalProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const [selectedStudentIds, setSelectedStudentIds] = React.useState<string[]>([]);
  const [startDate, setStartDate] = React.useState(getTodayIsoDate());
  const [agreedMonthlyPrice, setAgreedMonthlyPrice] = React.useState(String(group.monthlyPrice));
  const [agreedSessionsCount, setAgreedSessionsCount] = React.useState(
    String(group.monthlySessionsCount),
  );
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setSelectedStudentIds([]);
      setStartDate(getTodayIsoDate());
      setAgreedMonthlyPrice(String(group.monthlyPrice));
      setAgreedSessionsCount(String(group.monthlySessionsCount));
      setNotes('');
    }
  }, [open, group]);

  const { data: lookupsData, isLoading: isLoadingStudents } = useQuery<{
    students: LookupStudentOption[];
  }>({
    queryKey: ['groups-lookups'],
    enabled: open,
    queryFn: async () => (await apiClient.get('/groups/lookups')).data,
  });

  const { data: activeStudentsData } = useQuery<{ studentIds: string[] }>({
    queryKey: ['group-active-student-ids', group.id],
    enabled: open,
    queryFn: async () =>
      (await apiClient.get(`/groups/${group.id}/enrollments/active-student-ids`)).data,
  });

  const activeStudentIdsSet = React.useMemo(
    () => new Set(activeStudentsData?.studentIds ?? []),
    [activeStudentsData?.studentIds],
  );

  const activeCount = activeStudentsData
    ? activeStudentIdsSet.size
    : (group.activeStudentsCount ?? 0);
  const remainingSeats = Math.max(0, group.maxStudents - activeCount);

  const computedSessionPrice =
    Number(agreedSessionsCount) > 0
      ? Number(agreedMonthlyPrice || 0) / Number(agreedSessionsCount)
      : 0;

  const subscribeMutation = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<BulkSubscribeResponse>(`/groups/${group.id}/enrollments/bulk`, {
          studentIds: selectedStudentIds,
          startDate,
          agreedMonthlyPrice: Number(agreedMonthlyPrice),
          agreedSessionsCount: Number(agreedSessionsCount),
          agreedSessionPrice: Number(computedSessionPrice.toFixed(2)),
          notes: notes || undefined,
          skipAlreadyEnrolled: true,
        })
      ).data,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['group-enrollments', group.id] });
      queryClient.invalidateQueries({ queryKey: ['group-active-student-ids', group.id] });
      queryClient.invalidateQueries({ queryKey: ['group-detail', group.id] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['classroom-allocated-groups'] });
      queryClient.invalidateQueries({ queryKey: ['classroom-unallocated-groups'] });
      queryClient.invalidateQueries({ queryKey: ['finance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
      notify(
        res.enrolledCount === 1
          ? 'تم تسجيل اشتراك الطالب بالمجموعة بنجاح'
          : `تم تسجيل اشتراك ${res.enrolledCount} طلاب بالمجموعة بنجاح`,
        'success',
      );
      onOpenChange(false);
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const canSubmit =
    selectedStudentIds.length > 0 &&
    selectedStudentIds.length <= remainingSeats &&
    !subscribeMutation.isPending;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={`تسجيل اشتراك طلاب في: ${group.name}`}
      description="ابحث واختر طالباً واحداً أو عدة طلاب دفعة واحدة؛ ويُدرج الاشتراك الشهري للمجموعة عليهم تلقائياً"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSubmit) return;
          subscribeMutation.mutate();
        }}
        className="space-y-4"
      >
        <StudentMultiSelectList
          students={lookupsData?.students ?? []}
          selectedIds={selectedStudentIds}
          onChangeSelectedIds={setSelectedStudentIds}
          activeStudentIds={activeStudentIdsSet}
          groupGradeLevel={group.gradeLevel}
          remainingSeats={remainingSeats}
          isLoading={isLoadingStudents}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <DatePicker
            label="تاريخ بدء الاشتراك"
            value={startDate}
            onChange={setStartDate}
          />
          <Input
            label="الاشتراك الشهري المتفق عليه"
            type="number"
            min={0}
            step="0.01"
            required
            value={agreedMonthlyPrice}
            onChange={(e) => setAgreedMonthlyPrice(e.target.value)}
          />
          <Input
            label="عدد الحصص الشهرية"
            type="number"
            min={1}
            required
            value={agreedSessionsCount}
            onChange={(e) => setAgreedSessionsCount(e.target.value)}
          />
        </div>

        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">
          سعر الحصة الواحدة المطبق على الطلاب المختارين: {formatCurrency(computedSessionPrice)}
        </div>

        <Textarea
          label="ملاحظات الاشتراك أو الخصم الخاص (تُطبق على المحددين)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            type="submit"
            disabled={!canSubmit}
            isLoading={subscribeMutation.isPending}
          >
            {selectedStudentIds.length > 0
              ? `تأكيد اشتراك (${selectedStudentIds.length}) طالب`
              : 'تأكيد الاشتراك'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
