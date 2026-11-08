import * as React from 'react';
import {
  Server,
  Laptop,
  Wifi,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Copy,
  Check,
  Radio,
} from 'lucide-react';
import { Button, Input, Modal, Badge } from '@/design-system';
import { cn } from '@/lib/cn';
import { useDesktop } from '@/hooks/use-desktop';

export interface DesktopConnectionModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  connectionFailed?: boolean;
}

export function DesktopConnectionModal({
  open: propOpen,
  onOpenChange,
  connectionFailed = false,
}: DesktopConnectionModalProps) {
  const {
    isDesktop,
    config,
    serverStatus,
    localIps,
    saveConfig,
    testConnection,
    startServer,
  } = useDesktop();

  const [internalOpen, setInternalOpen] = React.useState(false);
  const [mode, setMode] = React.useState<'server' | 'client'>('server');
  const [clientUrl, setClientUrl] = React.useState('http://192.168.1.100:4000');
  const [pingStatus, setPingStatus] = React.useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [pingMessage, setPingMessage] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [copiedIp, setCopiedIp] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (config?.serverMode) {
      setMode(config.serverMode);
    }
    if (config?.serverUrl) {
      setClientUrl(config.serverUrl);
    }
  }, [config]);

  React.useEffect(() => {
    if (isDesktop && (config?.isFirstLaunch || connectionFailed)) {
      setInternalOpen(true);
    }
  }, [isDesktop, config?.isFirstLaunch, connectionFailed]);

  if (!isDesktop) {
    return null;
  }

  const isOpen = propOpen !== undefined ? propOpen : internalOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedIp(text);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  const handleTestPing = async () => {
    if (!clientUrl.trim()) {
      setPingStatus('error');
      setPingMessage('يرجى إدخال عنوان السيرفر أولاً.');
      return;
    }
    setPingStatus('testing');
    setPingMessage('');
    try {
      const res = await testConnection(clientUrl.trim());
      if (res.ok) {
        setPingStatus('success');
        setPingMessage('تم الاتصال بالسيرفر بنجاح! استجابة السيرفر سليمة.');
      } else {
        setPingStatus('error');
        setPingMessage(res.error || 'تعذر الاتصال بالسيرفر. يرجى التحقق من تشغيل السيرفر وعنوان الشبكة.');
      }
    } catch (e: any) {
      setPingStatus('error');
      setPingMessage(e.message || 'حدث خطأ أثناء فحص الاتصال.');
    }
  };

  const handleConfirmServer = async () => {
    setIsSaving(true);
    try {
      await startServer();
      await saveConfig({
        serverMode: 'server',
        serverUrl: 'http://localhost:4000',
        isFirstLaunch: false,
      });
      handleOpenChange(false);
    } catch (err: any) {
      console.error('Failed to start server mode:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmClient = async () => {
    setIsSaving(true);
    try {
      await saveConfig({
        serverMode: 'client',
        serverUrl: clientUrl.trim() || 'http://localhost:4000',
        isFirstLaunch: false,
      });
      handleOpenChange(false);
    } catch (err: any) {
      console.error('Failed to save client mode:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={isOpen}
      onOpenChange={handleOpenChange}
      title="إعداد اتصال السنتر والشبكة المحلية (LAN)"
      description="تحديد دور هذا الجهاز في السنتر (سيرفر رئيسي أو محطة استقبال متصلة بالشبكة)"
      size="lg"
    >
      <div className="space-y-6 pt-2">
        {/* Connection Failure Notice if triggered by error */}
        {connectionFailed && (
          <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>
              تعذر الاتصال بسيرفر السنتر الحالي. يمكنك إعادة ضبط إعدادات الاتصال أو تشغيل هذا الجهاز كسيرفر رئيسي.
            </span>
          </div>
        )}

        {/* Mode Selector Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Server Mode Option */}
          <button
            type="button"
            onClick={() => setMode('server')}
            className={cn(
              'flex flex-col items-start rounded-xl border-2 p-4 text-right transition-all',
              mode === 'server'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30',
            )}
          >
            <div className="mb-2 flex w-full items-center justify-between">
              <div className={cn('rounded-lg p-2', mode === 'server' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                <Server className="h-5 w-5" />
              </div>
              <Radio className={cn('h-4 w-4', mode === 'server' ? 'text-primary' : 'text-muted-foreground/30')} />
            </div>
            <h4 className="font-bold text-sm text-foreground">تشغيل هذا الجهاز كسيرفر رئيسي للسنتر</h4>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              يتم تخزين قاعدة البيانات وتشغيل الخادم على هذا الجهاز، مع مشاركة الشبكة مع باقي أجهزة السنتر.
            </p>
          </button>

          {/* Client Mode Option */}
          <button
            type="button"
            onClick={() => setMode('client')}
            className={cn(
              'flex flex-col items-start rounded-xl border-2 p-4 text-right transition-all',
              mode === 'client'
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30',
            )}
          >
            <div className="mb-2 flex w-full items-center justify-between">
              <div className={cn('rounded-lg p-2', mode === 'client' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                <Laptop className="h-5 w-5" />
              </div>
              <Radio className={cn('h-4 w-4', mode === 'client' ? 'text-primary' : 'text-muted-foreground/30')} />
            </div>
            <h4 className="font-bold text-sm text-foreground">الاتصال بسيرفر السنتر</h4>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              محطة استقبال أو كاشير إضافية تتصل بالسيرفر الرئيسي الموجود على جهاز آخر في السنتر.
            </p>
          </button>
        </div>

        {/* Details based on mode */}
        {mode === 'server' ? (
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">حالة السيرفر والشبكة المحلية (LAN)</span>
              </div>
              <Badge variant={serverStatus?.running ? 'success' : 'neutral'} className="text-[11px]">
                {serverStatus?.running ? 'السيرفر يعمل حالياً' : 'جاهز للتشغيل'}
              </Badge>
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-semibold text-muted-foreground">
                عناوين IP الخاصة بهذا الجهاز على الشبكة المحلية:
              </span>
              {localIps.length > 0 ? (
                <div className="space-y-2">
                  {localIps.map((ip) => {
                    const fullUrl = `http://${ip}:4000`;
                    return (
                      <div
                        key={ip}
                        className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs"
                      >
                        <span className="font-mono text-foreground font-semibold" dir="ltr">
                          {fullUrl}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 px-2 text-xs"
                          onClick={() => handleCopy(fullUrl)}
                        >
                          {copiedIp === fullUrl ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                              <span className="text-emerald-500">تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>نسخ الرابط</span>
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                  <p className="text-[11px] text-muted-foreground">
                    💡 شارك هذا العنوان مع أجهزة الاستقبال والكاشير لتتمكن من الاتصال بهذا السيرفر عبر الشبكة.
                  </p>
                </div>
              ) : (
                <p className="rounded-lg bg-card p-3 text-xs text-muted-foreground border border-border">
                  جاري فحص عناوين IP المحلية... (تأكد من اتصال الجهاز بشبكة الواي فاي أو الراوتر).
                </p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={handleConfirmServer}
                disabled={isSaving}
                className="gap-2"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>تأكيد والبدء كسيرفر رئيسي</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="client-server-url"
                className="block text-xs font-semibold text-foreground"
              >
                عنوان سيرفر السنتر الرئيسي (Server URL)
              </label>
              <div className="flex gap-2">
                <Input
                  id="client-server-url"
                  aria-label="عنوان سيرفر السنتر الرئيسي"
                  value={clientUrl}
                  onChange={(e) => {
                    setClientUrl(e.target.value);
                    setPingStatus('idle');
                  }}
                  placeholder="http://192.168.1.15:4000"
                  dir="ltr"
                  className="font-mono text-left flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestPing}
                  disabled={pingStatus === 'testing'}
                  className="shrink-0 gap-1.5"
                >
                  {pingStatus === 'testing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Wifi className="h-4 w-4" />
                  )}
                  <span>فحص الاتصال</span>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                أدخل عنوان IP السيرفر الرئيسي مع المنفذ 4000 (مثال: http://192.168.1.15:4000)
              </p>
            </div>

            {/* Ping Feedback */}
            {pingStatus === 'success' && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{pingMessage}</span>
              </div>
            )}
            {pingStatus === 'error' && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{pingMessage}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                onClick={handleConfirmClient}
                disabled={isSaving}
                className="gap-2"
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>حفظ ومتابعة</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
