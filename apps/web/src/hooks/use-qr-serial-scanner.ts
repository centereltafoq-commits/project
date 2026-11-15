import * as React from 'react';

interface SerialPortInfoLike {
  usbVendorId?: number;
  usbProductId?: number;
}

interface SerialPortLike {
  readable: ReadableStream<Uint8Array> | null;
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  getInfo?: () => SerialPortInfoLike;
}

interface NavigatorSerialLike {
  requestPort: () => Promise<SerialPortLike>;
  getPorts: () => Promise<SerialPortLike[]>;
  addEventListener: (type: 'connect' | 'disconnect', listener: (event: Event) => void) => void;
  removeEventListener: (type: 'connect' | 'disconnect', listener: (event: Event) => void) => void;
}

export type SerialConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export interface QrSerialScannerController {
  isSupported: boolean;
  status: SerialConnectionStatus;
  isConnected: boolean;
  deviceLabel: string | null;
  errorMessage: string | null;
  lastSerialScanAt: string | null;
  connect: (baudRate?: number) => Promise<void>;
  disconnect: () => Promise<void>;
}

interface UseQrSerialScannerOptions {
  enabled: boolean;
  onScan: (code: string) => void;
  onDisconnected?: () => void;
}

function getNavigatorSerial(): NavigatorSerialLike | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & { serial?: NavigatorSerialLike };
  return nav.serial ?? null;
}

function formatPortLabel(port: SerialPortLike): string {
  const info = port.getInfo?.();
  if (info?.usbVendorId !== undefined && info?.usbProductId !== undefined) {
    const vid = info.usbVendorId.toString(16).toUpperCase().padStart(4, '0');
    const pid = info.usbProductId.toString(16).toUpperCase().padStart(4, '0');
    return `USB Serial (VID:${vid} / PID:${pid})`;
  }
  return 'جهاز USB Serial متصل';
}

function formatNowTimeLabel(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

/**
 * Optional direct hardware connection via Chromium's Web Serial API for QR scanners
 * configured in USB Virtual COM / Serial mode. Provides OS-level plug/unplug detection.
 */
export function useQrSerialScanner({
  enabled,
  onScan,
  onDisconnected,
}: UseQrSerialScannerOptions): QrSerialScannerController {
  const isSupported = Boolean(getNavigatorSerial());

  const [status, setStatus] = React.useState<SerialConnectionStatus>('DISCONNECTED');
  const [deviceLabel, setDeviceLabel] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [lastSerialScanAt, setLastSerialScanAt] = React.useState<string | null>(null);

  const portRef = React.useRef<SerialPortLike | null>(null);
  const readerRef = React.useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const keepReadingRef = React.useRef(false);

  const onScanRef = React.useRef(onScan);
  const onDisconnectedRef = React.useRef(onDisconnected);
  onScanRef.current = onScan;
  onDisconnectedRef.current = onDisconnected;

  const stopReadingAndClose = React.useCallback(async () => {
    keepReadingRef.current = false;
    const activeReader = readerRef.current;
    readerRef.current = null;
    if (activeReader) {
      try {
        await activeReader.cancel();
      } catch {
        // Ignore stream cancellation error if port already unplugged
      }
      try {
        activeReader.releaseLock();
      } catch {
        // Ignore lock release error
      }
    }
    const activePort = portRef.current;
    portRef.current = null;
    if (activePort) {
      try {
        await activePort.close();
      } catch {
        // Ignore close error on already-closed port
      }
    }
  }, []);

  const openPortAndRead = React.useCallback(
    async (port: SerialPortLike, baudRate = 9600) => {
      await stopReadingAndClose();

      setStatus('CONNECTING');
      setErrorMessage(null);

      try {
        await port.open({ baudRate });
      } catch (err) {
        const msg =
          err instanceof Error && err.message.includes('already open')
            ? null
            : err instanceof Error
              ? err.message
              : 'تعذر فتح منفذ السكانر';
        if (msg) {
          setStatus('ERROR');
          setErrorMessage(msg);
          return;
        }
      }

      if (!port.readable) {
        setStatus('ERROR');
        setErrorMessage('المنفذ المحدد لا يدعم استقبال البيانات');
        return;
      }

      portRef.current = port;
      setDeviceLabel(formatPortLabel(port));
      setStatus('CONNECTED');
      keepReadingRef.current = true;

      const decoder = new TextDecoder();
      let lineBuffer = '';
      const reader = port.readable.getReader();
      readerRef.current = reader;

      void (async () => {
        try {
          while (keepReadingRef.current) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!value) continue;

            lineBuffer += decoder.decode(value, { stream: true });
            const lines = lineBuffer.split(/\r\n|\n|\r/);
            lineBuffer = lines.pop() ?? '';

            for (const rawLine of lines) {
              const code = rawLine.trim();
              if (code.length >= 3) {
                setLastSerialScanAt(formatNowTimeLabel());
                if (enabled) {
                  onScanRef.current(code);
                }
              }
            }
          }
        } catch {
          if (keepReadingRef.current) {
            setStatus('DISCONNECTED');
            setDeviceLabel(null);
            setErrorMessage('انقطع الاتصال بجهاز الـ USB Serial');
            onDisconnectedRef.current?.();
          }
        }
      })();
    },
    [enabled, stopReadingAndClose],
  );

  const connect = React.useCallback(
    async (baudRate = 9600) => {
      const serial = getNavigatorSerial();
      if (!serial) {
        setStatus('ERROR');
        setErrorMessage('متصفحك الحالي لا يدعم Web Serial. استخدم Google Chrome أو Microsoft Edge.');
        return;
      }

      try {
        const port = await serial.requestPort();
        await openPortAndRead(port, baudRate);
      } catch (err) {
        // User cancelled port picker — keep current status cleanly
        if (err instanceof DOMException && err.name === 'NotFoundError') {
          return;
        }
        setStatus('ERROR');
        setErrorMessage(err instanceof Error ? err.message : 'فشل اختيار منفذ السكانر');
      }
    },
    [openPortAndRead],
  );

  const disconnect = React.useCallback(async () => {
    await stopReadingAndClose();
    setStatus('DISCONNECTED');
    setDeviceLabel(null);
    setErrorMessage(null);
  }, [stopReadingAndClose]);

  // Listen for physical USB cable disconnect and auto-reconnect previously paired ports
  React.useEffect(() => {
    const serial = getNavigatorSerial();
    if (!serial) return;

    const handleSerialDisconnect = (event: Event) => {
      const targetPort: unknown = event.target;
      if (portRef.current && (!targetPort || targetPort === portRef.current)) {
        void stopReadingAndClose().then(() => {
          setStatus('DISCONNECTED');
          setDeviceLabel(null);
          setErrorMessage('تم فصل كابل السكانر (USB) من الجهاز');
          onDisconnectedRef.current?.();
        });
      }
    };

    serial.addEventListener('disconnect', handleSerialDisconnect);

    void serial
      .getPorts()
      .then((ports) => {
        if (ports.length === 1 && !portRef.current) {
          return openPortAndRead(ports[0]!, 9600);
        }
      })
      .catch(() => {
        // Ignore background auto-reconnect failure
      });

    return () => {
      serial.removeEventListener('disconnect', handleSerialDisconnect);
      void stopReadingAndClose();
    };
  }, [openPortAndRead, stopReadingAndClose]);

  return {
    isSupported,
    status,
    isConnected: status === 'CONNECTED',
    deviceLabel,
    errorMessage,
    lastSerialScanAt,
    connect,
    disconnect,
  };
}
