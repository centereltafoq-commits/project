import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { DatePicker, Input, Modal } from '@/design-system';
import { apiClient } from '@/lib/api-client';
import { getTodayIsoDate } from '@/lib/formatters';
import { ClassroomRow } from './classrooms.types';

interface AvailableClassroomsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AvailableClassroomsModal({
  open,
  onOpenChange,
}: AvailableClassroomsModalProps) {
  const [availQuery, setAvailQuery] = React.useState({
    date: getTodayIsoDate(),
    startTime: '16:00',
    endTime: '18:00',
    minCapacity: '10',
  });

  const { data: availableRooms = [], isFetching } = useQuery<ClassroomRow[]>({
    queryKey: ['classrooms-available', availQuery],
    enabled: open && availQuery.startTime < availQuery.endTime,
    queryFn: async () => {
      const res = await apiClient.get('/classrooms/available', {
        params: {
          date: availQuery.date,
          startTime: availQuery.startTime,
          endTime: availQuery.endTime,
          minCapacity: Number(availQuery.minCapacity) || 1,
        },
      });
      return res.data;
    },
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="البحث الفوري عن القاعات المتاحة بدون تعارض"
      description="يتحقق تلقائياً من عدم وجود حصص أو حجوزات مؤكدة أو فترات صيانة"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <DatePicker
            label="التاريخ"
            value={availQuery.date}
            onChange={(d) => setAvailQuery({ ...availQuery, date: d })}
          />
          <Input
            label="من الساعة"
            type="time"
            value={availQuery.startTime}
            onChange={(e) => setAvailQuery({ ...availQuery, startTime: e.target.value })}
          />
          <Input
            label="إلى الساعة"
            type="time"
            value={availQuery.endTime}
            onChange={(e) => setAvailQuery({ ...availQuery, endTime: e.target.value })}
          />
          <Input
            label="الحد الأدنى للسعة"
            type="number"
            min={1}
            value={availQuery.minCapacity}
            onChange={(e) => setAvailQuery({ ...availQuery, minCapacity: e.target.value })}
          />
        </div>
        {isFetching ? (
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
        ) : availableRooms.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            لا توجد قاعات شاغرة تطابق الشروط المحددة في هذا الموعد
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {availableRooms.map((rm) => (
              <div
                key={rm.id}
                className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm"
              >
                <div>
                  <p className="font-bold">{rm.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {rm.roomNumber} • السعة: {rm.maxCapacity} طالب
                  </p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
