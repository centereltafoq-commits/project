import { Check, Repeat, Settings2 } from 'lucide-react';
import { BookingRequestType, BookingStatus } from '@edu-center/shared';
import { Badge, Button, TableColumn } from '@/design-system';
import { formatDateAr } from '@/lib/formatters';
import {
  BOOKING_STATUS_META,
  BOOKING_TYPE_LABELS,
  BookingRow,
} from './bookings.types';

export function buildBookingColumns(params: {
  onReview: (row: BookingRow) => void;
  onComplete: (id: string) => void;
}): TableColumn<BookingRow>[] {
  return [
    {
      key: 'type',
      header: 'نوع الطلب',
      render: (row) => (
        <div className="space-y-1">
          <Badge
            variant={
              row.requestType === BookingRequestType.STUDENT_WITH_TEACHER ? 'info' : 'purple'
            }
          >
            {BOOKING_TYPE_LABELS[row.requestType] ?? row.requestType}
          </Badge>
          {row.seriesId && (
            <div className="flex items-center gap-1 text-[11px] font-semibold text-violet-600">
              <Repeat className="h-3 w-3" />
              سلسلة أسبوعية
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'participants',
      header: 'المدرس / الطالب',
      render: (row) => (
        <div>
          <div className="font-bold text-foreground">{row.teacherName}</div>
          <div className="text-xs text-muted-foreground">
            {row.studentName
              ? `الطالب: ${row.studentName} (${row.studentCode})`
              : `حضور متوقع: ${row.expectedAttendees} فرد`}
          </div>
        </div>
      ),
    },
    {
      key: 'schedule',
      header: 'الموعد والمدة',
      render: (row) => (
        <div>
          <div className="font-semibold text-foreground">{formatDateAr(row.requestedDate)}</div>
          <div className="text-xs text-muted-foreground">
            {row.startTime} - {row.endTime} ({row.durationMinutes} دقيقة)
          </div>
        </div>
      ),
    },
    {
      key: 'purpose',
      header: 'الغرض والقاعة',
      render: (row) => (
        <div>
          <div className="font-medium text-foreground">{row.purpose}</div>
          <div className="text-xs text-muted-foreground">
            {row.assignedClassroomName
              ? `قاعة مخصصة: ${row.assignedClassroomName} (${row.assignedRoomNumber})`
              : row.requestedClassroomName
                ? `قاعة مقترحة: ${row.requestedClassroomName}`
                : 'لم تُخصص قاعة بعد'}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => {
        const meta = BOOKING_STATUS_META[row.status] ?? {
          label: row.status,
          variant: 'neutral' as const,
        };
        return <Badge variant={meta.variant}>{meta.label}</Badge>;
      },
    },
    {
      key: 'actions',
      header: 'إجراءات المراجعة',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={() => params.onReview(row)}>
            <Settings2 className="h-3.5 w-3.5" />
            مراجعة / قاعة
          </Button>
          {row.status === BookingStatus.CONFIRMED && (
            <Button
              size="sm"
              variant="success"
              onClick={() => params.onComplete(row.id)}
            >
              <Check className="h-3.5 w-3.5" />
              إكمال
            </Button>
          )}
        </div>
      ),
    },
  ];
}
