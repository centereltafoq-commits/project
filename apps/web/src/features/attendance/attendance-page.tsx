import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck } from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { PageHeader } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { apiClient } from '@/lib/api-client';
import { AttendanceLookups } from './attendance.types';
import { SessionsTab } from './sessions-tab';

export function AttendancePage() {
  const { hasPermission } = useAuth();
  const canViewSessions =
    hasPermission(PERMISSIONS.ATTENDANCE_VIEW) || hasPermission(PERMISSIONS.SESSIONS_VIEW);

  const { data: lookups } = useQuery<AttendanceLookups>({
    queryKey: ['attendance-lookups'],
    enabled: canViewSessions,
    queryFn: async () => (await apiClient.get('/attendance/lookups')).data,
  });

  return (
    <div>
      <PageHeader
        title="إدارة الحصص ورصد الحضور"
        description="توليد جدول الحصص الشهري وفتح كشوف الحضور الفعلية للطلاب بدقة"
      />

      {canViewSessions && (
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            <span>حصص اليوم وسجل الحضور</span>
          </div>
          <SessionsTab lookups={lookups} />
        </div>
      )}
    </div>
  );
}
