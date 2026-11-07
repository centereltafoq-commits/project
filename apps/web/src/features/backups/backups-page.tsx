import * as React from 'react';
import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Cloud,
  Database,
  Download,
  FolderSync,
  HardDrive,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Usb,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/design-system/components/badge';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { Input } from '@/design-system/components/input';
import { PageHeader } from '@/design-system/components/page-header';
import {
  ServerDataTable,
  TableColumn,
} from '@/design-system/components/server-data-table';
import { useToast } from '@/design-system/components/toast';
import { formatDateTimeAr, formatTimeAr } from '@/lib/formatters';
import { backupsApi } from './backups-api';
import { BackupRecord } from './backups.types';
import { BackupRestoreModal } from './backup-restore-modal';
import { useBackupMutations, useBackups, useBackupSettings } from './use-backups';

export function BackupsPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [selectedRecordForRestore, setSelectedRecordForRestore] = useState<BackupRecord | null>(null);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);

  const { data: recordsData, isLoading: isRecordsLoading } = useBackups({ page, limit });
  const { data: settings, isLoading: isSettingsLoading } = useBackupSettings();
  const { triggerMutation, updateSettingsMutation } = useBackupMutations();
  const { notify } = useToast();

  const [localPathInput, setLocalPathInput] = useState('');
  const [scheduleTimeInput, setScheduleTimeInput] = useState('02:00');
  const [retentionInput, setRetentionInput] = useState(30);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);

  React.useEffect(() => {
    if (settings) {
      setLocalPathInput(settings.localPath || '');
      setScheduleTimeInput(settings.scheduleTime || '02:00');
      setRetentionInput(settings.retentionCount || 30);
      setAutoBackupEnabled(settings.autoBackupEnabled);
    }
  }, [settings]);

  const handleCreateBackup = () => {
    triggerMutation.mutate(undefined, {
      onSuccess: () => {
        notify('تم إنشاء النسخة الاحتياطية وتوزيعها بنجاح', 'success');
      },
      onError: (err: any) => {
        notify(err.response?.data?.message || 'حدث خطأ أثناء أخذ النسخة الاحتياطية', 'error');
      },
    });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate(
      {
        localPath: localPathInput.trim(),
        scheduleTime: scheduleTimeInput,
        retentionCount: Number(retentionInput) || 30,
        autoBackupEnabled,
      },
      {
        onSuccess: () => {
          notify('تم تحديث إعدادات مسار الحفظ والجدولة بنجاح', 'success');
        },
        onError: (err: any) => {
          notify(err.response?.data?.message || 'حدث خطأ أثناء حفظ الإعدادات', 'error');
        },
      },
    );
  };

  const latestSuccessBackup = recordsData?.data.find((r) => r.status === 'SUCCESS');

  const columns: TableColumn<BackupRecord>[] = [
    {
      key: 'fileName',
      header: 'اسم الملف',
      render: (row) => (
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary shrink-0" />
          <span className="font-mono text-xs font-bold text-foreground" dir="ltr">
            {row.fileName}
          </span>
        </div>
      ),
    },
    {
      key: 'fileSizeBytes',
      header: 'الحجم',
      render: (row) => (
        <span className="font-mono text-xs text-muted-foreground" dir="ltr">
          {row.fileSizeBytes ? `${(row.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB` : '-'}
        </span>
      ),
    },
    {
      key: 'triggerType',
      header: 'النوع',
      render: (row) => (
        <Badge variant={row.triggerType === 'SCHEDULED' ? 'info' : 'neutral'}>
          {row.triggerType === 'SCHEDULED' ? 'تلقائي مجدول' : 'يدوي فوري'}
        </Badge>
      ),
    },
    {
      key: 'destinations',
      header: 'الوجهات المكتملة',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.destinations?.map((d) => (
            <span
              key={d}
              className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-foreground"
            >
              {d === 'SERVER_STORAGE' && <HardDrive className="h-2.5 w-2.5 text-primary" />}
              {d === 'LOCAL' && <Usb className="h-2.5 w-2.5 text-emerald-500" />}
              {d === 'GOOGLE_DRIVE' && <Cloud className="h-2.5 w-2.5 text-blue-500" />}
              <span>{d === 'LOCAL' ? 'المسار المحلي/فلاشة' : d === 'GOOGLE_DRIVE' ? 'Google Drive' : 'التخزين السحابي'}</span>
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'الحالة',
      render: (row) => (
        <Badge
          variant={
            row.status === 'SUCCESS' ? 'success' : row.status === 'FAILED' ? 'danger' : 'warning'
          }
        >
          {row.status === 'SUCCESS' ? 'ناجحة' : row.status === 'FAILED' ? 'فشلت' : 'قيد الإنشاء'}
        </Badge>
      ),
    },
    {
      key: 'createdAt',
      header: 'التاريخ والتوقيت',
      render: (row) => (
        <span className="text-xs text-muted-foreground font-mono">
          {formatDateTimeAr(row.createdAt)}
        </span>
      ),
    },
    {
      key: 'id',
      header: 'إجراءات',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <a
            href={backupsApi.downloadUrl(row.id)}
            download={row.fileName}
            className="inline-flex items-center justify-center h-8 px-2.5 rounded-lg border border-border bg-card text-xs font-semibold text-foreground hover:bg-accent transition-colors gap-1"
            title="تحميل الملف على الكمبيوتر أو الفلاشة"
          >
            <Download className="h-3.5 w-3.5 text-primary" />
            <span>تحميل</span>
          </a>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedRecordForRestore(row);
              setRestoreModalOpen(true);
            }}
            className="h-8 gap-1 text-xs text-amber-600 hover:text-amber-700 dark:text-amber-400"
            title="استعادة قاعدة البيانات من هذه النسخة"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>استعادة</span>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="النسخ الاحتياطي واستعادة البيانات"
        description="إدارة وتأمين بيانات السنتر محلياً وسحابياً وحفظها تلقائياً على الفلاشة أو الديسك توب أو Google Drive"
        actions={
          <Button
            onClick={handleCreateBackup}
            disabled={triggerMutation.isPending}
            className="gap-2"
          >
            {triggerMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            <span>إنشاء نسخة احتياطية فورية الآن</span>
          </Button>
        }
      />

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">آخر نسخة ناجحة</span>
            <span className="text-sm font-bold text-foreground">
              {latestSuccessBackup
                ? formatDateTimeAr(latestSuccessBackup.createdAt)
                : 'لا توجد نسخ بعد'}
            </span>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">حجم آخر نسخة</span>
            <span className="text-sm font-bold text-foreground font-mono">
              {latestSuccessBackup?.fileSizeBytes
                ? `${(latestSuccessBackup.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB`
                : '-'}
            </span>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">النسخ التلقائي المجدول</span>
            <span className="text-sm font-bold text-foreground">
              {settings?.autoBackupEnabled
                ? `مفعل (يومياً ${formatTimeAr(settings.scheduleTime)})`
                : 'معطل'}
            </span>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-500">
            <Cloud className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">التخزين السحابي</span>
            <span className="text-sm font-bold text-foreground">
              {settings?.googleDriveEnabled ? 'متصل بـ Google Drive' : 'محلي / مباشر'}
            </span>
          </div>
        </Card>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Local & USB Storage Card */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Usb className="h-5 w-5 text-emerald-500" />
            <h3 className="font-bold text-sm text-foreground">
              مسار الحفظ المحلي / الفلاشة الموصولة
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            حدد مسار أي مجلد على الكمبيوتر (مثل الديسك توب) أو مسار فلاشة USB موصولة لحفظ نسخة احتياطية فيها تلقائياً فور إنشائها.
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-3">
            <Input
              label="مسار المجلد المحلي على الجهاز"
              placeholder="مثال: C:\Users\Mohamed\Desktop\EduCenter_Backups أو E:\Backups"
              value={localPathInput}
              onChange={(e) => setLocalPathInput(e.target.value)}
            />
            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                size="sm"
                disabled={updateSettingsMutation.isPending}
                className="gap-1.5"
              >
                {updateSettingsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>حفظ المسار المحلي</span>
              </Button>
            </div>
          </form>
        </Card>

        {/* Schedule & Retention Card */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Clock className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">الجدولة وسياسة الاحتفاظ</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            يقوم النظام بأخذ نسخة يومية في الوقت المحدد تلقائياً دون أي تدخل، مع مسح النسخ الأقدم لتوفير المساحة.
          </p>

          <form onSubmit={handleSaveSettings} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="وقت النسخ اليومي (HH:mm)"
                type="text"
                placeholder="02:00"
                value={scheduleTimeInput}
                onChange={(e) => setScheduleTimeInput(e.target.value)}
              />
              <Input
                label="الاحتفاظ بآخر (نسخة)"
                type="number"
                min={1}
                max={365}
                value={retentionInput}
                onChange={(e) => setRetentionInput(Number(e.target.value))}
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoBackupEnabled}
                  onChange={(e) => setAutoBackupEnabled(e.target.checked)}
                  className="rounded border-border"
                />
                <span>تفعيل النسخ اليومي التلقائي في الخلفية</span>
              </label>
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={updateSettingsMutation.isPending}
                className="gap-1.5"
              >
                <Save className="h-4 w-4" />
                <span>تحديث الجدولة</span>
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* History Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">سجل النسخ الاحتياطية المأخوذة</h2>
          <span className="text-xs text-muted-foreground font-semibold">
            إجمالي النسخ المسجلة: {recordsData?.meta.totalItems || 0}
          </span>
        </div>

        <ServerDataTable
          columns={columns}
          data={recordsData?.data ?? []}
          meta={recordsData?.meta}
          isLoading={isRecordsLoading}
          rowKey={(r) => r.id}
          page={page}
          onPageChange={setPage}
          limit={limit}
          onLimitChange={setLimit}
        />
      </div>

      <BackupRestoreModal
        open={restoreModalOpen}
        onOpenChange={setRestoreModalOpen}
        record={selectedRecordForRestore}
      />
    </div>
  );
}
