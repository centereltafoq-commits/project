import * as React from 'react';
import {
  CheckCircle2,
  CloudDownload,
  Github,
  Loader2,
  RefreshCw,
  RotateCw,
} from 'lucide-react';
import { Badge, Button, Input, Modal, useToast } from '@/design-system';
import { useDesktop, type DesktopUpdateStatus } from '@/hooks/use-desktop';

const UPDATE_STATE_BADGE: Record<
  DesktopUpdateStatus['state'],
  { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }
> = {
  IDLE: { label: 'جاهز للفحص', variant: 'neutral' },
  UNCONFIGURED: { label: 'بانتظار ربط GitHub', variant: 'warning' },
  CHECKING: { label: 'جاري البحث...', variant: 'info' },
  AVAILABLE: { label: 'يوجد إصدار جديد', variant: 'info' },
  DOWNLOADING: { label: 'جاري التنزيل', variant: 'info' },
  DOWNLOADED: { label: 'جاهز للتثبيت', variant: 'success' },
  UP_TO_DATE: { label: 'مُحدّث لآخر إصدار', variant: 'success' },
  ERROR: { label: 'تعذر الفحص', variant: 'danger' },
};

/**
 * Parses either a separate owner/repo pair or a full GitHub URL (`https://github.com/owner/repo`)
 * or `owner/repo` shorthand into clean owner and repo strings.
 */
export function parseGithubRepoInput(
  ownerOrUrl: string,
  repoInput: string,
): { githubOwner: string; githubRepo: string } {
  const rawOwner = ownerOrUrl.trim();
  const rawRepo = repoInput.trim() || 'project';

  const urlMatch = rawOwner.match(
    /github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?\/?$/i,
  );
  if (urlMatch?.[1] && urlMatch?.[2]) {
    return { githubOwner: urlMatch[1], githubRepo: urlMatch[2] };
  }

  const slashMatch = rawOwner.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (slashMatch?.[1] && slashMatch?.[2]) {
    return {
      githubOwner: slashMatch[1],
      githubRepo: slashMatch[2].replace(/\.git$/i, ''),
    };
  }

  return { githubOwner: rawOwner, githubRepo: rawRepo };
}

export interface DesktopUpdatePanelProps {
  compact?: boolean;
}

export function DesktopUpdatePanel({ compact = false }: DesktopUpdatePanelProps) {
  const { notify } = useToast();
  const {
    isDesktop,
    config,
    updateStatus,
    saveConfig,
    checkForUpdates,
    installUpdate,
  } = useDesktop();

  const [githubOwner, setGithubOwner] = React.useState('centereltafoq-commits');
  const [githubRepo, setGithubRepo] = React.useState('project');
  const [autoCheck, setAutoCheck] = React.useState(true);
  const [savingRepo, setSavingRepo] = React.useState(false);

  React.useEffect(() => {
    const settings = config?.updateSettings;
    if (settings) {
      setGithubOwner(
        settings.githubOwner || updateStatus?.githubOwner || 'centereltafoq-commits',
      );
      setGithubRepo(settings.githubRepo || updateStatus?.githubRepo || 'project');
      setAutoCheck(settings.autoCheck ?? true);
    }
  }, [config?.updateSettings, updateStatus?.githubOwner, updateStatus?.githubRepo]);

  if (!isDesktop) return null;

  const badge = UPDATE_STATE_BADGE[updateStatus?.state ?? 'UNCONFIGURED'];
  const isCheckingOrDownloading =
    updateStatus?.state === 'CHECKING' || updateStatus?.state === 'DOWNLOADING';

  const handleSaveUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseGithubRepoInput(githubOwner, githubRepo);
    setGithubOwner(parsed.githubOwner);
    setGithubRepo(parsed.githubRepo);
    setSavingRepo(true);
    try {
      await saveConfig({
        updateSettings: {
          autoCheck,
          githubOwner: parsed.githubOwner,
          githubRepo: parsed.githubRepo,
        },
      });
      notify('تم حفظ إعدادات التحديث التلقائي عبر GitHub Releases', 'success');
    } catch {
      notify('فشل حفظ إعدادات التحديث', 'error');
    } finally {
      setSavingRepo(false);
    }
  };

  const handlePrimaryUpdateAction = async () => {
    if (updateStatus?.state === 'DOWNLOADED') {
      await installUpdate();
      return;
    }

    const res = await checkForUpdates();
    if (res?.state === 'UNCONFIGURED') {
      notify('أدخل رابط أو اسم مستودع GitHub أولاً ثم اضغط حفظ لتفعيل التحديث التلقائي', 'info');
    } else if (res?.state === 'UP_TO_DATE') {
      notify('البرنامج محدث بالفعل إلى أحدث إصدار', 'success');
    } else if (res?.state === 'ERROR') {
      notify(res.error || 'تعذر الاتصال بـ GitHub للتحقق من التحديثات', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="space-y-3 rounded-xl border border-border bg-muted/10 p-4">
          <h4 className="text-sm font-bold text-foreground">
            تشغيل الخلفية والبدء التلقائي مع الويندوز
          </h4>

          <label className="flex items-start gap-3 cursor-pointer select-none rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/20">
            <input
              type="checkbox"
              aria-label="إبقاء السيرفر يعمل بجانب الساعة عند إغلاق النافذة"
              checked={config?.keepRunningInTray ?? true}
              onChange={async (e) => {
                try {
                  await saveConfig({ keepRunningInTray: e.target.checked });
                  notify('تم تحديث إعداد الإبقاء في الخلفية بجانب الساعة', 'success');
                } catch {
                  notify('فشل حفظ الإعداد', 'error');
                }
              }}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <div>
              <span className="text-xs font-bold text-foreground block">
                إبقاء السيرفر يعمل في الخلفية بجانب الساعة (System Tray) عند إغلاق النافذة
              </span>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                في وضع السيرفر الرئيسي، إغلاق النافذة يصغّرها بجانب الساعة حتى لا تنقطع الشبكة عن باقي أجهزة السنتر.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer select-none rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/20">
            <input
              type="checkbox"
              aria-label="تشغيل البرنامج تلقائياً مع فتح الويندوز"
              checked={Boolean(config?.launchOnStartup)}
              onChange={async (e) => {
                try {
                  await saveConfig({ launchOnStartup: e.target.checked });
                  notify('تم تحديث إعداد التشغيل التلقائي مع الويندوز', 'success');
                } catch {
                  notify('فشل حفظ الإعداد', 'error');
                }
              }}
              className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <div>
              <span className="text-xs font-bold text-foreground block">
                تشغيل البرنامج تلقائياً عند فتح الويندوز
              </span>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                مناسب لجهاز السيرفر الرئيسي ليبدأ العمل مباشرة فور تشغيل الجهاز دون تدخل يدوي.
              </span>
            </div>
          </label>
        </div>
      )}

      {/* GitHub Releases Auto-Update Panel */}
      <div className="space-y-4 rounded-xl border border-border bg-muted/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <CloudDownload className="h-4 w-4 text-primary" />
            <div>
              <h4 className="text-sm font-bold text-foreground">
                التحديثات التلقائية (GitHub Releases Auto-Update)
              </h4>
              <p className="text-[11px] text-muted-foreground">
                الإصدار المثبت حالياً:{' '}
                <span className="font-mono font-bold">v{updateStatus?.currentVersion || '1.0.0'}</span>
              </p>
            </div>
          </div>
          <Badge variant={badge.variant} className="text-xs">
            {badge.label}
            {updateStatus?.state === 'DOWNLOADING' && updateStatus.downloadPercent !== undefined
              ? ` (${updateStatus.downloadPercent}%)`
              : ''}
          </Badge>
        </div>

        {(updateStatus?.state === 'DOWNLOADING' || updateStatus?.state === 'AVAILABLE') && (
          <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span>
                {updateStatus.state === 'AVAILABLE'
                  ? `تم العثور على الإصدار v${updateStatus.availableVersion || ''} — جاري بدء التحميل...`
                  : `جاري تحميل التحديث التلقائي v${updateStatus.availableVersion || ''}...`}
              </span>
              <span className="font-mono">{updateStatus.downloadPercent ?? 0}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(4, updateStatus.downloadPercent ?? 0))}%` }}
              />
            </div>
          </div>
        )}

        {updateStatus?.state === 'DOWNLOADED' && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                تم تنزيل الإصدار الجديد <span className="font-mono">v{updateStatus.availableVersion}</span> وجاهز للتثبيت مع الحفاظ على البيانات.
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant="success"
              onClick={() => void installUpdate()}
              className="gap-1.5"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>تثبيت وإعادة التشغيل الآن</span>
            </Button>
          </div>
        )}

        {updateStatus?.state === 'ERROR' && updateStatus.error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
            {updateStatus.error}
          </p>
        )}

        {!updateStatus?.isConfigured && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-200">
            أدخل رابط مستودع GitHub أو اسم الحساب والمستودع أدناه ثم اضغط حفظ لتفعيل التحديث التلقائي بضغطة زر.
          </p>
        )}

        <form onSubmit={handleSaveUpdateSettings} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="حساب GitHub أو رابط المستودع"
              placeholder="مثال: nazzem-edu أو https://github.com/owner/repo"
              value={githubOwner}
              onChange={(e) => setGithubOwner(e.target.value)}
              dir="ltr"
              className="font-mono text-left"
            />
            <Input
              label="اسم المستودع (GitHub Repo)"
              placeholder="educenter-erp"
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              dir="ltr"
              className="font-mono text-left"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoCheck}
              onChange={(e) => setAutoCheck(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span>فحص التحديثات تلقائياً عند فتح البرنامج</span>
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button type="submit" variant="outline" size="sm" isLoading={savingRepo} className="gap-1.5">
              <Github className="h-3.5 w-3.5" />
              <span>حفظ ربط GitHub</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant={updateStatus?.state === 'DOWNLOADED' ? 'success' : 'primary'}
              disabled={isCheckingOrDownloading}
              onClick={() => void handlePrimaryUpdateAction()}
              className="gap-1.5"
            >
              {isCheckingOrDownloading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : updateStatus?.state === 'DOWNLOADED' ? (
                <RotateCw className="h-3.5 w-3.5" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span>
                {updateStatus?.state === 'DOWNLOADED'
                  ? 'تثبيت التحديث وإعادة التشغيل'
                  : 'فحص وتحديث البرنامج الآن'}
              </span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export interface DesktopUpdateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DesktopUpdateModal({ open, onOpenChange }: DesktopUpdateModalProps) {
  const { isDesktop, updateStatus, checkForUpdates } = useDesktop();
  const checkedOnOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (!open) {
      checkedOnOpenRef.current = false;
      return;
    }
    if (
      isDesktop &&
      !checkedOnOpenRef.current &&
      updateStatus?.isConfigured &&
      updateStatus.state !== 'DOWNLOADED' &&
      updateStatus.state !== 'DOWNLOADING' &&
      updateStatus.state !== 'CHECKING'
    ) {
      checkedOnOpenRef.current = true;
      void checkForUpdates();
    }
  }, [open, isDesktop, updateStatus?.isConfigured, updateStatus?.state, checkForUpdates]);

  if (!isDesktop) return null;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="تحديث البرنامج التلقائي عبر GitHub"
      description="التحقق من وجود إصدار أحدث وتنزيله وتثبيته تلقائياً مع الحفاظ الكامل على بيانات السنتر"
    >
      <DesktopUpdatePanel compact />
    </Modal>
  );
}
