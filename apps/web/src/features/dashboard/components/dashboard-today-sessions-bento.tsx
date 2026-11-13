import * as React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Search, Sparkles } from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { formatDateAr, formatTimeRangeAr } from '@/lib/formatters';
import { DashboardSummaryData } from '../dashboard.types';

interface DashboardTodaySessionsBentoProps {
  data: DashboardSummaryData;
  fullWidth?: boolean;
}

type SessionFilterStatus = 'ALL' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';

const SESSION_STATUS_BADGE: Record<
  string,
  { label: string; variant: 'success' | 'info' | 'danger' | 'neutral' }
> = {
  COMPLETED: { label: 'منفذة', variant: 'success' },
  SCHEDULED: { label: 'مجدولة', variant: 'info' },
  CANCELLED: { label: 'ملغاة', variant: 'danger' },
};

export function DashboardTodaySessionsBento({
  data,
  fullWidth = false,
}: DashboardTodaySessionsBentoProps) {
  const { hasPermission } = useAuth();
  const canViewGroups = hasPermission(PERMISSIONS.GROUPS_VIEW);
  const [statusFilter, setStatusFilter] = React.useState<SessionFilterStatus>('ALL');
  const [searchTerm, setSearchTerm] = React.useState('');

  const counts = React.useMemo(() => {
    const res = { ALL: data.todaySessions.length, SCHEDULED: 0, COMPLETED: 0, CANCELLED: 0 };
    for (const session of data.todaySessions) {
      if (session.status === 'SCHEDULED') res.SCHEDULED += 1;
      else if (session.status === 'COMPLETED') res.COMPLETED += 1;
      else if (session.status === 'CANCELLED') res.CANCELLED += 1;
    }
    return res;
  }, [data.todaySessions]);

  const filteredSessions = React.useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return data.todaySessions.filter((s) => {
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (!query) return true;
      return (
        s.groupName.toLowerCase().includes(query) ||
        s.teacherName.toLowerCase().includes(query) ||
        s.subject.toLowerCase().includes(query) ||
        (s.classroomName ?? '').toLowerCase().includes(query) ||
        (s.roomNumber ?? '').toLowerCase().includes(query)
      );
    });
  }, [data.todaySessions, statusFilter, searchTerm]);

  const filterOptions: Array<{ key: SessionFilterStatus; label: string; count: number }> = [
    { key: 'ALL', label: 'الكل', count: counts.ALL },
    { key: 'SCHEDULED', label: 'مجدولة', count: counts.SCHEDULED },
    { key: 'COMPLETED', label: 'منفذة', count: counts.COMPLETED },
    { key: 'CANCELLED', label: 'ملغاة', count: counts.CANCELLED },
  ];

  return (
    <Card className={`${fullWidth ? 'xl:col-span-12' : 'xl:col-span-7'} flex flex-col`}>
      <CardHeader className="space-y-3 border-b border-border pb-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <CalendarClock className="h-4.5 w-4.5" />
            </div>
            <div>
              <CardTitle className="text-base">
                جدول حصص اليوم ({formatDateAr(data.todayDate)})
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {data.todaySessions.length} حصة مجدولة — تتحدث تلقائياً عند رصد الحضور
              </p>
            </div>
          </div>

          <Link to="/attendance">
            <Button variant="outline" size="sm">
              دفتر التحضير
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {data.todaySessions.length > 0 && (
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              {filterOptions
                .filter((opt) => opt.key === 'ALL' || opt.count > 0)
                .map((opt) => {
                  const active = statusFilter === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setStatusFilter(opt.key)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <span>{opt.label}</span>
                      <span
                        className={`rounded-full px-1.5 text-[10px] font-mono ${
                          active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background'
                        }`}
                      >
                        {opt.count}
                      </span>
                    </button>
                  );
                })}
            </div>

            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="بحث بالمجموعة أو المدرس..."
                className="h-8 w-full rounded-lg border border-input bg-background pr-8 pl-2.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 p-0">
        {data.todaySessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center text-sm text-muted-foreground">
            <Sparkles className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="font-semibold text-foreground">لا توجد حصص مجدولة لهذا اليوم</p>
            <p className="mt-1 text-xs">يمكنك توليد جدول الشهر أو إضافة حصة مفردة من شاشة الحضور.</p>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="px-6 py-10 text-center text-xs text-muted-foreground">
            لا توجد حصص مطابقة للفلتر الحالي.
          </div>
        ) : (
          <div className="max-h-[430px] overflow-auto">
            <table className="w-full border-collapse text-right text-xs sm:text-sm">
              <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
                <tr className="border-b border-border text-[11px] font-bold text-muted-foreground">
                  <th className="px-4 py-2.5">المجموعة</th>
                  <th className="px-3 py-2.5">المدرس</th>
                  <th className="px-3 py-2.5">التوقيت</th>
                  <th className="px-3 py-2.5">القاعة</th>
                  <th className="px-4 py-2.5 text-left">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSessions.map((s) => {
                  const badge = SESSION_STATUS_BADGE[s.status] || {
                    label: s.status,
                    variant: 'neutral' as const,
                  };
                  return (
                    <tr key={s.id} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-2.5">
                        {canViewGroups ? (
                          <Link
                            to={`/groups/${s.groupId}`}
                            className="font-bold text-foreground hover:text-primary transition-colors block truncate max-w-[180px]"
                          >
                            {s.groupName}
                          </Link>
                        ) : (
                          <p className="font-bold text-foreground truncate max-w-[180px]">{s.groupName}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground truncate">
                          {s.subject} • {s.gradeLevel}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-xs font-medium text-foreground">
                        {s.teacherName}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-xs font-semibold text-primary whitespace-nowrap tabular-nums">
                        {formatTimeRangeAr(s.startTime, s.endTime)}
                      </td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                        {s.classroomName ? (
                          <span className="font-medium text-foreground">
                            قاعة {s.roomNumber}
                            <span className="hidden md:inline text-muted-foreground"> ({s.classroomName})</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">غير محددة</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-left whitespace-nowrap">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

