import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Building2 } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/design-system';
import { DashboardClassroomLive, DashboardSummaryData } from '../dashboard.types';

interface DashboardLiveRoomsBentoProps {
  data: DashboardSummaryData;
}

type RoomFilterState = 'ALL' | 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE';

const LIVE_ROOM_BADGE: Record<
  DashboardClassroomLive['liveState'],
  { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral'; dotColor: string }
> = {
  AVAILABLE: { label: 'متاحة', variant: 'success', dotColor: 'bg-emerald-500' },
  OCCUPIED: { label: 'مشغولة', variant: 'danger', dotColor: 'bg-rose-500 animate-pulse' },
  MAINTENANCE: { label: 'صيانة', variant: 'warning', dotColor: 'bg-amber-500' },
  INACTIVE: { label: 'متوقفة', variant: 'neutral', dotColor: 'bg-slate-400' },
};

export function DashboardLiveRoomsBento({ data }: DashboardLiveRoomsBentoProps) {
  const [stateFilter, setStateFilter] = React.useState<RoomFilterState>('ALL');

  const filteredRooms = React.useMemo(() => {
    if (stateFilter === 'ALL') return data.classroomsLive;
    return data.classroomsLive.filter((room) => room.liveState === stateFilter);
  }, [data.classroomsLive, stateFilter]);

  const filterTabs: Array<{ key: RoomFilterState; label: string; count: number }> = [
    { key: 'ALL', label: 'الكل', count: data.classroomsLive.length },
    { key: 'AVAILABLE', label: 'متاحة', count: data.classroomsSummary.availableNow },
    { key: 'OCCUPIED', label: 'مشغولة', count: data.classroomsSummary.occupiedNow },
    { key: 'MAINTENANCE', label: 'صيانة', count: data.classroomsSummary.maintenance },
  ];

  return (
    <Card>
      <CardHeader className="space-y-3 border-b border-border pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <Building2 className="h-4.5 w-4.5" />
            </div>
            <div>
              <CardTitle className="text-base">القاعات اللحظية</CardTitle>
              <p className="text-xs text-muted-foreground">
                {data.classroomsSummary.availableNow} متاحة • {data.classroomsSummary.occupiedNow} مشغولة
              </p>
            </div>
          </div>
          <Link to="/classrooms">
            <Button variant="outline" size="sm">
              القاعات
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {data.classroomsLive.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {filterTabs
              .filter((t) => t.key === 'ALL' || t.count > 0)
              .map((tab) => {
                const active = stateFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStateFilter(tab.key)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="font-mono text-[10px]">({tab.count})</span>
                  </button>
                );
              })}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-3.5">
        {filteredRooms.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            لا توجد قاعات في هذه الحالة حالياً.
          </div>
        ) : (
          <div className="grid max-h-[230px] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
            {filteredRooms.map((room) => {
              const meta = LIVE_ROOM_BADGE[room.liveState] || LIVE_ROOM_BADGE.AVAILABLE;
              return (
                <div
                  key={room.id}
                  className="flex flex-col justify-between rounded-lg border border-border bg-background/70 p-2.5 transition-colors hover:border-primary/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-[11px] font-bold text-primary">
                        {room.roomNumber}
                      </span>
                      <h4 className="truncate text-xs font-bold text-foreground" title={room.name}>
                        {room.name}
                      </h4>
                    </div>
                    <Badge variant={meta.variant} className="shrink-0 gap-1 px-1.5 py-0 text-[10px]">
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dotColor}`} />
                      {meta.label}
                    </Badge>
                  </div>
                  <div className="mt-1.5 truncate text-[11px]">
                    {room.occupantTitle ? (
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        {room.occupantTitle}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">السعة: {room.maxCapacity} طالب</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

