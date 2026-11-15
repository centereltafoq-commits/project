import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, ClipboardList, QrCode, Sparkles } from 'lucide-react';
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
import { CreateSessionModal, GenerateMonthModal } from './session-modals';
import { SessionsTab } from './sessions-tab';

export function AttendancePage() {
  const { hasPermission } = useAuth();
  const canViewSessions =
    hasPermission(PERMISSIONS.ATTENDANCE_VIEW) || hasPermission(PERMISSIONS.SESSIONS_VIEW);
  const canManageSessions = hasPermission(PERMISSIONS.SESSIONS_MANAGE);
  const canUseQrGate =
    canViewSessions || hasPermission(PERMISSIONS.ATTENDANCE_RECORD);

  const [activeTab, setActiveTab] = React.useState<'sessions' | 'qr-gate'>(
    canViewSessions ? 'sessions' : 'qr-gate',
  );
  const [createOpen, setCreateOpen] = React.useState(false);
  const [generateOpen, setGenerateOpen] = React.useState(false);

  const { data: lookups } = useQuery<AttendanceLookups>({
    queryKey: ['attendance-lookups'],
    enabled: canViewSessions || canManageSessions,
    queryFn: async () => (await apiClient.get('/attendance/lookups')).data,
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="إدارة الحصص ورصد الحضور"
        description="توليد جدول الحصص الشهري، فتح كشوف الحضور، وبوابة مسح الـ QR Code الفورية بالريسبشن"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canUseQrGate && activeTab !== 'qr-gate' && (
              <Button
                size="sm"
                variant="success"
                onClick={() => setActiveTab('qr-gate')}
                className="h-9 gap-1.5 px-3.5"
              >
                <QrCode className="h-4 w-4" />
                بوابة مسح QR الحضور
              </Button>
            )}
            {canManageSessions && (
              <>
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
              </>
            )}
          </div>
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

      {canManageSessions && (
        <>
          <CreateSessionModal open={createOpen} onOpenChange={setCreateOpen} lookups={lookups} />
          <GenerateMonthModal open={generateOpen} onOpenChange={setGenerateOpen} lookups={lookups} />
        </>
      )}
    </div>
  );
}
