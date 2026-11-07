import {
  Banknote,
  Building2,
  CalendarClock,
  GraduationCap,
} from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { StatCard } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { formatCurrency } from '@/lib/formatters';
import { DashboardSummaryData } from '../dashboard.types';

interface DashboardHeroKpisProps {
  data: DashboardSummaryData;
}

export function DashboardHeroKpis({ data }: DashboardHeroKpisProps) {
  const { hasPermission } = useAuth();
  const canViewFinance = hasPermission(PERMISSIONS.FINANCE_VIEW);

  // حساب نسبة التحصيل
  const collectionRate =
    data.totalRevenue > 0
      ? Math.round((data.totalCollectedPayments / data.totalRevenue) * 100)
      : 0;

  const totalMarkedToday =
    data.todayAttendance.present +
    data.todayAttendance.absent +
    data.todayAttendance.excused +
    data.todayAttendance.makeup;

  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${canViewFinance ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
      <StatCard
        title="الطلاب والنشاط الأكاديمي"
        value={data.activeStudents}
        subtitle={`${data.totalStudents} طالب مسجل في النظام ككل`}
        icon={GraduationCap}
        tone="primary"
      />

      <StatCard
        title="حصص اليوم المسجلة"
        value={`${data.todaySessionsCount} حصص`}
        subtitle={
          totalMarkedToday > 0
            ? `حضور: ${data.todayAttendance.present} من أصل ${totalMarkedToday} رُصدوا`
            : 'بانتظار بدء وتحضير الحصص'
        }
        icon={CalendarClock}
        tone="warning"
      />

      {canViewFinance && (
        <StatCard
          title="التحصيل المالي الفعلي"
          value={formatCurrency(data.totalCollectedPayments)}
          subtitle={`نسبة التحصيل: ${collectionRate}% من المستهدف (${formatCurrency(data.totalRevenue)})`}
          icon={Banknote}
          tone="success"
        />
      )}

      <StatCard
        title="القاعات الشاغرة الآن"
        value={`${data.classroomsSummary.availableNow} من ${data.classroomsSummary.total}`}
        subtitle={
          data.pendingBookingsCount > 0
            ? `يوجد ${data.pendingBookingsCount} طلب حجز بحاجة للاعتماد`
            : `${data.classroomsSummary.occupiedNow} قاعة مشغولة حالياً`
        }
        icon={Building2}
        tone={data.pendingBookingsCount > 0 ? 'warning' : 'purple'}
      />
    </div>
  );
}

