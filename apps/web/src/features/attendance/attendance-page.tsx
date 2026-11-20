import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, QrCode } from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import {
  Button,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { apiClient } from '@/lib/api-client';
import { AttendanceLookups } from './attendance.types';
import { QrScannerWorkspace } from './qr-scanner-workspace';
import { SessionsTab } from './sessions-tab';

export function AttendancePage() {
  const { hasPermission } = useAuth();
  const canViewSessions =
    hasPermission(PERMISSIONS.ATTENDANCE_VIEW) || hasPermission(PERMISSIONS.SESSIONS_VIEW);
  const canUseQrGate =
    canViewSessions || hasPermission(PERMISSIONS.ATTENDANCE_RECORD);

  const [activeTab, setActiveTab] = React.useState<'sessions' | 'qr-gate'>(
    canViewSessions ? 'sessions' : 'qr-gate',
  );

  const { data: lookups } = useQuery<AttendanceLookups>({
    queryKey: ['attendance-lookups'],
    enabled: canViewSessions,
    queryFn: async () => (await apiClient.get('/attendance/lookups')).data,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="إدارة الحصص ورصد الحضور"
        description="متابعة سجل الحصص وكشوف الحضور، وبوابة مسح الـ QR Code الفورية بالريسبشن"
        actions={
          canUseQrGate && activeTab !== 'qr-gate' ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="success"
                onClick={() => setActiveTab('qr-gate')}
                className="h-9 gap-1.5 px-3.5"
              >
                <QrCode className="h-4 w-4" />
                بوابة مسح QR الحضور
              </Button>
            </div>
          ) : undefined
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'sessions' | 'qr-gate')}
        className="space-y-4"
      >
        <TabsList>
          {canViewSessions && (
            <TabsTrigger value="sessions" className="gap-2 font-bold">
              <ClipboardList className="h-4 w-4" />
              سجل الحصص والكشوف
            </TabsTrigger>
          )}
          {canUseQrGate && (
            <TabsTrigger value="qr-gate" className="gap-2 font-bold">
              <QrCode className="h-4 w-4 text-emerald-600" />
              بوابة مسح QR الحضور (الريسبشن)
            </TabsTrigger>
          )}
        </TabsList>

        {canViewSessions && (
          <TabsContent value="sessions">
            <SessionsTab lookups={lookups} />
          </TabsContent>
        )}

        {canUseQrGate && (
          <TabsContent value="qr-gate">
            <QrScannerWorkspace />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
