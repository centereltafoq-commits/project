import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CalendarCheck2,
  ClipboardCheck,
  Clock,
  GraduationCap,
  Sparkles,
  Wallet,
  Wrench,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/design-system';
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
  { label: 'رصد الحضور والغياب', to: '/attendance', icon: ClipboardCheck, desc: 'تسجيل الحصص والتعويضات' },
  { label: 'تحصيل الرسوم وإصدار إيصال', to: '/finance', icon: Wallet, desc: 'قبول دفعات الطلاب المالية' },
  { label: 'اعتماد طلبات الحجز', to: '/bookings', icon: CalendarCheck2, desc: 'حجز المواعيد بدون تعارض' },
  { label: 'تسجيل وإدارة الطلاب', to: '/students', icon: GraduationCap, desc: 'إضافة ومتابعة الطلاب' },
  { label: 'إشغال وجداول القاعات', to: '/classrooms', icon: Building2, desc: 'متابعة الصيانة والسعات' },
];

export function DashboardOperationsTab({ data }: DashboardOperationsTabProps) {
  return (
    <div className="space-y-6">
      {/* 1. تنبيه الحجوزات المعلقة إن وجدت */}
      {data.pendingBookingsCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-bold">
                تنبيه تشغيلي: يوجد {data.pendingBookingsCount} طلب حجز مواعيد جديد بحاجة إلى مراجعة واعتماد
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                يرجى مراجعة الحجوزات لتأكيد المواعيد وتسكين القاعات الدراسية المناسبة قبل موعد الحصة.
              </p>
            </div>
          </div>
          <Link to="/bookings">
            <Button size="sm" variant="primary">
              مراجعة الحجوزات الآن
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* 2. شريط الوصول السريع لأهم الإجراءات التشغيلية */}
      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          إجراءات سريعة لغرفة العمليات
        </h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {QUICK_ACTIONS.map((action) => {
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

      {/* 3. شبكة متكاملة: حصص اليوم والمواعيد القادمة */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* جدول حصص اليوم */}
        <Card className="xl:col-span-7">
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

        {/* المواعيد القادمة المؤكدة */}
        <Card className="xl:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
            <div>
              <CardTitle className="text-base">المواعيد القادمة المعتمدة</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                أحدث 5 مواعيد فردية وحصص خاصة مؤكدة
              </p>
            </div>
            <Link to="/bookings">
              <Button variant="outline" size="sm">
                كل الحجوزات
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {data.upcomingAppointments.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                لا توجد مواعيد خاصة قادمة مؤكدة حالياً.
              </div>
            ) : (
              data.upcomingAppointments.map((appt) => (
                <div key={appt.id} className="flex items-start justify-between gap-3 p-3.5">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground">{appt.purpose}</p>
                    <p className="text-xs text-muted-foreground">
                      المدرس: <strong className="text-foreground">{appt.teacherName}</strong>
                      {appt.studentName && ` • الطالب: ${appt.studentName}`}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 font-mono font-medium text-primary">
                        <Clock className="h-3 w-3" />
                        {formatDateAr(appt.requestedDate)} • {formatTimeRangeAr(appt.startTime, appt.endTime)}
                      </span>
                    </div>
                  </div>
                  <Badge variant="info">
                    {appt.roomNumber ? `قاعة ${appt.roomNumber}` : 'مؤكد'}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. لوحة مراقبة القاعات الدراسية اللحظية (Classrooms Live Cockpit) */}
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
    </div>
  );
}

