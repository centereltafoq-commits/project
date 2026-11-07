import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { PageHeader, Tabs, TabsContent, TabsList, TabsTrigger } from '@/design-system';
import { apiClient } from '@/lib/api-client';
import { AttendanceLookups } from './attendance.types';
import { MakeupsTab } from './makeups-tab';
import { SessionsTab } from './sessions-tab';

export function AttendancePage() {
  const { data: lookups } = useQuery<AttendanceLookups>({
    queryKey: ['attendance-lookups'],
    queryFn: async () => (await apiClient.get('/attendance/lookups')).data,
  });

  return (
    <div>
      <PageHeader
        title="إدارة الحصص ورصد الحضور والتعويضات"
        description="توليد جدول الحصص الشهري، فتح كشوف الحضور الفعلية للطلاب، واعتماد الحصص التعويضية بدقة"
      />

      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">
            <ClipboardCheck className="h-4 w-4" />
            حصص اليوم وسجل الحضور
          </TabsTrigger>
          <TabsTrigger value="makeups">
            <RefreshCw className="h-4 w-4" />
            الحصص التعويضية
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions">
          <SessionsTab lookups={lookups} />
        </TabsContent>

        <TabsContent value="makeups">
          <MakeupsTab lookups={lookups} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
