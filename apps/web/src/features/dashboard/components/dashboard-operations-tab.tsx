import { PERMISSIONS } from '@edu-center/shared';
import { useAuth } from '@/features/auth/auth-context';
import { DashboardSummaryData } from '../dashboard.types';
import { DashboardLiveRoomsBento } from './dashboard-live-rooms-bento';
import { DashboardMonthlyPulseBento } from './dashboard-monthly-pulse-bento';
import { DashboardSessionProgressCard } from './dashboard-session-progress-card';
import { DashboardTodaySessionsBento } from './dashboard-today-sessions-bento';

interface DashboardOperationsTabProps {
  data: DashboardSummaryData;
}

export function DashboardOperationsTab({ data }: DashboardOperationsTabProps) {
  const { hasPermission } = useAuth();
  const canAccessAttendance =
    hasPermission(PERMISSIONS.ATTENDANCE_VIEW) ||
    hasPermission(PERMISSIONS.SESSIONS_VIEW);
  const canViewClassrooms = hasPermission(PERMISSIONS.CLASSROOMS_VIEW);

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
      <DashboardSessionProgressCard data={data} />

      {canAccessAttendance && <DashboardTodaySessionsBento data={data} />}

      <div
        className={`${
          canAccessAttendance ? 'xl:col-span-5' : 'xl:col-span-12'
        } space-y-5`}
      >
        {canViewClassrooms && <DashboardLiveRoomsBento data={data} />}
        <DashboardMonthlyPulseBento data={data} />
      </div>
    </div>
  );
}
