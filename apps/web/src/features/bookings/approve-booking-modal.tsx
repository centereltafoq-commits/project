import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Ban, Building2, CheckCircle2, XCircle } from 'lucide-react';
import { BookingStatus, PERMISSIONS } from '@edu-center/shared';
import { Badge, Button, Input, Modal, Select, Textarea, useToast } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import {
  AvailableClassroomsResponse,
  BOOKING_TYPE_LABELS,
  BookingRow,
} from './bookings.types';

interface ApproveBookingModalProps {
  booking: BookingRow | null;
  onClose: () => void;
}

export function ApproveBookingModal({ booking, onClose }: ApproveBookingModalProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const { hasPermission } = useAuth();

  const isAdminApprover = hasPermission(PERMISSIONS.BOOKINGS_APPROVE_ADMIN);
  const canReview = isAdminApprover || hasPermission(PERMISSIONS.BOOKINGS_APPROVE_TEACHER);

  const [requestedDate, setRequestedDate] = React.useState('');
  const [startTime, setStartTime] = React.useState('');
  const [endTime, setEndTime] = React.useState('');
  const [expectedAttendees, setExpectedAttendees] = React.useState('1');
  const [assignedClassroomId, setAssignedClassroomId] = React.useState('');
  const [comment, setComment] = React.useState('');

  React.useEffect(() => {
    if (!booking) return;
    setRequestedDate(booking.requestedDate);
    setStartTime(booking.startTime);
    setEndTime(booking.endTime);
    setExpectedAttendees(String(booking.expectedAttendees));
    setAssignedClassroomId(booking.assignedClassroomId ?? booking.requestedClassroomId ?? '');
    setComment('');
  }, [booking]);

  const { data: availability, isFetching: loadingRooms } =
    useQuery<AvailableClassroomsResponse>({
      queryKey: [
        'booking-available-classrooms',
        booking?.id,
        requestedDate,
        startTime,
        endTime,
        expectedAttendees,
      ],
      enabled: Boolean(booking?.id && requestedDate && startTime && endTime),
      queryFn: async () =>
        (
          await apiClient.get(`/bookings/${booking!.id}/available-classrooms`, {
            params: {
              date: requestedDate,
              startTime,
              endTime,
              expectedAttendees: Number(expectedAttendees) || 1,
            },
          })
        ).data,
    });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
  };

  const reviewMutation = useMutation({
    mutationFn: async (status: BookingStatus.CONFIRMED | BookingStatus.REJECTED) =>
      apiClient.post(`/bookings/${booking!.id}/review`, {
        status,
        requestedDate,
        startTime,
        endTime,
        expectedAttendees: Number(expectedAttendees) || 1,
        ...(isAdminApprover ? { assignedClassroomId: assignedClassroomId || undefined } : {}),
        comment: comment || undefined,
      }),
    onSuccess: (_, status) => {
      invalidateAll();
      notify(
        status === BookingStatus.CONFIRMED
          ? 'تم اعتماد وتأكيد الحجز بنجاح دون تعارضات'
          : 'تم رفض طلب الحجز',
        'success',
      );
      onClose();
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  const cancelSingleMutation = useMutation({
    mutationFn: async () =>
      apiClient.post(`/bookings/${booking!.id}/cancel`, {
        comment: comment || 'إلغاء هذا الموعد المنفرد',
      }),
    onSuccess: () => {
      invalidateAll();
      notify('تم إلغاء هذا الموعد فقط وتحرير القاعة المخصصة له', 'success');
      onClose();
    },
    onError: (err) => notify(extractErrorMessage(err), 'error'),
  });

  return (
    <Modal
      open={Boolean(booking)}
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title="مراجعة طلب الحجز وتخصيص القاعة"
      description={
        booking
          ? `${BOOKING_TYPE_LABELS[booking.requestType] ?? booking.requestType} — المدرس: ${booking.teacherName}${booking.studentName ? ` | الطالب: ${booking.studentName}` : ''}`
          : undefined
      }
    >
      {booking && (
        <div className="space-y-4">
          {booking.seriesId && (
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-xs text-violet-800 dark:text-violet-200">
              هذا الموعد جزء من <strong>سلسلة أسبوعية متكررة</strong>؛ الإلغاء هنا يُطبّق على{' '}
              <strong>هذا التاريخ فقط</strong> دون إلغاء باقي السلسلة.
            </div>
          )}

          {availability && availability.participantConflicts.length > 0 && (
            <div className="space-y-1 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                تنبيه تعارض في جدول المدرس أو الطالب:
              </div>
              {availability.participantConflicts.map((c, idx) => (
                <p key={idx}>• {c.message}</p>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Input
              label="التاريخ"
              type="date"
              value={requestedDate}
              onChange={(e) => setRequestedDate(e.target.value)}
            />
            <Input
              label="من الساعة"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <Input
              label="إلى الساعة"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
            <Input
              label="الحضور المتوقع"
              type="number"
              min="1"
              value={expectedAttendees}
              onChange={(e) => setExpectedAttendees(e.target.value)}
            />
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-muted/20 p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                <Building2 className="h-4 w-4 text-primary" />
                تخصيص القاعة الدراسية يدوياً (خاص بالإدارة)
              </span>
              <Badge variant="success">
                {loadingRooms ? '...' : availability?.availableClassrooms.length ?? 0} قاعة متاحة
              </Badge>
            </div>

            {isAdminApprover ? (
              <Select
                placeholder="بدون تخصيص قاعة / اختر قاعة متاحة..."
                value={assignedClassroomId}
                onChange={(e) => setAssignedClassroomId(e.target.value)}
                options={(availability?.availableClassrooms ?? []).map((room) => ({
                  value: room.id,
                  label: `${room.name} (قاعة ${room.roomNumber}) — سعة ${room.maxCapacity} مقعد`,
                }))}
              />
            ) : (
              <p className="text-xs text-muted-foreground">
                تخصيص القاعات متاح لمسؤولي الإدارة فقط.
              </p>
            )}

            {availability && availability.unavailableClassrooms.length > 0 && (
              <div className="pt-1 text-xs text-muted-foreground">
                <span className="font-semibold">غير متاحة حالياً: </span>
                {availability.unavailableClassrooms.map((u) => (
                  <span key={u.id} className="ml-2 inline-block">
                    • {u.name}: ({u.reasons.join('، ')})
                  </span>
                ))}
              </div>
            )}
          </div>

          <Textarea
            label="ملاحظة القرار / سبب الرفض أو التعديل"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            {booking.status !== BookingStatus.CANCELLED && (
              <Button
                type="button"
                variant="outline"
                isLoading={cancelSingleMutation.isPending}
                onClick={() => cancelSingleMutation.mutate()}
              >
                <Ban className="h-4 w-4" />
                إلغاء هذا الموعد فقط
              </Button>
            )}
            <div className="mr-auto flex flex-wrap gap-2">
              {canReview && booking.status !== BookingStatus.REJECTED && (
                <Button
                  type="button"
                  variant="danger"
                  isLoading={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate(BookingStatus.REJECTED)}
                >
                  <XCircle className="h-4 w-4" />
                  رفض الطلب
                </Button>
              )}
              {canReview && (
                <Button
                  type="button"
                  variant="success"
                  isLoading={reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate(BookingStatus.CONFIRMED)}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  اعتماد وتأكيد الحجز
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
