import {
  AlertCircle,
  Banknote,
  BookOpen,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  Receipt,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import { StatCard } from '@/design-system';
import { formatCurrency, formatYearMonthAr } from '@/lib/formatters';
import { DashboardSummaryData } from '../dashboard.types';

interface DashboardKpiGridsProps {
  data: DashboardSummaryData;
}

export function DashboardKpiGrids({ data }: DashboardKpiGridsProps) {
  const totalTodayMarked =
    data.todayAttendance.present +
    data.todayAttendance.absent +
    data.todayAttendance.excused +
    data.todayAttendance.makeup;

  return (
    <div className="space-y-6">
      {/* 1. الأرقام الأكاديمية */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-muted-foreground">
            المؤشرات الأكاديمية والتشغيلية
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="إجمالي الطلاب"
            value={data.totalStudents}
            subtitle={`${data.activeStudents} طالب نشط حالياً`}
            icon={GraduationCap}
            tone="primary"
          />
          <StatCard
            title="المدرسون النشطون"
            value={data.teachersCount}
            subtitle="هيئة التدريس المتعاقدة"
            icon={UserCheck}
            tone="purple"
          />
          <StatCard
            title="المساعدون النشطون"
            value={data.assistantsCount}
            subtitle="الإشراف والمتابعة"
            icon={Users}
            tone="primary"
          />
          <StatCard
            title="المجموعات النشطة"
            value={data.groupsCount}
            subtitle="مجموعات دراسية مفعّلة"
            icon={BookOpen}
            tone="success"
          />
          <StatCard
            title="حصص اليوم"
            value={data.todaySessionsCount}
            subtitle="مجدولة ومنفذة اليوم"
            icon={CalendarClock}
            tone="warning"
          />
        </div>
      </section>

      {/* 2. المؤشرات المالية للشهر */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-muted-foreground">
          الملخص المالي لشهر {formatYearMonthAr(data.yearMonth)}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="إجمالي إيرادات المجموعات"
            value={formatCurrency(data.totalRevenue)}
            subtitle="إجمالي مستحقات الطلاب للشهر"
            icon={Wallet}
            tone="primary"
          />
          <StatCard
            title="إجمالي التحصيل الفعلي"
            value={formatCurrency(data.totalCollectedPayments)}
            subtitle="المسدد نقداً وإلكترونياً"
            icon={Banknote}
            tone="success"
          />
          <StatCard
            title="مديونيات الطلاب المتبقية"
            value={formatCurrency(data.totalReceivables)}
            subtitle="متأخرات قيد التحصيل"
            icon={AlertCircle}
            tone={data.totalReceivables > 0 ? 'warning' : 'success'}
          />
          <StatCard
            title="صافي نتيجة السنتر"
            value={formatCurrency(data.netCenterResult)}
            subtitle="بعد أنصبة المدرسين والمساعدين والمصروفات"
            icon={TrendingUp}
            tone={data.netCenterResult >= 0 ? 'success' : 'danger'}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title="إجمالي مستحقات المدرسين"
            value={formatCurrency(data.totalTeacherDues)}
            subtitle="أنصبة المدرسين عن الشهر"
            icon={UserCheck}
            tone="purple"
          />
          <StatCard
            title="إجمالي مستحقات المساعدين"
            value={formatCurrency(data.totalAssistantDues)}
            subtitle="شاملة النسب والرواتب الثابتة"
            icon={Users}
            tone="warning"
          />
          <StatCard
            title="إجمالي المصروفات التشغيلية"
            value={formatCurrency(data.totalExpenses)}
            subtitle="إيجار ومرافق ومستلزمات"
            icon={Receipt}
            tone="danger"
          />
        </div>
      </section>

      {/* 3. الحضور والغرف والحجوزات اليوم */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-muted-foreground">
          مؤشرات الحضور والقاعات وحجوزات المواعيد اليوم
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="حضور اليوم المسجّل"
            value={`${data.todayAttendance.present} حاضر`}
            subtitle={`غائب: ${data.todayAttendance.absent} | بعذر: ${data.todayAttendance.excused} | تعويضي: ${data.todayAttendance.makeup} (من ${totalTodayMarked})`}
            icon={ClipboardCheck}
            tone="success"
          />
          <StatCard
            title="القاعات المتاحة الآن"
            value={`${data.classroomsSummary.availableNow} / ${data.classroomsSummary.total}`}
            subtitle={`مشغولة حالياً: ${data.classroomsSummary.occupiedNow}`}
            icon={Building2}
            tone="primary"
          />
          <StatCard
            title="قاعات تحت الصيانة"
            value={data.classroomsSummary.maintenance}
            subtitle="خارج نطاق التخصيص مؤقتاً"
            icon={Wrench}
            tone={data.classroomsSummary.maintenance > 0 ? 'warning' : 'success'}
          />
          <StatCard
            title="طلبات حجز معلقة"
            value={data.pendingBookingsCount}
            subtitle="بانتظار مراجعة واعتماد الإدارة/المدرس"
            icon={CheckCircle2}
            tone={data.pendingBookingsCount > 0 ? 'warning' : 'success'}
          />
        </div>
      </section>
    </div>
  );
}
