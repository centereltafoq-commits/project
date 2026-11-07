import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  GraduationCap,
  MapPin,
  Repeat,
  Settings2,
  User,
  Users,
} from 'lucide-react';
import { BookingRequestType, BookingStatus } from '@edu-center/shared';
import { Badge, Button, Modal } from '@/design-system';
import { formatDateAr, formatTimeRangeAr } from '@/lib/formatters';
import {
  BOOKING_STATUS_META,
  BOOKING_TYPE_LABELS,
  BookingRow,
} from '../bookings.types';

interface BookingQuickViewModalProps {
  booking: BookingRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReview: (booking: BookingRow) => void;
  onComplete?: (id: string) => void;
}

export function BookingQuickViewModal({
  booking,
  open,
  onOpenChange,
  onReview,
  onComplete,
}: BookingQuickViewModalProps) {
  if (!booking) return null;

  const statusMeta = BOOKING_STATUS_META[booking.status] ?? {
    label: booking.status,
    variant: 'neutral' as const,
  };

  const isConfirmed = booking.status === BookingStatus.CONFIRMED;
  const isPending = booking.status === BookingStatus.PENDING;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="تفاصيل طلب الحجز"
      description="نظرة شاملة على أطراف الحجز والموعد والقاعة المخصصة والغرض"
      size="md"
    >
      <div className="space-y-4">
        {/* ترويسة الحجز */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
              <Badge
                variant={
                  booking.requestType === BookingRequestType.STUDENT_WITH_TEACHER
                    ? 'info'
                    : 'purple'
                }
              >
                {BOOKING_TYPE_LABELS[booking.requestType] ?? booking.requestType}
              </Badge>
              {booking.seriesId && (
                <span className="flex items-center gap-1 text-xs font-semibold text-violet-600">
                  <Repeat className="h-3 w-3" />
                  سلسلة أسبوعية
                </span>
              )}
            </div>
            <h3 className="text-lg font-black text-foreground">{booking.purpose}</h3>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              تاريخ الحجز: {formatDateAr(booking.requestedDate)}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isPending && (
              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onReview(booking);
                }}
                className="gap-1.5 text-xs"
              >
                <Settings2 className="h-3.5 w-3.5" />
                مراجعة واعتماد
              </Button>
            )}
            {isConfirmed && onComplete && (
              <Button
                size="sm"
                variant="success"
                onClick={() => {
                  onOpenChange(false);
                  onComplete(booking.id);
                }}
                className="gap-1.5 text-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                إكمال الحجز
              </Button>
            )}
          </div>
        </div>

        {/* الموعد والوقت */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              الوقت والمدة
            </span>
            <p className="mt-1 text-sm font-bold text-foreground">
              {formatTimeRangeAr(booking.startTime, booking.endTime)}
            </p>
            <span className="text-xs text-muted-foreground font-mono">
              {booking.durationMinutes} دقيقة
            </span>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-emerald-600" />
              القاعة المخصصة
            </span>
            <p className="mt-1 text-sm font-bold text-foreground">
              {booking.assignedClassroomName ? (
                <>
                  {booking.assignedClassroomName}{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    (قاعة #{booking.assignedRoomNumber})
                  </span>
                </>
              ) : booking.requestedClassroomName ? (
                <span className="text-amber-600">
                  مقترحة: {booking.requestedClassroomName} (قيد التأكيد)
                </span>
              ) : (
                <span className="text-muted-foreground">لم تُحدد قاعة بعد</span>
              )}
            </p>
          </div>
        </div>

        {/* أطراف الحجز */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-primary" />
              المدرس
            </span>
            <p className="mt-1 text-sm font-bold text-foreground">
              {booking.teacherName || '—'}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-3.5">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-purple-600" />
              {booking.studentName ? 'الطالب' : 'الحضور المتوقع'}
            </span>
            <p className="mt-1 text-sm font-bold text-foreground">
              {booking.studentName ? (
                <>
                  {booking.studentName}{' '}
                  {booking.studentCode && (
                    <span className="text-xs font-mono text-muted-foreground">
                      ({booking.studentCode})
                    </span>
                  )}
                </>
              ) : (
                `${booking.expectedAttendees} فرد`
              )}
            </p>
          </div>
        </div>

        {/* تفاصيل السلسلة الأسبوعية */}
        {booking.seriesId && (
          <div className="rounded-xl border border-border bg-card p-3 text-xs flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-violet-700 font-bold">
              <Repeat className="h-4 w-4" />
              حجز متكرر أسبوعياً
            </span>
            {booking.seriesEndDate && (
              <span className="text-muted-foreground">
                ينتهي في: {formatDateAr(booking.seriesEndDate)}
              </span>
            )}
          </div>
        )}

        {/* الملاحظات إن وجدت */}
        {booking.notes && (
          <div className="rounded-xl border border-border bg-card p-3 text-xs">
            <span className="font-bold text-muted-foreground block mb-1">ملاحظات الطلب:</span>
            <p className="text-foreground leading-relaxed whitespace-pre-wrap">{booking.notes}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
