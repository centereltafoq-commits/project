import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  ClipboardCheck,
  GraduationCap,
  Sparkles,
  Wallet,
  Wrench,
} from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { formatDateAr, formatTimeRangeAr } from '@/lib/formatters';
import { DashboardSummaryData } from '../dashboard.types';

interface DashboardOperationsTabProps {
  data: DashboardSummaryData;
}

const SESSION_STATUS_BADGE: Record<
  string,
  { label: string; variant: 'success' | 'info' | 'danger' | 'neutral' }
> = {
  COMPLETED: { label: 'منفذة', variant: 'success' },
  SCHEDULED: { label: 'مجدولة', variant: 'info' },
  CANCELLED: { label: 'ملغاة', variant: 'danger' },
};

const LIVE_ROOM_BADGE: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral'; dotColor: string }
> = {
  AVAILABLE: { label: 'متاحة الآن', variant: 'success', dotColor: 'bg-emerald-500' },
  OCCUPIED: { label: 'مشغولة حالياً', variant: 'danger', dotColor: 'bg-rose-500 animate-pulse' },
  MAINTENANCE: { label: 'تحت الصيانة', variant: 'warning', dotColor: 'bg-amber-500' },
  INACTIVE: { label: 'غير نشطة', variant: 'neutral', dotColor: 'bg-slate-400' },
};

const QUICK_ACTIONS = [
  {
    label: 'رصد الحضور والغياب',
    to: '/attendance',
    icon: ClipboardCheck,
    desc: 'تسجيل الحصص والحضور',
    anyPermissions: [
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.SESSIONS_VIEW,
    ],
  },
  {
    label: 'تحصيل الرسوم وإصدار إيصال',
    to: '/finance',
    icon: Wallet,
    desc: 'قبول دفعات الطلاب المالية',
    anyPermissions: [PERMISSIONS.FINANCE_VIEW],
  },
  {
    label: 'تسجيل وإدارة الطلاب',
    to: '/students',
    icon: GraduationCap,
    desc: 'إضافة ومتابعة الطلاب',
    anyPermissions: [PERMISSIONS.STUDENTS_VIEW],
  },
  {
    label: 'إشغال وجداول القاعات',
    to: '/classrooms',
    icon: Building2,
    desc: 'متابعة الصيانة والسعات',
    anyPermissions: [PERMISSIONS.CLASSROOMS_VIEW],
  },
];

export function DashboardOperationsTab({ data }: DashboardOperationsTabProps) {
  const { hasPermission } = useAuth();
  const canAccessAttendance =
    hasPermission(PERMISSIONS.ATTENDANCE_VIEW) ||
    hasPermission(PERMISSIONS.SESSIONS_VIEW);
  const canViewClassrooms = hasPermission(PERMISSIONS.CLASSROOMS_VIEW);
  const permittedQuickActions = QUICK_ACTIONS.filter((a) =>
    a.anyPermissions.some((p) => hasPermission(p)),
  );

  return (
    <div className="space-y-6">
      {/* 1. شريط الوصول السريع لأهم الإجراءات التشغيلية */}
      {permittedQuickActions.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            إجراءات سريعة لغرفة العمليات
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {permittedQuickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.to}
                  to={action.to}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-3.5 transition-all hover:border-primary/50 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="rounded-lg bg-primary/10 p-2 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <ArrowLeft className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <div className="mt-3">
                    <p className="text-sm font-bold text-foreground">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* 2. جدول حصص اليوم */}
      {canAccessAttendance && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          {/* جدول حصص اليوم */}
          <Card className="xl:col-span-12">
              <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
                <div>
                  <CardTitle className="text-base">جدول حصص اليوم ({formatDateAr(data.todayDate)})</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    إجمالي {data.todaySessions.length} حصة مجدولة لمجموعات السنتر
                  </p>
                </div>
                <Link to="/attendance">
                  <Button variant="outline" size="sm">
                    دفتر التحضير
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                {data.todaySessions.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    <Sparkles className="mx-auto mb-2 h-7 w-7 text-muted-foreground/50" />
                    لا توجد حصص دراسية مجدولة لهذا اليوم.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-right text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground">
                          <th className="px-4 py-3">المجموعة</th>
                          <th className="px-4 py-3">المدرس</th>
                          <th className="px-4 py-3">التوقيت</th>
                          <th className="px-4 py-3">القاعة</th>
                          <th className="px-4 py-3">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.todaySessions.map((s) => {
                          const badge = SESSION_STATUS_BADGE[s.status] || {
                            label: s.status,
                            variant: 'neutral' as const,
                          };
                          return (
                            <tr key={s.id} className="hover:bg-accent/30 transition-colors">
                              <td className="px-4 py-3">
                                <p className="font-bold text-foreground">{s.groupName}</p>
                                <p className="text-xs text-muted-foreground">{s.gradeLevel}</p>
                              </td>
                              <td className="px-4 py-3 font-medium">{s.teacherName}</td>
                              <td className="px-4 py-3 font-mono text-xs font-semibold text-primary">
                                {formatTimeRangeAr(s.startTime, s.endTime)}
                              </td>
                              <td className="px-4 py-3 text-xs">
                                {s.classroomName ? (
                                  <span className="font-medium">
                                    قاعة {s.roomNumber} ({s.classroomName})
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
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
        </div>
      )}

      {/* 4. لوحة مراقبة القاعات الدراسية اللحظية (Classrooms Live Cockpit) */}
      {canViewClassrooms && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">لوحة متابعة إشغال القاعات اللحظية</CardTitle>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  مؤشر مباشر: {data.classroomsSummary.availableNow} متاحة • {data.classroomsSummary.occupiedNow} مشغولة • {data.classroomsSummary.maintenance} صيانة
                </p>
              </div>
            </div>
            <Link to="/classrooms">
              <Button variant="outline" size="sm">
                إدارة القاعات
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {data.classroomsLive.map((room) => {
                const meta = LIVE_ROOM_BADGE[room.liveState] || LIVE_ROOM_BADGE.AVAILABLE;
                return (
                  <div
                    key={room.id}
                    className="flex flex-col justify-between rounded-xl border border-border bg-card p-3.5 transition-all hover:border-primary/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-primary">
                          قاعة {room.roomNumber}
                        </span>
                        <h4 className="text-sm font-bold text-foreground">{room.name}</h4>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${meta.dotColor}`} />
                        <Badge variant={meta.variant} className="text-[10px] px-1.5 py-0.5">
                          {meta.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 border-t border-border/60 pt-2 text-xs">
                      {room.occupantTitle ? (
                        <span className="font-bold text-rose-600 dark:text-rose-400 line-clamp-1">
                          {room.occupantTitle}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          السعة القصوى: {room.maxCapacity} طالب
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

