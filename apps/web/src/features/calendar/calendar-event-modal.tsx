import { Badge, Button, Modal } from '@/design-system';
import { formatDateAr, formatTimeRangeAr } from '@/lib/formatters';
import { EVENT_CATEGORY_STYLES, UnifiedCalendarEvent } from './calendar.types';

interface CalendarEventModalProps {
  event: UnifiedCalendarEvent | null;
  onClose: () => void;
}

export function CalendarEventModal({ event, onClose }: CalendarEventModalProps) {
  return (
    <Modal
      open={Boolean(event)}
      onOpenChange={(open) => !open && onClose()}
      title={event?.title ?? 'تفاصيل الحدث'}
      description={event ? formatDateAr(event.date) : undefined}
    >
      {event && (
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">التصنيف:</span>
            <Badge variant={EVENT_CATEGORY_STYLES[event.category].badgeVariant}>
              {EVENT_CATEGORY_STYLES[event.category].label}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">التوقيت:</span>
            <span className="font-bold text-foreground">
              {formatTimeRangeAr(event.startTime, event.endTime)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">التفاصيل:</span>
            <span className="font-semibold text-foreground">{event.subtitle}</span>
          </div>
          {event.classroomName && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">القاعة:</span>
              <span className="font-semibold text-foreground">
                {event.classroomName} ({event.roomNumber})
              </span>
            </div>
          )}
          <div className="flex justify-end pt-3">
            <Button variant="outline" onClick={onClose}>
              إغلاق
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
