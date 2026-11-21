import * as React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cloud,
  CloudDownload,
  CloudUpload,
  Database,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Laptop,
  Loader2,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import {
  Badge,
  Button,
  Input,
  Modal,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from '@/design-system';
import { cn } from '@/lib/cn';
import { extractErrorMessage } from '@/lib/api-client';
import { formatDateTimeAr } from '@/lib/formatters';
import { CloudSyncVersionEntry } from '@/features/backups/cloud-sync-api';
import { useCloudSyncMutations, useCloudSyncStatus } from '@/features/backups/use-cloud-sync';

export interface CloudSyncModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: 'sync' | 'config';
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function CloudSyncModal({
  open,
  onOpenChange,
  defaultTab = 'sync',
}: CloudSyncModalProps) {
  const { notify } = useToast();
  const {
    data: status,
    isLoading,
    isFetching,
    refetch,
  } = useCloudSyncStatus(open);
  const { testMutation, saveConfigMutation, pushMutation, pullMutation } =
    useCloudSyncMutations();

  const [activeTab, setActiveTab] = React.useState<'sync' | 'config'>(defaultTab);
  const [pushNote, setPushNote] = React.useState('');
  const [confirmForcePush, setConfirmForcePush] = React.useState(false);
  const [confirmPullTarget, setConfirmPullTarget] = React.useState<number | null>(null);
  const [showPullConfirmBanner, setShowPullConfirmBanner] = React.useState(false);

  // Supabase connection settings form
  const [deviceName, setDeviceName] = React.useState('');
  const [supabaseUrl, setSupabaseUrl] = React.useState('');
  const [supabaseKey, setSupabaseKey] = React.useState('');
  const [bucketName, setBucketName] = React.useState('educenter-sync');
  const [showKey, setShowKey] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setActiveTab(
        defaultTab === 'config' || (status && !status.configured)
          ? 'config'
          : defaultTab,
      );
      setConfirmForcePush(false);
      setShowPullConfirmBanner(false);
      setConfirmPullTarget(null);
    }
  }, [open, defaultTab, status?.configured]);

  React.useEffect(() => {
    if (status) {
      setDeviceName(status.deviceName || 'جهاز السنتر الرئيسي (الأسستنت)');
      setSupabaseUrl(status.supabaseUrl || '');
      setBucketName(status.bucketName || 'educenter-sync');
      setSupabaseKey('');
    }
  }, [status?.deviceName, status?.supabaseUrl, status?.bucketName, open]);

  const isBusy =
    pushMutation.isPending ||
    pullMutation.isPending ||
    saveConfigMutation.isPending ||
    testMutation.isPending;

  const handleTestConnection = async () => {
    if (!supabaseUrl.trim()) {
      notify('يرجى إدخال رابط مشروع Supabase أولاً', 'error');
      return;
    }
    try {
      const res = await testMutation.mutateAsync({
        supabaseUrl: supabaseUrl.trim(),
        supabaseKey: supabaseKey.trim() || undefined,
        bucketName: bucketName.trim() || 'educenter-sync',
      });
      notify(res.message, 'success');
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim()) {
      notify('يرجى تحديد اسم واضح لهذا الجهاز', 'error');
      return;
    }
    if (!supabaseUrl.trim()) {
      notify('يرجى إدخال رابط مشروع Supabase', 'error');
      return;
    }
    if (!status?.hasSupabaseKey && !supabaseKey.trim()) {
      notify('يرجى إدخال مفتاح الصلاحية (service_role key)', 'error');
      return;
    }
    try {
      const res = await saveConfigMutation.mutateAsync({
        deviceName: deviceName.trim(),
        supabaseUrl: supabaseUrl.trim(),
        supabaseKey: supabaseKey.trim() || undefined,
        bucketName: bucketName.trim() || 'educenter-sync',
        enabled: true,
      });
      setSupabaseKey('');
      notify(res.message, 'success');
      setActiveTab('sync');
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handlePush = async (force = false) => {
    const needsForce =
      !force &&
      Boolean(status?.state === 'REMOTE_NEWER' || status?.state === 'CONFLICT');
    if (needsForce && !confirmForcePush) {
      setConfirmForcePush(true);
      return;
    }

    try {
      const res = await pushMutation.mutateAsync({
        note: pushNote.trim() || undefined,
        force: force || confirmForcePush,
      });
      setPushNote('');
      setConfirmForcePush(false);
      notify(res.message, 'success');
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setConfirmForcePush(true);
      }
      notify(extractErrorMessage(err), 'error');
    }
  };

  const handlePull = async (
    targetVersion?: number,
    confirmedOverwrite = false,
  ) => {
    if (
      !confirmedOverwrite &&
      (status?.hasLocalUnsyncedChanges || status?.state === 'CONFLICT')
    ) {
      setConfirmPullTarget(targetVersion ?? null);
      setShowPullConfirmBanner(true);
      return;
    }

    try {
      const res = await pullMutation.mutateAsync({
        targetVersion,
        confirmOverwriteLocalChanges: confirmedOverwrite || showPullConfirmBanner,
      });
      setShowPullConfirmBanner(false);
      setConfirmPullTarget(null);
      notify(res.message, 'success');
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setConfirmPullTarget(targetVersion ?? null);
        setShowPullConfirmBanner(true);
      }
      notify(extractErrorMessage(err), 'error');
    }
  };

  const renderStateBanner = () => {
    if (!status) return null;

    const map = {
      IN_SYNC: {
        cls: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        icon: <CheckCircle2 className="h-5 w-5 shrink-0" />,
        badge: <Badge variant="success">متزامن</Badge>,
      },
      REMOTE_NEWER: {
        cls: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300',
        icon: <CloudDownload className="h-5 w-5 shrink-0" />,
        badge: <Badge variant="warning">يوجد تحديث للسحب</Badge>,
      },
      LOCAL_AHEAD: {
        cls: 'border-primary/40 bg-primary/10 text-primary',
        icon: <CloudUpload className="h-5 w-5 shrink-0" />,
        badge: <Badge variant="info">تعديلات محلية غير منشورة</Badge>,
      },
      CONFLICT: {
        cls: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
        icon: <AlertTriangle className="h-5 w-5 shrink-0" />,
        badge: <Badge variant="danger">تنبيه تعارض</Badge>,
      },
      REMOTE_EMPTY: {
        cls: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
        icon: <Cloud className="h-5 w-5 shrink-0" />,
        badge: <Badge variant="info">السحابة فارغة</Badge>,
      },
      CONNECTION_ERROR: {
        cls: 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300',
        icon: <AlertTriangle className="h-5 w-5 shrink-0" />,
        badge: <Badge variant="danger">تعذر الاتصال</Badge>,
      },
      NOT_CONFIGURED: {
        cls: 'border-border bg-muted/40 text-foreground',
        icon: <Settings2 className="h-5 w-5 shrink-0 text-muted-foreground" />,
        badge: <Badge variant="neutral">غير مربوط</Badge>,
      },
    }[status.state];

    return (
      <div className={cn('flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 text-xs', map.cls)}>
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {map.icon}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm">حالة المزامنة الآن</span>
              {map.badge}
            </div>
            <p className="mt-0.5 leading-relaxed opacity-90">{status.stateMessageAr}</p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching || isBusy}
          className="h-8 gap-1.5 text-xs bg-card"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          <span>تحديث الحالة</span>
        </Button>
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="المزامنة السحابية بين الأجهزة عبر Supabase"
      description="انشر تعديلات السنتر في نهاية اليوم واسحبها بأمان تام على جهاز المدير عبر أي شبكة إنترنت"
      size="xl"
    >
      <div className="space-y-4">
        {isLoading && !status ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <span className="text-sm font-semibold">جاري فحص حالة المزامنة السحابية...</span>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'sync' | 'config')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sync" data-testid="cloud-sync-tab-sync">
                <Cloud className="h-4 w-4" />
                <span>نشر وسحب التعديلات (Push &amp; Pull)</span>
              </TabsTrigger>
              <TabsTrigger value="config" data-testid="cloud-sync-tab-config">
                <Settings2 className="h-4 w-4" />
                <span>إعدادات الربط بـ Supabase</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sync" className="space-y-4">
              {renderStateBanner()}

              {!status?.configured ? (
                <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-6 text-center space-y-3">
                  <Cloud className="h-10 w-10 text-primary mx-auto" />
                  <h4 className="text-sm font-bold text-foreground">
                    قم بربط حساب Supabase الخاص بك مرة واحدة لبدء المزامنة
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-lg mx-auto leading-relaxed">
                    افتح تبويب «إعدادات الربط بـ Supabase» وأدخل رابط المشروع ومفتاح الصلاحية (service_role) لتفعيل النشر والسحب بين جهاز السنتر وجهاز المدير.
                  </p>
                  <Button
                    type="button"
                    onClick={() => setActiveTab('config')}
                    className="gap-2"
                  >
                    <Settings2 className="h-4 w-4" />
                    <span>إعداد الربط الآن</span>
                  </Button>
                </div>
              ) : (
                <>
                  {/* Comparison Cards: Local vs Cloud */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Local Device Card */}
                    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-border pb-2.5">
                        <div className="flex items-center gap-2">
                          <Laptop className="h-4 w-4 text-primary" />
                          <span className="text-sm font-bold">هذا الجهاز (المحلي)</span>
                        </div>
                        <Badge variant={status.hasLocalUnsyncedChanges ? 'warning' : 'success'}>
                          {status.hasLocalUnsyncedChanges ? 'تعديلات غير منشورة' : 'متطابق'}
                        </Badge>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">اسم الجهاز:</span>
                          <span className="font-bold text-foreground">{status.deviceName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">آخر إصدار متزامن:</span>
                          <span className="font-mono font-bold text-foreground">
                            {status.lastSyncedVersion > 0 ? `v${status.lastSyncedVersion}` : 'لم يتزامن بعد'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">آخر مزامنة:</span>
                          <span className="text-foreground">
                            {status.lastSyncedAt ? formatDateTimeAr(status.lastSyncedAt) : '—'}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 rounded-lg bg-muted/40 p-2 text-center text-[11px]">
                        <div>
                          <div className="font-bold text-foreground">{status.localStats.studentsCount}</div>
                          <div className="text-muted-foreground">طالب</div>
                        </div>
                        <div>
                          <div className="font-bold text-foreground">{status.localStats.groupsCount}</div>
                          <div className="text-muted-foreground">مجموعة</div>
                        </div>
                        <div>
                          <div className="font-bold text-foreground">{status.localStats.attendanceCount}</div>
                          <div className="text-muted-foreground">حضور</div>
                        </div>
                        <div>
                          <div className="font-bold text-foreground">{status.localStats.paymentsCount}</div>
                          <div className="text-muted-foreground">إيصال دفع</div>
                        </div>
                      </div>
                    </div>

                    {/* Remote Cloud Card */}
                    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                      <div className="flex items-center justify-between border-b border-border pb-2.5">
                        <div className="flex items-center gap-2">
                          <Cloud className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-bold">آخر نسخة على السحابة</span>
                        </div>
                        {status.remoteLatest ? (
                          <Badge variant="info" className="font-mono">
                            v{status.remoteLatest.version}
                          </Badge>
                        ) : (
                          <Badge variant="neutral">لا يوجد</Badge>
                        )}
                      </div>

                      {status.remoteLatest ? (
                        <>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">نُشرت من جهاز:</span>
                              <span className="font-bold text-foreground">{status.remoteLatest.deviceName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">بواسطة:</span>
                              <span className="font-semibold text-foreground flex items-center gap-1">
                                <UserCheck className="h-3.5 w-3.5 text-primary" />
                                {status.remoteLatest.pushedByName}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">توقيت النشر:</span>
                              <span className="text-foreground">{formatDateTimeAr(status.remoteLatest.pushedAt)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">الحجم وبصمة الأمان:</span>
                              <span className="font-mono text-[11px] text-foreground" dir="ltr">
                                {formatBytes(status.remoteLatest.fileSizeBytes)} · {status.remoteLatest.checksum.slice(0, 10)}
                              </span>
                            </div>
                            {status.remoteLatest.note && (
                              <div className="rounded-md bg-primary/5 border border-primary/20 px-2.5 py-1.5 text-[11px] text-foreground">
                                <span className="font-bold">ملاحظة: </span>
                                {status.remoteLatest.note}
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-4 gap-1.5 rounded-lg bg-muted/40 p-2 text-center text-[11px]">
                            <div>
                              <div className="font-bold text-foreground">{status.remoteLatest.stats.studentsCount}</div>
                              <div className="text-muted-foreground">طالب</div>
                            </div>
                            <div>
                              <div className="font-bold text-foreground">{status.remoteLatest.stats.groupsCount}</div>
                              <div className="text-muted-foreground">مجموعة</div>
                            </div>
                            <div>
                              <div className="font-bold text-foreground">{status.remoteLatest.stats.attendanceCount}</div>
                              <div className="text-muted-foreground">حضور</div>
                            </div>
                            <div>
                              <div className="font-bold text-foreground">{status.remoteLatest.stats.paymentsCount}</div>
                              <div className="text-muted-foreground">إيصال دفع</div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-muted-foreground">
                          <Database className="h-7 w-7 mb-2 opacity-40" />
                          <span>لم يتم نشر أي نسخة قاعدة بيانات على هذا المشروع السحابي بعد.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Push & Pull Primary Actions */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* PUSH PANEL */}
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <CloudUpload className="h-5 w-5 text-primary" />
                        <h4 className="text-sm font-bold text-foreground">
                          1. نشر تعديلات هذا الجهاز للسحابة (Push)
                        </h4>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        تُرفع نسخة مضغوطة ومتحقق من سلامتها (SHA-256) شاملة كل الطلاب والحضور والمالية وقوالب الواتساب.
                      </p>
                      <Input
                        placeholder="ملاحظة اختيارية للطرف الآخر (مثال: إغلاق وردية اليوم)..."
                        value={pushNote}
                        onChange={(e) => setPushNote(e.target.value)}
                        disabled={isBusy}
                      />

                      {confirmForcePush ? (
                        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2 text-xs">
                          <p className="font-bold text-amber-800 dark:text-amber-300">
                            ⚠️ تنبيه: توجد نسخة أحدث على السحابة (v{status.remoteLatest?.version}) لم تسحبها بعد. هل تريد النشر فوقها على أي حال؟
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={() => handlePush(true)}
                              isLoading={pushMutation.isPending}
                              disabled={isBusy}
                            >
                              تأكيد النشر الآن فوق النسخة الحالية
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setConfirmForcePush(false)}
                              disabled={isBusy}
                            >
                              إلغاء
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="primary"
                          className="w-full gap-2"
                          onClick={() => handlePush(false)}
                          isLoading={pushMutation.isPending}
                          disabled={isBusy}
                          data-testid="cloud-sync-push-btn"
                        >
                          <CloudUpload className="h-4 w-4" />
                          <span>نشر التعديلات للسحابة الآن (Push)</span>
                        </Button>
                      )}
                    </div>

                    {/* PULL PANEL */}
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <CloudDownload className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="text-sm font-bold text-foreground">
                          2. سحب آخر التعديلات من السحابة (Pull)
                        </h4>
                      </div>
                      <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-background/70 p-2.5 text-[11px] text-muted-foreground leading-relaxed">
                        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>
                          حماية تلقائية من 5 طبقات: أخذ نسخة احتياطية محلية تلقائياً قبل السحب + فحص سلامة الملف SHA-256 + استعادة ذرية في معاملة واحدة لا تقبل التجزئة.
                        </span>
                      </div>
                      {status.lastSyncedVersion === 0 && status.remoteLatest && (
                        <p className="text-[11px] text-muted-foreground">
                          ملاحظة: في أول عملية سحب بين جهازين جديدين قد يطلب النظام إعادة تسجيل الدخول لتوحيد حسابات المستخدمين.
                        </p>
                      )}

                      {showPullConfirmBanner ? (
                        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 space-y-2 text-xs">
                          <p className="font-bold text-rose-700 dark:text-rose-300">
                            ⚠️ لديك بيانات أو تعديلات محلية غير منشورة. سيتم حفظ نسخة احتياطية محلية من جهازك تلقائياً قبل السحب لحماية بياناتك. هل تريد المتابعة؟
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              onClick={() =>
                                handlePull(confirmPullTarget ?? undefined, true)
                              }
                              isLoading={pullMutation.isPending}
                              disabled={isBusy}
                              data-testid="cloud-sync-confirm-pull-btn"
                            >
                              تأكيد السحب وحفظ نسخة الأمان المحلية
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowPullConfirmBanner(false);
                                setConfirmPullTarget(null);
                              }}
                              disabled={isBusy}
                            >
                              تراجع
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full gap-2 border-emerald-500/40 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white"
                          onClick={() => handlePull(undefined, false)}
                          isLoading={pullMutation.isPending}
                          disabled={isBusy || !status.remoteLatest}
                          data-testid="cloud-sync-pull-btn"
                        >
                          <CloudDownload className="h-4 w-4" />
                          <span>
                            {status.remoteLatest
                              ? `سحب آخر التعديلات الآن (v${status.remoteLatest.version})`
                              : 'لا توجد نسخة للسحب بعد'}
                          </span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Cloud History List */}
                  {status.remoteHistory && status.remoteHistory.length > 0 && (
                    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <History className="h-4 w-4 text-primary" />
                          <h4 className="text-sm font-bold text-foreground">
                            سجل النسخ المنشورة على السحابة (آخر {status.remoteHistory.length} إصدارات)
                          </h4>
                        </div>
                      </div>
                      <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                        {status.remoteHistory.map((item: CloudSyncVersionEntry) => (
                          <div
                            key={`${item.version}-${item.pushedAt}`}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-2 text-xs"
                          >
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="info" className="font-mono text-[11px]">
                                  v{item.version}
                                </Badge>
                                <span className="font-bold text-foreground">{item.deviceName}</span>
                                <span className="text-muted-foreground">• بواسطة: {item.pushedByName}</span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {formatDateTimeAr(item.pushedAt)}
                                </span>
                                <span>{item.stats.studentsCount} طالب</span>
                                <span>{item.stats.paymentsCount} مدفوعات</span>
                                <span>{formatBytes(item.fileSizeBytes)}</span>
                              </div>
                              {item.note && (
                                <p className="text-[11px] text-primary font-medium">{item.note}</p>
                              )}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isBusy}
                              onClick={() => handlePull(item.version, false)}
                              className="h-7 px-2.5 text-[11px] gap-1"
                            >
                              <CloudDownload className="h-3 w-3" />
                              <span>سحب هذا الإصدار</span>
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="config" className="space-y-4">
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3.5 text-xs space-y-1.5">
                <p className="font-bold text-blue-800 dark:text-blue-300">
                  خطوات إنشاء وربط مشروع Supabase مجاني في دقيقتين:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>
                    سجّل دخول في <span className="font-mono font-semibold" dir="ltr">supabase.com</span> وأنشئ مشروعاً جديداً (<span className="font-mono" dir="ltr">New Project</span>).
                  </li>
                  <li>
                    من قائمة <span className="font-semibold">Project Settings &gt; API</span> انسخ <span className="font-semibold">Project URL</span> ومفتاح <span className="font-mono font-semibold" dir="ltr">service_role</span> السري.
                  </li>
                  <li>
                    أدخل نفس بيانات المشروع على جهاز السنتر وجهاز المدير، واختر اسماً مميزاً لكل جهاز ثم اضغط «حفظ وتهيئة السحابة» (يتم إنشاء الحاوية الخاصة تلقائياً).
                  </li>
                </ol>
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      اسم هذا الجهاز (يظهر عند كل نشر لتوضيح مصدر التعديل):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-[11px] gap-1"
                        onClick={() => setDeviceName('جهاز السنتر الرئيسي (الأسستنت)')}
                      >
                        <Server className="h-3 w-3 text-emerald-600" />
                        <span>جهاز السنتر الرئيسي</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-[11px] gap-1"
                        onClick={() => setDeviceName('جهاز المدير (المتابعة والإدارة)')}
                      >
                        <Laptop className="h-3 w-3 text-primary" />
                        <span>جهاز المدير</span>
                      </Button>
                    </div>
                  </div>
                  <Input
                    label="اسم هذا الجهاز *"
                    placeholder="مثال: جهاز السنتر الرئيسي (الأسستنت)"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    disabled={isBusy}
                  />
                </div>

                <Input
                  label="رابط مشروع Supabase (Project URL) *"
                  placeholder="https://xxxxxxxxxxxx.supabase.co"
                  dir="ltr"
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  disabled={isBusy}
                />

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 text-primary" />
                      <span>مفتاح الصلاحية (Supabase service_role key) *</span>
                    </label>
                    {status?.hasSupabaseKey && (
                      <Badge variant="success" className="text-[10px]">
                        محفوظ ({status.supabaseKeyMasked})
                      </Badge>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      dir="ltr"
                      value={supabaseKey}
                      onChange={(e) => setSupabaseKey(e.target.value)}
                      disabled={isBusy}
                      placeholder={
                        status?.hasSupabaseKey
                          ? 'اتركه فارغاً للإبقاء على المفتاح المحفوظ أو الصق مفتاحاً جديداً'
                          : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
                      }
                      className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 pr-10 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((s) => !s)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      title={showKey ? 'إخفاء المفتاح' : 'إظهار المفتاح'}
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    يُحفظ المفتاح محلياً على السيرفر فقط ولا يُرسل للمتصفح أو ينتشر خارج الجهاز.
                  </p>
                </div>

                <Input
                  label="اسم حاوية التخزين السحابية (Storage Bucket)"
                  placeholder="educenter-sync"
                  dir="ltr"
                  value={bucketName}
                  onChange={(e) => setBucketName(e.target.value)}
                  disabled={isBusy}
                  hint="يتم إنشاؤها تلقائياً كحاوية خاصة محمية (Private Bucket) عند الضغط على فحص أو حفظ"
                />

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestConnection}
                    isLoading={testMutation.isPending}
                    disabled={isBusy}
                  >
                    فحص الاتصال وتجهيز الحاوية
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={saveConfigMutation.isPending}
                    disabled={isBusy}
                    data-testid="cloud-sync-save-config-btn"
                  >
                    حفظ الإعدادات وتفعيل المزامنة
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Modal>
  );
}
