import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, Sparkles } from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { Button, PageHeader } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { apiClient } from '@/lib/api-client';
import { AttendanceLookups } from './attendance.types';
import { CreateSessionModal, GenerateMonthModal } from './session-modals';
import { SessionsTab } from './sessions-tab';

export function AttendancePage() {
  const { hasPermission } = useAuth();
  const canViewSessions =
    hasPermission(PERMISSIONS.ATTENDANCE_VIEW) || hasPermission(PERMISSIONS.SESSIONS_VIEW);
  const canManageSessions = hasPermission(PERMISSIONS.SESSIONS_MANAGE);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [generateOpen, setGenerateOpen] = React.useState(false);

  const { data: lookups } = useQuery<AttendanceLookups>({
    queryKey: ['attendance-lookups'],
    enabled: canViewSessions || canManageSessions,
    queryFn: async () => (await apiClient.get('/attendance/lookups')).data,
  });

  return (
    <div>
      <PageHeader
        title="إدارة الحصص ورصد الحضور"
        description="توليد جدول الحصص الشهري وفتح كشوف الحضور الفعلية للطلاب بدقة"
        actions={
          canManageSessions ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setGenerateOpen(true)}
                className="h-9 gap-1.5 px-3"
              >
                <Sparkles className="h-3.5 w-3.5" />
                توليد حصص الشهر تلقائياً
              </Button>
              <Button
                size="sm"
                onClick={() => setCreateOpen(true)}
                className="h-9 gap-1.5 px-3.5"
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                إنشاء حصة مفردة
              </Button>
            </div>
          ) : undefined
        }
      />

      {canViewSessions && <SessionsTab lookups={lookups} />}

      {canManageSessions && (
        <>
          <CreateSessionModal open={createOpen} onOpenChange={setCreateOpen} lookups={lookups} />
          <GenerateMonthModal open={generateOpen} onOpenChange={setGenerateOpen} lookups={lookups} />
        </>
      )}
    </div>
  );
}
