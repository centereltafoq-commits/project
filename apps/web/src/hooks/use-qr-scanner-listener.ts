import * as React from 'react';

export const QR_SCANNER_TEST_CODE = 'EDU:SCANNER-TEST';
const MAX_KEY_GAP_MS = 150;
const HARDWARE_BURST_AVG_MS = 65;

export interface QrScanBurstTelemetry {
  rawCode: string;
  avgKeyIntervalMs: number | null;
  isHardwareBurst: boolean;
  containsArabicChars: boolean;
  detectedAt: string;
}

export interface QrScannerListenerState {
  isWindowFocused: boolean;
  hasHardwareSignal: boolean;
  lastTelemetry: QrScanBurstTelemetry | null;
}

interface UseQrScannerListenerOptions {
  enabled: boolean;
  onScan: (code: string, telemetry: QrScanBurstTelemetry) => void;
  onTelemetry?: (telemetry: QrScanBurstTelemetry) => void;
}

function formatNowTimeLabel(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

/**
 * Listens globally for hardware USB/Bluetooth 2D QR/barcode scanners operating in
 * keyboard-wedge mode (rapid character burst terminated by Enter) while measuring
 * keystroke cadence to verify genuine hardware scanner signals and detect Arabic
 * keyboard layout issues.
 */
export function useQrScannerListener({
  enabled,
  onScan,
  onTelemetry,
}: UseQrScannerListenerOptions): QrScannerListenerState {
  const bufferRef = React.useRef('');
  const intervalsRef = React.useRef<number[]>([]);
  const lastKeyTimeRef = React.useRef(0);
  const onScanRef = React.useRef(onScan);
  const onTelemetryRef = React.useRef(onTelemetry);
  onScanRef.current = onScan;
  onTelemetryRef.current = onTelemetry;

  const [isWindowFocused, setIsWindowFocused] = React.useState<boolean>(() =>
    typeof document !== 'undefined' ? document.hasFocus() : true,
  );
  const [hasHardwareSignal, setHasHardwareSignal] = React.useState(false);
  const [lastTelemetry, setLastTelemetry] = React.useState<QrScanBurstTelemetry | null>(null);

  React.useEffect(() => {
    const syncFocus = () => {
      if (typeof document === 'undefined') return;
      setIsWindowFocused(document.visibilityState === 'visible' && document.hasFocus());
    };

    window.addEventListener('focus', syncFocus);
    window.addEventListener('blur', syncFocus);
    document.addEventListener('visibilitychange', syncFocus);
    return () => {
      window.removeEventListener('focus', syncFocus);
      window.removeEventListener('blur', syncFocus);
      document.removeEventListener('visibilitychange', syncFocus);
    };
  }, []);

  React.useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isDirectScannerInput = target?.getAttribute('data-qr-scanner-input') === 'true';

      // Do not hijack typing inside normal text/number inputs (e.g., CollectPaymentModal)
      if (
        !isDirectScannerInput &&
        (tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          target?.isContentEditable)
      ) {
        return;
      }

      if (event.ctrlKey || event.altKey || event.metaKey) return;

      const now = Date.now();
      const delta = lastKeyTimeRef.current > 0 ? now - lastKeyTimeRef.current : -1;

      if (delta > MAX_KEY_GAP_MS) {
        bufferRef.current = '';
        intervalsRef.current = [];
      }

      if (event.key === 'Enter') {
        const scanned = bufferRef.current.trim();
        const intervals = intervalsRef.current;
        bufferRef.current = '';
        intervalsRef.current = [];
        lastKeyTimeRef.current = 0;

        if (scanned.length >= 3) {
          const avgKeyIntervalMs =
            intervals.length >= 2
              ? Math.round(intervals.reduce((sum, val) => sum + val, 0) / intervals.length)
              : null;
          const isHardwareBurst =
            avgKeyIntervalMs !== null && avgKeyIntervalMs <= HARDWARE_BURST_AVG_MS;
          const containsArabicChars = /[\u0600-\u06FF]/.test(scanned);

          const telemetry: QrScanBurstTelemetry = {
            rawCode: scanned,
            avgKeyIntervalMs,
            isHardwareBurst,
            containsArabicChars,
            detectedAt: formatNowTimeLabel(),
          };

          setLastTelemetry(telemetry);
          if (isHardwareBurst) {
            setHasHardwareSignal(true);
          }
          onTelemetryRef.current?.(telemetry);

          // Dedicated scanner inputs submit via their own form onSubmit handler
          if (!isDirectScannerInput) {
            event.preventDefault();
            onScanRef.current(scanned, telemetry);
          }
        }
        return;
      }

      if (event.key.length === 1) {
        if (delta >= 0 && delta <= MAX_KEY_GAP_MS && bufferRef.current.length > 0) {
          intervalsRef.current.push(delta);
        }
        bufferRef.current += event.key;
        lastKeyTimeRef.current = now;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);

  return {
    isWindowFocused,
    hasHardwareSignal,
    lastTelemetry,
  };
}
