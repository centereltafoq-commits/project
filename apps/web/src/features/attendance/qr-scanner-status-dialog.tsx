import * as React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  QrCode,
  Radio,
  Unplug,
  Usb,
  Volume2,
} from 'lucide-react';
import { Badge, Button, Input, Modal } from '@/design-system';
import {
  QR_SCANNER_TEST_CODE,
  QrScannerListenerState,
} from '@/hooks/use-qr-scanner-listener';
import { QrSerialScannerController } from '@/hooks/use-qr-serial-scanner';
import { generateQrDataUrl } from '@/lib/qr-code.util';
import {
  playQrBlockedAlarmSound,
  playQrSuccessBeep,
} from '@/lib/qr-sound-effects.util';

interface QrScannerStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listenerState: QrScannerListenerState;
  serial: QrSerialScannerController;
  verifiedByTestCode: boolean;
  onTestCodeScanned: (code: string) => void;
}

export function QrScannerStatusDialog({
  open,
  onOpenChange,
  listenerState,
  serial,
  verifiedByTestCode,
  onTestCodeScanned,
}: QrScannerStatusDialogProps) {
  const [testQrUrl, setTestQrUrl] = React.useState<string>('');
  const [testInput, setTestInput] = React.useState('');

  React.useEffect(() => {
    if (!open || testQrUrl) return;
    let cancelled = false;
    void generateQrDataUrl(QR_SCANNER_TEST_CODE)
      .then((url) => {
        if (!cancelled) setTestQrUrl(url);
      })
      .catch(() => {
        // Ignore preview error in non-canvas environments
      });
    return () => {
      cancelled = true;
    };
  }, [open, testQrUrl]);

  const { isWindowFocused, hasHardwareSignal, lastTelemetry } = listenerState;
  const isKeyboardConfirmed = hasHardwareSignal || verifiedByTestCode;
  const isLinked = serial.isConnected || isKeyboardConfirmed;

  const handleTestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = testInput.trim();
    if (!cleaned) return;
    setTestInput('');
    onTestCodeScanned(cleaned);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="فحص توصيل جهاز الـ Scanner"
      description="تأكد من جاهزية السكانر بمسح الكود التالي أو أي كارت طالب."
    >
      <div className="space-y-4">
        {/* 1. حالة التوصيل المختصرة */}
        <div
          className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
            isLinked
              ? 'border-emerald-500/40 bg-emerald-500/10'
              : 'border-amber-500/40 bg-amber-500/10'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {isLinked ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Radio className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            )}
            <div>
              <p className="text-sm font-black text-foreground">
                {serial.isConnected
                  ? 'السكانر متصل عبر USB المباشر'
                  : isKeyboardConfirmed
                    ? 'السكانر متصل ويعمل بنجاح'
                    : 'بانتظار تجربة مسح أول كود'}
              </p>
              <p className="text-xs text-muted-foreground">
                {serial.isConnected
                  ? serial.deviceLabel ?? 'منفذ تسلسلي نشط'
                  : isKeyboardConfirmed
                    ? 'تم استقبال إشارة الجهاز والتأكد من جاهزيته.'
                    : 'مرّر كارت طالب أو امسح كود الاختبار بالأسفل للتأكيد.'}
              </p>
            </div>
          </div>

          <Badge variant={isLinked ? 'success' : 'warning'}>
            {isLinked ? 'متصل' : 'غير مُختبر'}
          </Badge>
        </div>

        {/* تنبيهات سريعة عند الحاجة فقط */}
        {!isWindowFocused && !serial.isConnected && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            اضغط داخل نافذة المتصفح لتفعيل استقبال السكانر.
          </div>
        )}

        {lastTelemetry?.containsArabicChars && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-500/50 bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            لغة الويندوز عربي! حوّل لوحة المفاتيح إلى English (Alt + Shift).
          </div>
        )}

        {/* 2. منطقة المسح التجريبي النظيفة */}
        <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-muted/15 p-4 sm:flex-row">
          <div className="flex shrink-0 flex-col items-center">
            {testQrUrl ? (
              <img
                src={testQrUrl}
                alt="QR Code اختبار السكانر"
                className="h-28 w-28 rounded-xl border border-border bg-white p-1.5 shadow-sm"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-xl border border-dashed border-border bg-background">
                <QrCode className="h-9 w-9 text-muted-foreground" />
              </div>
            )}
            <span className="mt-1.5 font-mono text-[11px] font-bold text-muted-foreground" dir="ltr">
              {QR_SCANNER_TEST_CODE}
            </span>
          </div>

          <div className="w-full flex-1 space-y-3">
            <form onSubmit={handleTestSubmit} className="flex gap-2">
              <Input
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="امسح كود الاختبار هنا..."
                data-qr-scanner-input="true"
                className="h-10 font-mono text-sm placeholder:font-sans placeholder:text-xs"
                autoFocus
              />
              <Button type="submit" size="sm" variant="outline" className="h-10 px-4">
                تأكيد
              </Button>
            </form>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-border/60 bg-background px-3 py-2">
                <span className="block text-[11px] text-muted-foreground">نافذة المسح</span>
                <span className={isWindowFocused ? 'font-bold text-emerald-600' : 'font-bold text-rose-600'}>
                  {isWindowFocused ? 'نشطة وجاهزة' : 'غير نشطة'}
                </span>
              </div>
              <div className="rounded-lg border border-border/60 bg-background px-3 py-2">
                <span className="block text-[11px] text-muted-foreground">آخر قراءة</span>
                <span className="block truncate font-mono font-bold text-foreground" dir="ltr">
                  {lastTelemetry?.rawCode ?? '—'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. تجربة أصوات السماعات */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-background px-3.5 py-2.5">
          <div className="flex items-center gap-2 text-xs">
            <Volume2 className="h-4 w-4 text-primary" />
            <span className="font-bold text-foreground">تجربة الصوت والسماعات</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 border-rose-500/40 text-xs text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
              onClick={() => playQrBlockedAlarmSound()}
            >
              <Volume2 className="h-3.5 w-3.5" />
              سماع صوت الإنذار
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 border-emerald-500/40 text-xs text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
              onClick={() => playQrSuccessBeep()}
            >
              <Volume2 className="h-3.5 w-3.5" />
              سماع صوت القبول
            </Button>
          </div>
        </div>

        {/* 4. ربط USB مباشر (سطر واحد مدمج) */}
        {serial.isSupported && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-background px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-xs">
              <Usb className="h-4 w-4 text-primary" />
              <span className="font-bold text-foreground">توصيل مباشر بمنفذ USB (اختياري)</span>
            </div>
            {serial.isConnected ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 border-rose-500/40 text-xs text-rose-700 hover:bg-rose-500/10"
                onClick={() => void serial.disconnect()}
              >
                <Unplug className="h-3.5 w-3.5" />
                فصل USB
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                isLoading={serial.status === 'CONNECTING'}
                onClick={() => void serial.connect(9600)}
              >
                <Usb className="h-3.5 w-3.5" />
                ربط USB
              </Button>
            )}
          </div>
        )}

        {serial.errorMessage && (
          <p className="text-xs font-bold text-rose-600 dark:text-rose-400">
            {serial.errorMessage}
          </p>
        )}

        <p className="text-center text-[11px] text-muted-foreground">
          يدعم أي سكانر <strong className="text-foreground">2D QR (USB)</strong> مباشرة بدون تعريفات — تأكد أن لغة الكيبورد <strong className="text-foreground">English</strong>.
        </p>
      </div>
    </Modal>
  );
}
