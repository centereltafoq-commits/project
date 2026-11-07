import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarCheck2,
  ClipboardCheck,
  Clock,
  GraduationCap,
  Wallet,
} from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@/design-system';
import { formatDateAr, formatTimeRangeAr } from '@/lib/formatters';
import { DashboardSummaryData } from '../dashboard.types';

interface DashboardLivePanelsProps {
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
  { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  AVAILABLE: { label: 'متاحة الآن', variant: 'success' },
  OCCUPIED: { label: 'مشغولة حالياً', variant: 'danger' },
  MAINTENANCE: { label: 'تحت الصيانة', variant: 'warning' },
  INACTIVE: { label: 'غير نشطة', variant: 'neutral' },
};

const QUICK_LINKS = [
  { label: 'إدارة الطلاب والاشتراكات', to: '/students', icon: GraduationCap },
  { label: 'تسجيل الحضور والتعويضات', to: '/attendance', icon: ClipboardCheck },
  { label: 'التحصيل والحسابات المالية', to: '/finance', icon: Wallet },
  { label: 'اعتماد طلبات الحجز', to: '/bookings', icon: CalendarCheck2 },
  { label: 'إدارة وإشغال القاعات', to: '/classrooms', icon: Building2 },
  { label: 'التقارير الـ 11 والتصدير', to: '/reports', icon: BarChart3 },
];

export function DashboardLivePanels({ data }: DashboardLivePanelsProps) {
  return (
    <div className="space-y-6">
      {/* روابط سريعة للأقسام */}
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">وصول سريع للأقسام التشغيلية</h3>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {QUICK_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/30 p-3 text-xs font-bold text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="line-clamp-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* جدول حصص اليوم */}
        <Card className="xl:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
            <div>
              <CardTitle>جدول حصص اليوم ({formatDateAr(data.todayDate)})</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                جميع المجموعات المجدولة والمنفذة خلال اليوم
              </p>
            </div>
            <Link to="/attendance">
              <Button variant="outline" size="sm">
                سجل الحضور
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {data.todaySessions.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                لا توجد حصص مجدولة لهذا اليوم.
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
                        <tr key={s.id} className="hover:bg-accent/30">
                          <td className="px-4 py-3">
                            <p className="font-bold text-foreground">{s.groupName}</p>
                            <p className="text-xs text-muted-foreground">{s.gradeLevel}</p>
                          </td>
                          <td className="px-4 py-3 font-medium">{s.teacherName}</td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold">
                            {formatTimeRangeAr(s.startTime, s.endTime)}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {s.classroomName ? `${s.roomNumber} - ${s.classroomName}` : '—'}
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

        {/* المواعيد القادمة وطلبات الحجز */}
        <Card className="xl:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
            <div>
              <CardTitle>المواعيد القادمة المعتمدة</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                أقرب 5 مواعيد مؤكدة • معلق حالياً:{' '}
                <strong className="text-amber-600 dark:text-amber-400">
                  {data.pendingBookingsCount} طلب
                </strong>
              </p>
            </div>
            <Link to="/bookings">
              <Button variant="outline" size="sm">
                الحجوزات
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {data.upcomingAppointments.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                لا توجد مواعيد مؤكدة قادمة حالياً.
              </div>
            ) : (
              data.upcomingAppointments.map((appt) => (
                <div key={appt.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-foreground">{appt.purpose}</p>
                    <p className="text-xs text-muted-foreground">
                      المدرس: <strong className="text-foreground">{appt.teacherName}</strong>
                      {appt.studentName && ` • الطالب: ${appt.studentName}`}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {formatDateAr(appt.requestedDate)} ({formatTimeRangeAr(appt.startTime, appt.endTime)})
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

      {/* حالة القاعات لحظياً */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
          <div>
            <CardTitle>حالة القاعات الدراسية لحظياً</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              متابعة مباشرة لإشغال القاعات والصيانة في الوقت الفعلي
            </p>
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
              const st = LIVE_ROOM_BADGE[room.liveState] || LIVE_ROOM_BADGE.AVAILABLE;
              return (
                <div
                  key={room.id}
                  className="flex flex-col justify-between rounded-xl border border-border bg-muted/20 p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-primary">
                        {room.roomNumber}
                      </span>
                      <h4 className="text-sm font-bold text-foreground">{room.name}</h4>
                    </div>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                  <div className="mt-3 border-t border-border/60 pt-2 text-xs text-muted-foreground">
                    {room.occupantTitle ? (
                      <span className="font-semibold text-foreground">{room.occupantTitle}</span>
                    ) : (
                      <span>السعة القصوى: {room.maxCapacity} طالب</span>
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
