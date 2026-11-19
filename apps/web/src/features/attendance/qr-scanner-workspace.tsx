import * as React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  FileDown,
  QrCode,
  Radio,
  Search,
  ShieldAlert,
  Usb,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import { Badge, Button, Card, Input, useToast } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { StudentQrPdfModal } from '@/features/students/components/student-qr-pdf-modal';
import { CollectPaymentModal } from '@/features/finance/modals/collect-payment-modal';
import { ReceiptPrintModal } from '@/features/finance/modals/receipt-print-modal';
import { PaymentRow } from '@/features/finance/finance.types';
import {
  QR_SCANNER_TEST_CODE,
  useQrScannerListener,
} from '@/hooks/use-qr-scanner-listener';
import { useQrSerialScanner } from '@/hooks/use-qr-serial-scanner';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { getTodayIsoDate } from '@/lib/formatters';
import {
  playQrBlockedAlarmSound,
  playQrErrorTone,
  playQrSuccessBeep,
} from '@/lib/qr-sound-effects.util';
import {
  QrCheckInResponse,
  QrLookupResponse,
  QrTodaySessionCandidate,
} from './qr-attendance.types';
import { QrScannerStatusDialog } from './qr-scanner-status-dialog';
import { QrStudentPaymentPanel } from './qr-student-payment-panel';

interface RecentScanEntry {
  id: string;
  scannedAt: string;
  studentName: string;
  studentCode: string;
  status: 'BLOCKED' | 'CHECKED_IN' | 'CLEARED';
  note: string;
}

export function QrScannerWorkspace() {
  const { hasPermission } = useAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const canRecordAttendance = hasPermission(PERMISSIONS.ATTENDANCE_RECORD);
  const canCollectPayment = hasPermission(PERMISSIONS.FINANCE_COLLECT_PAYMENT);

  const [scanInput, setScanInput] = React.useState('');
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [autoCheckIn, setAutoCheckIn] = React.useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = React.useState(false);
  const [qrPdfModalOpen, setQrPdfModalOpen] = React.useState(false);
  const [verifiedByTestCode, setVerifiedByTestCode] = React.useState(false);
  const [lookupData, setLookupData] = React.useState<QrLookupResponse | null>(null);
  const [lookupError, setLookupError] = React.useState<string | null>(null);
  const [recentScans, setRecentScans] = React.useState<RecentScanEntry[]>([]);

  const [collectOpen, setCollectOpen] = React.useState(false);
  const [collectTarget, setCollectTarget] = React.useState<{
    yearMonth: string;
    remaining: number;
  } | null>(null);
  const [activeReceipt, setActiveReceipt] = React.useState<PaymentRow | null>(null);

  const inputRef = React.useRef<HTMLInputElement | null>(null);

  const appendScanLog = React.useCallback((entry: Omit<RecentScanEntry, 'id' | 'scannedAt'>) => {
    const now = new Date();
    const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    setRecentScans((prev) => [
      { id: `${Date.now()}-${Math.random()}`, scannedAt: timeLabel, ...entry },
      ...prev.slice(0, 7),
    ]);
  }, []);

  const checkInMutation = useMutation({
    mutationFn: async (params: {
      studentId: string;
      candidate: QrTodaySessionCandidate;
      todayDate: string;
    }) => {
      const { studentId, candidate, todayDate } = params;
      const payload = candidate.sessionId
        ? {
            studentId,
            sessionId: candidate.sessionId,
            sessionDate: todayDate,
          }
        : {
            studentId,
            groupId: candidate.groupId,
            sessionDate: todayDate,
            startTime: candidate.startTime,
            endTime: candidate.endTime,
          };
      const res = await apiClient.post<QrCheckInResponse>('/attendance/qr/check-in', payload);
      return res.data;
    },
    onSuccess: (res, variables) => {
      if (soundEnabled) {
        playQrSuccessBeep();
      }
      notify(
        res.alreadyCheckedIn
          ? `${res.studentName} تم تسجيل حضوره مسبقاً في ${res.groupName}`
          : `تم تسجيل حضور ${res.studentName} في ${res.groupName} بنجاح`,
        'success',
      );
      appendScanLog({
        studentName: res.studentName,
        studentCode: lookupData?.student.studentCode ?? '',
        status: 'CHECKED_IN',
        note: res.alreadyCheckedIn
          ? `مسجل مسبقاً — ${res.groupName}`
          : `تم تسجيل الحضور — ${res.groupName}`,
      });
      setLookupData((prev) =>
        prev && prev.student.id === variables.studentId
          ? {
              ...prev,
              todaySessions: prev.todaySessions.map((s) =>
                s.groupId === res.groupId
                  ? { ...s, sessionId: res.sessionId, attendanceStatus: 'PRESENT', isVirtualSlot: false }
                  : s,
              ),
            }
          : prev,
      );
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['student-profile'] });
    },
    onError: (err) => {
      if (soundEnabled) {
        playQrBlockedAlarmSound();
      }
      notify(extractErrorMessage(err), 'error');
    },
  });

  const lookupMutation = useMutation({
    mutationFn: async (code: string) => {
      const todayDate = getTodayIsoDate();
      const res = await apiClient.get<QrLookupResponse>('/attendance/qr/lookup', {
        params: { code: code.trim(), sessionDate: todayDate },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setLookupError(null);
      setLookupData(data);

      if (data.paymentGate.isBlocked) {
        if (soundEnabled) {
          playQrBlockedAlarmSound();
        }
        appendScanLog({
          studentName: data.student.fullName,
          studentCode: data.student.studentCode,
          status: 'BLOCKED',
          note: `ممنوع الحضور — ${data.paymentGate.unpaidMonthsCount} شهر غير مسدد`,
        });
        return;
      }

      const pendingSessions = data.todaySessions.filter(
        (s) => s.attendanceStatus !== 'PRESENT',
      );

      if (autoCheckIn && canRecordAttendance && pendingSessions.length === 1) {
        checkInMutation.mutate({
          studentId: data.student.id,
          candidate: pendingSessions[0]!,
          todayDate: data.todayDate,
        });
        return;
      }

      if (soundEnabled) {
        playQrSuccessBeep();
      }
      appendScanLog({
        studentName: data.student.fullName,
        studentCode: data.student.studentCode,
        status: 'CLEARED',
        note: 'خالص المستحقات — بانتظار تأكيد الحصة',
      });
    },
    onError: (err) => {
      const msg = extractErrorMessage(err);
      setLookupData(null);
      setLookupError(msg);
      if (soundEnabled) {
        playQrErrorTone();
      }
    },
  });

  const handleScanCode = React.useCallback(
    (code: string) => {
      const cleaned = code.trim();
      if (!cleaned) return;
      if (cleaned.toUpperCase() === QR_SCANNER_TEST_CODE) {
        setVerifiedByTestCode(true);
        setScanInput('');
        if (soundEnabled) {
          playQrSuccessBeep();
        }
        notify('تم اختبار السكانر والتأكد من ربطه بنجاح!', 'success');
        return;
      }
      setScanInput(cleaned);
      lookupMutation.mutate(cleaned);
    },
    [lookupMutation, notify, soundEnabled],
  );

  const listenerEnabled = !collectOpen && !activeReceipt && !qrPdfModalOpen;

  // Hardware USB/Bluetooth QR scanner listener + live signal verification
  const listenerState = useQrScannerListener({
    enabled: listenerEnabled,
    onScan: handleScanCode,
    onTelemetry: (telemetry) => {
      if (telemetry.containsArabicChars) {
        notify(
          'تم التقاط قراءة بحروف عربية! حوّل لغة لوحة المفاتيح إلى English (Alt+Shift).',
          'error',
        );
      }
      if (telemetry.rawCode.toUpperCase() === QR_SCANNER_TEST_CODE) {
        setVerifiedByTestCode(true);
      }
    },
  });

  // Optional direct USB Serial / COM Port listener (Chrome / Edge)
  const serial = useQrSerialScanner({
    enabled: listenerEnabled,
    onScan: handleScanCode,
    onDisconnected: () => {
      if (soundEnabled) {
        playQrErrorTone();
      }
      notify('تنبيه: تم فصل كابل السكانر (USB Serial) عن الجهاز', 'error');
    },
  });

  const isScannerVerified =
    serial.isConnected || listenerState.hasHardwareSignal || verifiedByTestCode;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanInput.trim()) return;
    handleScanCode(scanInput);
  };

  return (
    <div className="space-y-5">
      {/* شريط المسح الذكي وخيارات الريسبشن */}
      <Card className="border-primary/30 bg-gradient-to-l from-primary/[0.04] via-card to-card p-5">
        <div className="flex flex-col gap-3.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <QrCode className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-black text-foreground">
                  بوابة الريسبشن الذكية — مسح QR الحضور
                </h2>
                <button
                  type="button"
                  onClick={() => setStatusDialogOpen(true)}
                  className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40"
                  title="اضغط لفحص حالة توصيل السكانر واختباره"
                >
                  {serial.isConnected ? (
                    <Badge variant="success" className="cursor-pointer gap-1">
                      <Usb className="h-3 w-3" />
                      USB Serial متصل
                    </Badge>
                  ) : !listenerState.isWindowFocused ? (
                    <Badge variant="danger" className="cursor-pointer gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      اضغط لتفعيل نافذة المسح
                    </Badge>
                  ) : isScannerVerified ? (
                    <Badge variant="success" className="cursor-pointer gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      الاسكانر متصل ومؤكد
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="cursor-pointer gap-1">
                      <Radio className="h-3 w-3" />
                      بانتظار اختبار السكانر
                    </Badge>
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                مرّر كارت الطالب لعرض حالة السداد فوراً وإطلاق إنذار مع قفل الحضور عند وجود متأخرات.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setQrPdfModalOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl border border-primary/35 bg-primary/10 px-3 text-xs font-bold text-primary transition-colors hover:bg-primary/15"
            >
              <FileDown className="h-3.5 w-3.5" />
              طباعة كروت QR (PDF)
            </button>

            <button
              type="button"
              onClick={() => setStatusDialogOpen(true)}
              className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-xs font-bold transition-colors ${
                isScannerVerified
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-800 hover:bg-amber-500/15 dark:text-amber-300'
              }`}
            >
              <Usb className="h-3.5 w-3.5" />
              فحص وربط السكانر
            </button>

            <button
              type="button"
              onClick={() => setSoundEnabled((v) => !v)}
              className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-xs font-bold transition-colors ${
                soundEnabled
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'border-border bg-muted text-muted-foreground'
              }`}
            >
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              {soundEnabled ? 'الإنذار مفعل' : 'الإنذار مكتوم'}
            </button>

            {canRecordAttendance && (
              <button
                type="button"
                onClick={() => setAutoCheckIn((v) => !v)}
                className={`inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-xs font-bold transition-colors ${
                  autoCheckIn
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                تحضير تلقائي: {autoCheckIn ? 'مفعل' : 'متوقف'}
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleManualSubmit} className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              placeholder="امسح كارت الطالب بجهاز الـ QR Scanner أو اكتب الكود واضغط Enter..."
              data-qr-scanner-input="true"
              className="h-11 font-mono text-sm placeholder:font-sans placeholder:text-xs sm:placeholder:text-sm"
              autoFocus
            />
          </div>
          <Button
            type="submit"
            size="lg"
            isLoading={lookupMutation.isPending}
            className="h-11 gap-2 px-6 font-black"
          >
            <Search className="h-4 w-4" />
            كشف وفحص الطالب
          </Button>
        </form>
      </Card>

      {lookupError && (
        <Card className="border-rose-500/40 bg-rose-500/10 p-4 text-sm font-bold text-rose-700 dark:text-rose-300">
          {lookupError}
        </Card>
      )}

      {lookupData ? (
        <QrStudentPaymentPanel
          lookup={lookupData}
          canCollectPayment={canCollectPayment}
          canRecordAttendance={canRecordAttendance}
          isCheckingIn={checkInMutation.isPending}
          onCollectOverdue={(yearMonth, remaining) => {
            setCollectTarget({ yearMonth, remaining });
            setCollectOpen(true);
          }}
          onCheckIn={(candidate) =>
            checkInMutation.mutate({
              studentId: lookupData.student.id,
              candidate,
              todayDate: lookupData.todayDate,
            })
          }
        />
      ) : (
        <Card className="border-dashed p-10 text-center text-muted-foreground">
          <QrCode className="mx-auto mb-3 h-12 w-12 opacity-30" />
          <p className="text-sm font-bold text-foreground">
            في انتظار مسح كارت QR الطالب...
          </p>
          <p className="mt-1 text-xs">
            سيظهر هنا فوراً اسم الطالب، شهور الدفع والمتأخرات، وأزرار الحضور مع تطبيق نظام الحظر والإنذار لغير المسددين.
          </p>
        </Card>
      )}

      {recentScans.length > 0 && (
        <Card className="p-4">
          <h4 className="mb-3 text-xs font-black text-muted-foreground">
            سجل المسح الأخير بالريسبشن (هذه الجلسة)
          </h4>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {recentScans.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-foreground">{entry.studentName}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{entry.note}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  {entry.status === 'BLOCKED' ? (
                    <Badge variant="danger" className="gap-0.5 text-[10px]">
                      <ShieldAlert className="h-3 w-3" />
                      محظور
                    </Badge>
                  ) : entry.status === 'CHECKED_IN' ? (
                    <Badge variant="success" className="gap-0.5 text-[10px]">
                      <CheckCircle2 className="h-3 w-3" />
                      حضر
                    </Badge>
                  ) : (
                    <Badge variant="info" className="text-[10px]">خالص</Badge>
                  )}
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {entry.scannedAt}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {lookupData && collectTarget && (
        <CollectPaymentModal
          open={collectOpen}
          onOpenChange={setCollectOpen}
          yearMonth={collectTarget.yearMonth}
          presetStudent={{
            id: lookupData.student.id,
            fullName: lookupData.student.fullName,
            studentCode: lookupData.student.studentCode,
            remainingBalance: collectTarget.remaining,
          }}
          onReceiptCreated={(receipt) => {
            setActiveReceipt(receipt);
            // Immediately refresh student QR status after payment so gate unlocks!
            lookupMutation.mutate(lookupData.student.studentCode);
          }}
        />
      )}

      <ReceiptPrintModal
        receipt={activeReceipt}
        onClose={() => setActiveReceipt(null)}
      />

      <QrScannerStatusDialog
        open={statusDialogOpen}
        onOpenChange={setStatusDialogOpen}
        listenerState={listenerState}
        serial={serial}
        verifiedByTestCode={verifiedByTestCode}
        onTestCodeScanned={handleScanCode}
      />

      {qrPdfModalOpen && (
        <StudentQrPdfModal open={qrPdfModalOpen} onOpenChange={setQrPdfModalOpen} />
      )}
    </div>
  );
}
