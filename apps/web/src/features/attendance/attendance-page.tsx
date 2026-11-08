import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { apiClient } from '@/lib/api-client';
import { AttendanceLookups } from './attendance.types';
import { MakeupsTab } from './makeups-tab';
import { SessionsTab } from './sessions-tab';

export function AttendancePage() {
  const { hasPermission } = useAuth();
  const canViewSessions =
    hasPermission(PERMISSIONS.ATTENDANCE_VIEW) || hasPermission(PERMISSIONS.SESSIONS_VIEW);
  const canViewMakeups =
    hasPermission(PERMISSIONS.ATTENDANCE_VIEW) || hasPermission(PERMISSIONS.MAKEUP_MANAGE);

  const { data: lookups } = useQuery<AttendanceLookups>({
    queryKey: ['attendance-lookups'],
    enabled: canViewSessions || canViewMakeups,
    queryFn: async () => (await apiClient.get('/attendance/lookups')).data,
  });

  return (
    <div>
      <PageHeader
        title="إدارة الحصص ورصد الحضور والتعويضات"
        description="توليد جدول الحصص الشهري، فتح كشوف الحضور الفعلية للطلاب، واعتماد الحصص التعويضية بدقة"
      />

      <Tabs defaultValue={canViewSessions ? 'sessions' : 'makeups'}>
        <TabsList>
          {canViewSessions && (
            <TabsTrigger value="sessions">
              <ClipboardCheck className="h-4 w-4" />
              حصص اليوم وسجل الحضور
            </TabsTrigger>
          )}
          {canViewMakeups && (
            <TabsTrigger value="makeups">
              <RefreshCw className="h-4 w-4" />
              الحصص التعويضية
            </TabsTrigger>
          )}
        </TabsList>

        {canViewSessions && (
          <TabsContent value="sessions">
            <SessionsTab lookups={lookups} />
          </TabsContent>
        )}

        {canViewMakeups && (
          <TabsContent value="makeups">
            <MakeupsTab lookups={lookups} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
