import { Check, Eye, Repeat, Settings2 } from 'lucide-react';
import { BookingRequestType, BookingStatus } from '@edu-center/shared';
import { Badge, Button, TableColumn } from '@/design-system';
import { formatDateAr, formatTimeRangeAr } from '@/lib/formatters';
import {
  BOOKING_STATUS_META,
  BOOKING_TYPE_LABELS,
  BookingRow,
} from './bookings.types';

export function buildBookingColumns(params: {
  canApprove?: boolean;
  onReview: (row: BookingRow) => void;
  onComplete: (id: string) => void;
  onQuickView: (row: BookingRow) => void;
}): TableColumn<BookingRow>[] {
  return [
    {
      key: 'type',
      header: 'نوع الطلب',
      className: 'whitespace-nowrap',
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
      header: 'المدرس / الطرف الآخر',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div>
          <div className="font-bold text-foreground hover:text-primary transition-colors cursor-pointer text-xs">
            {row.teacherName}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {row.studentName
              ? `الطالب: ${row.studentName}`
              : `حضور: ${row.expectedAttendees} فرد`}
          </div>
        </div>
      ),
    },
    {
      key: 'schedule',
      header: 'الموعد والوقت',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div>
          <div className="font-semibold text-foreground text-xs">{formatDateAr(row.requestedDate)}</div>
          <div className="text-[11px] text-muted-foreground font-mono">
            {formatTimeRangeAr(row.startTime, row.endTime)}
          </div>
        </div>
      ),
    },
    {
      key: 'purpose',
      header: 'الغرض والقاعة',
      className: 'whitespace-nowrap',
      render: (row) => (
        <div>
          <div className="font-medium text-foreground text-xs">{row.purpose}</div>
          <div className="text-[11px] text-muted-foreground">
            {row.assignedClassroomName ? (
              <span className="text-emerald-600 font-medium">قاعة #{row.assignedRoomNumber}</span>
            ) : row.requestedClassroomName ? (
              <span className="text-amber-600 font-medium">مقترحة: #{row.requestedRoomNumber}</span>
            ) : (
              'بدون قاعة'
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      className: 'whitespace-nowrap',
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
      header: 'إجراءات',
      className: 'whitespace-nowrap text-left pl-4',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2.5 text-xs font-bold"
            onClick={() => params.onQuickView(row)}
          >
            <Eye className="h-3.5 w-3.5 text-primary" />
            تفاصيل
          </Button>

          {params.canApprove && row.status === BookingStatus.PENDING && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => params.onReview(row)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              مراجعة
            </Button>
          )}

          {params.canApprove && row.status === BookingStatus.CONFIRMED && (
            <Button
              size="sm"
              variant="success"
              className="h-8 gap-1 px-2.5 text-xs font-bold"
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
