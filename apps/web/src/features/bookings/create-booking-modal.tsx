import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookingRequestType } from '@edu-center/shared';
import { Button, DatePicker, Input, Modal, Select, Textarea, useToast } from '@/design-system';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { ARABIC_DAYS, getTodayIsoDate } from '@/lib/formatters';
import { SegmentedToggle } from './bookings-filters';
import { BookingLookups } from './bookings.types';

interface CreateBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lookups?: BookingLookups;
}

export function CreateBookingModal({ open, onOpenChange, lookups }: CreateBookingModalProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();

  const today = getTodayIsoDate();
  const [requestType, setRequestType] = React.useState<BookingRequestType>(
    BookingRequestType.STUDENT_WITH_TEACHER,
  );
  const [recurrence, setRecurrence] = React.useState<'once' | 'series'>('once');
  const [teacherId, setTeacherId] = React.useState('');
  const [studentId, setStudentId] = React.useState('');
  const [purpose, setPurpose] = React.useState('');
  const [requestedDate, setRequestedDate] = React.useState(today);
  const [dayOfWeek, setDayOfWeek] = React.useState('6');
  const [startDate, setStartDate] = React.useState(today);
  const [endDate, setEndDate] = React.useState(today);
  const [startTime, setStartTime] = React.useState('15:00');
  const [endTime, setEndTime] = React.useState('17:00');
  const [requestedClassroomId, setRequestedClassroomId] = React.useState('');
  const [expectedAttendees, setExpectedAttendees] = React.useState('1');
  const [notes, setNotes] = React.useState('');

  const isSeries = recurrence === 'series';

  const mutation = useMutation({
    mutationFn: async () => {
      const common = {
        requestType,
        teacherId,
        studentId:
          requestType === BookingRequestType.STUDENT_WITH_TEACHER ? studentId : undefined,
        purpose,
        startTime,
        endTime,
        requestedClassroomId: requestedClassroomId || undefined,
        expectedAttendees: Number(expectedAttendees) || 1,
        notes: notes || undefined,
      };
      const url = isSeries ? '/bookings/series' : '/bookings';
      const payload = isSeries
        ? { ...common, dayOfWeek: Number(dayOfWeek), startDate, endDate }
        : { ...common, requestedDate };
      return (await apiClient.post(url, payload)).data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      if (isSeries) {
        const warn =
          res.conflictsCount > 0 ? ` (تنبيه: ${res.conflictsCount} موعد به تعارض للمراجعة)` : '';
        notify(
          `تم إنشاء السلسلة الأسبوعية (${res.occurrencesCount} موعد)${warn}`,
          res.conflictsCount > 0 ? 'info' : 'success',
        );
      } else {
        notify(
          res.hasConflict
            ? 'تم تسجيل الطلب مع وجود تنبيه تعارض للمراجعة الإدارية'
            : 'تم إرسال طلب الحجز التنظيمي بنجاح',
          res.hasConflict ? 'info' : 'success',
        );
      }
      onOpenChange(false);
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="إنشاء طلب حجز موعد تنظيمي"
      description="نظام حجز تنظيمي لتنسيق المواعيد والقاعات فقط — لا يترتب عليه أي فواتير أو مطالبات مالية"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SegmentedToggle
            label="نوع طلب الحجز"
            value={requestType}
            onChange={(val) => {
              setRequestType(val);
              setExpectedAttendees(val === BookingRequestType.STUDENT_WITH_TEACHER ? '1' : '30');
            }}
            options={[
              { value: BookingRequestType.STUDENT_WITH_TEACHER, label: 'طالب مع مدرس' },
              { value: BookingRequestType.TEACHER_WITH_CENTER, label: 'مدرس مع السنتر' },
            ]}
          />
          <SegmentedToggle
            label="نمط التكرار"
            value={recurrence}
            onChange={setRecurrence}
            activeClass="border-violet-600 bg-violet-600 text-white"
            options={[
              { value: 'once', label: 'حجز لمرة واحدة' },
              { value: 'series', label: 'حجز أسبوعي متكرر' },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="المدرس"
            required
            searchable
            searchPlaceholder="ابحث باسم المدرس أو التخصص..."
            placeholder="اختر المدرس..."
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
            options={(lookups?.teachers ?? []).map((t) => ({
              value: t.id,
              label: `${t.fullName} — ${t.specialization}`,
            }))}
          />
          {requestType === BookingRequestType.STUDENT_WITH_TEACHER ? (
            <Select
              label="الطالب"
              required
              searchable
              searchPlaceholder="ابحث باسم الطالب أو الكود..."
              placeholder="اختر الطالب..."
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              options={(lookups?.students ?? []).map((s) => ({
                value: s.id,
                label: `${s.fullName} (${s.studentCode})`,
              }))}
            />
          ) : (
            <Input
              label="عدد الحضور المتوقع بالقاعة"
              type="number"
              min="1"
              max="500"
              required
              value={expectedAttendees}
              onChange={(e) => setExpectedAttendees(e.target.value)}
            />
          )}
        </div>

        <Input
          label="الغرض من الحجز / العنوان"
          required
          placeholder="مثال: مراجعة ليلة الامتحان / حصة تقوية فردية"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
        />

        {!isSeries ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <DatePicker
              label="تاريخ الحجز"
              value={requestedDate}
              onChange={setRequestedDate}
            />
            <Input
              label="من الساعة"
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <Input
              label="إلى الساعة"
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Select
                label="اليوم الأسبوعي الثابت"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                options={ARABIC_DAYS.map((name, idx) => ({ value: String(idx), label: name }))}
              />
              <DatePicker
                label="من تاريخ"
                value={startDate}
                onChange={setStartDate}
              />
              <DatePicker
                label="إلى تاريخ"
                value={endDate}
                onChange={setEndDate}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="وقت البداية"
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <Input
                label="وقت النهاية"
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
        )}

        <Select
          label="القاعة المفضلة (اختياري — التخصيص النهائي للإدارة)"
          placeholder="بدون تفضيل قاعة محددة"
          value={requestedClassroomId}
          onChange={(e) => setRequestedClassroomId(e.target.value)}
          options={(lookups?.classrooms ?? []).map((c) => ({
            value: c.id,
            label: `${c.name} (${c.roomNumber}) — سعة ${c.maxCapacity}`,
          }))}
        />

        <Textarea label="ملاحظات إضافية" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="submit" isLoading={mutation.isPending}>
            {isSeries ? 'توليد السلسلة الأسبوعية' : 'إرسال طلب الحجز'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
