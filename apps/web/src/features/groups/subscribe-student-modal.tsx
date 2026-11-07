import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PaginatedResult } from '@edu-center/shared';
import { Button, Input, Modal, Select, Textarea, useToast } from '@/design-system';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { formatCurrency, getTodayIsoDate } from '@/lib/formatters';
import { StudentRow } from '../students/students.types';
import { GroupDetailData } from './groups.types';

interface SubscribeStudentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: GroupDetailData;
}

export function SubscribeStudentModal({
  open,
  onOpenChange,
  group,
}: SubscribeStudentModalProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const [studentSearch, setStudentSearch] = React.useState('');
  const debouncedStudentSearch = useDebounce(studentSearch, 250);
  const [studentId, setStudentId] = React.useState('');
  const [startDate, setStartDate] = React.useState(getTodayIsoDate());
  const [agreedMonthlyPrice, setAgreedMonthlyPrice] = React.useState(String(group.monthlyPrice));
  const [agreedSessionsCount, setAgreedSessionsCount] = React.useState(
    String(group.monthlySessionsCount),
  );
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setStudentId('');
      setStartDate(getTodayIsoDate());
      setAgreedMonthlyPrice(String(group.monthlyPrice));
      setAgreedSessionsCount(String(group.monthlySessionsCount));
      setNotes('');
    }
  }, [open, group]);

  const { data: studentsList } = useQuery<PaginatedResult<StudentRow>>({
    queryKey: ['students-picker', debouncedStudentSearch],
    enabled: open,
    queryFn: async () =>
      (
        await apiClient.get('/students', {
          params: {
            limit: 50,
            status: 'ACTIVE',
            search: debouncedStudentSearch || undefined,
          },
        })
      ).data,
  });

  const computedSessionPrice =
    Number(agreedSessionsCount) > 0
      ? Number(agreedMonthlyPrice || 0) / Number(agreedSessionsCount)
      : 0;

  const subscribeMutation = useMutation({
    mutationFn: async () =>
      apiClient.post(`/groups/${group.id}/enrollments`, {
        studentId,
        startDate,
        agreedMonthlyPrice: Number(agreedMonthlyPrice),
        agreedSessionsCount: Number(agreedSessionsCount),
        agreedSessionPrice: Number(computedSessionPrice.toFixed(2)),
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-enrollments', group.id] });
      queryClient.invalidateQueries({ queryKey: ['group-detail', group.id] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      notify('تم تسجيل اشتراك الطالب بالمجموعة بنجاح', 'success');
      onOpenChange(false);
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={`تسجيل اشتراك طالب في: ${group.name}`}
      description="يدعم النظام الاشتراك من منتصف الشهر وتُحتسب فقط الحصص اللاحقة لتاريخ بدء الاشتراك"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          subscribeMutation.mutate();
        }}
        className="space-y-4"
      >
        <Input
          label="ابحث عن الطالب بالاسم أو الكود أو الهاتف"
          placeholder="اكتب اسم الطالب لتصفية القائمة..."
          value={studentSearch}
          onChange={(e) => setStudentSearch(e.target.value)}
        />
        <Select
          label="اختر الطالب"
          required
          placeholder="اختر الطالب من القائمة"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
          options={(studentsList?.data ?? []).map((s) => ({
            value: s.id,
            label: `${s.fullName} (${s.studentCode}) - ${s.gradeLevel}`,
          }))}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label="تاريخ بدء الاشتراك"
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            hint="يدعم الالتحاق في منتصف الشهر"
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
          سعر الحصة الواحدة المطبق على هذا الطالب: {formatCurrency(computedSessionPrice)}
        </div>

        <Textarea
          label="ملاحظات الاشتراك أو الخصم الخاص"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="submit" isLoading={subscribeMutation.isPending}>
            تأكيد الاشتراك
          </Button>
        </div>
      </form>
    </Modal>
  );
}
