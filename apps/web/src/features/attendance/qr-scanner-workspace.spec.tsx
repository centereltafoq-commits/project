import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PERMISSIONS, SystemRole } from '@edu-center/shared';
import * as authContextModule from '@/features/auth/auth-context';
import * as soundModule from '@/lib/qr-sound-effects.util';
import { apiClient } from '@/lib/api-client';
import { ToastProvider } from '@/design-system';
import { QrScannerWorkspace } from './qr-scanner-workspace';

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/features/settings/center-settings-context', () => ({
  useCenterSettings: () => ({ settings: { centerName: 'سنتر الاختبار' } }),
}));

vi.mock('@/lib/qr-sound-effects.util', () => ({
  playQrBlockedAlarmSound: vi.fn(),
  playQrSuccessBeep: vi.fn(),
  playQrErrorTone: vi.fn(),
}));

vi.mock('@/lib/qr-code.util', () => ({
  generateQrDataUrl: vi.fn().mockResolvedValue('data:image/png;base64,TEST'),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
  extractErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'خطأ'),
}));

describe('QrScannerWorkspace (Reception QR Scanner & Payment Lock)', () => {
  const renderWorkspace = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <QrScannerWorkspace />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    vi.mocked(authContextModule.useAuth).mockReturnValue({
      user: { id: 'u1', fullName: 'أسستنت', roleCode: SystemRole.MANAGER },
      hasPermission: (p: string) =>
        (
          [
            PERMISSIONS.ATTENDANCE_VIEW,
            PERMISSIONS.ATTENDANCE_RECORD,
            PERMISSIONS.FINANCE_VIEW,
            PERMISSIONS.FINANCE_COLLECT_PAYMENT,
          ] as readonly string[]
        ).includes(p),
      hasAnyPermission: () => true,
    } as any);
  });

  it('triggers red warning banner, alarm sound, and locks attendance check-in when student has unpaid dues', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        todayDate: '2026-11-14',
        canSeeAmounts: true,
        student: {
          id: 'stu-1',
          studentCode: 'STU-2026-0001',
          fullName: 'يوسف أحمد',
          phone: '010111',
          guardianPhone: '010222',
          gradeLevel: 'الثالث الثانوي',
          status: 'ACTIVE',
          registrationDate: '2026-09-01',
        },
        paymentGate: {
          isBlocked: true,
          totalRemaining: 300,
          unpaidMonthsCount: 1,
          unpaidMonths: [
            {
              yearMonth: '2026-11',
              paymentStatus: 'UNPAID',
              totalDue: 300,
              totalPaid: 0,
              remaining: 300,
            },
          ],
        },
        monthsOverview: [
          {
            yearMonth: '2026-11',
            paymentStatus: 'UNPAID',
            totalSessions: 2,
            presentCount: 2,
            absentCount: 0,
            excusedCount: 0,
            totalDue: 300,
            totalPaid: 0,
            remaining: 300,
            groupsCount: 1,
            paymentsCount: 0,
            isClosed: false,
          },
          {
            yearMonth: '2026-10',
            paymentStatus: 'PAID',
            totalSessions: 4,
            presentCount: 4,
            absentCount: 0,
            excusedCount: 0,
            totalDue: 300,
            totalPaid: 300,
            remaining: 0,
            groupsCount: 1,
            paymentsCount: 1,
            isClosed: true,
          },
        ],
        enrollments: [],
        todaySessions: [
          {
            sessionId: 'sess-1',
            groupId: 'grp-1',
            groupCode: 'G-1',
            groupName: 'فيزياء ثالثة ثانوي',
            subject: 'فيزياء',
            teacherName: 'أ. كريم',
            classroomId: null,
            classroomName: 'القاعة أ',
            roomNumber: 'R-1',
            sessionDate: '2026-11-14',
            startTime: '16:00',
            endTime: '18:00',
            sessionStatus: 'SCHEDULED',
            attendanceStatus: null,
            isVirtualSlot: false,
            isScheduledToday: true,
          },
        ],
      },
    } as any);

    renderWorkspace();

    const input = screen.getByPlaceholderText(/امسح كارت الطالب بجهاز الـ QR Scanner/i);
    fireEvent.change(input, { target: { value: 'EDU:STU-2026-0001' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/إنذار مالي — ممنوع تسجيل الحضور قبل السداد/i)).toBeInTheDocument();
    });

    expect(soundModule.playQrBlockedAlarmSound).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText('يوسف أحمد').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /مقفل \(عليه متأخرات\)/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /تحصيل المستحقات الآن/i })).toBeInTheDocument();
  });

  it('allows immediate attendance check-in when student has zero remaining balance', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        todayDate: '2026-11-14',
        canSeeAmounts: true,
        student: {
          id: 'stu-2',
          studentCode: 'STU-2026-0002',
          fullName: 'مريم خالد',
          phone: null,
          guardianPhone: '010333',
          gradeLevel: 'الثاني الثانوي',
          status: 'ACTIVE',
          registrationDate: '2026-09-01',
        },
        paymentGate: {
          isBlocked: false,
          totalRemaining: 0,
          unpaidMonthsCount: 0,
          unpaidMonths: [],
        },
        monthsOverview: [],
        enrollments: [],
        todaySessions: [
          {
            sessionId: 'sess-2',
            groupId: 'grp-2',
            groupCode: 'G-2',
            groupName: 'كيمياء ثانية ثانوي',
            subject: 'كيمياء',
            teacherName: 'أ. سارة',
            classroomId: null,
            classroomName: 'القاعة ب',
            roomNumber: 'R-2',
            sessionDate: '2026-11-14',
            startTime: '18:00',
            endTime: '20:00',
            sessionStatus: 'SCHEDULED',
            attendanceStatus: null,
            isVirtualSlot: false,
            isScheduledToday: true,
          },
        ],
      },
    } as any);

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        success: true,
        alreadyCheckedIn: false,
        sessionId: 'sess-2',
        groupId: 'grp-2',
        groupName: 'كيمياء ثانية ثانوي',
        sessionDate: '2026-11-14',
        attendanceStatus: 'PRESENT',
        studentName: 'مريم خالد',
      },
    } as any);

    renderWorkspace();

    const input = screen.getByPlaceholderText(/امسح كارت الطالب بجهاز الـ QR Scanner/i);
    fireEvent.change(input, { target: { value: 'STU-2026-0002' } });
    fireEvent.submit(input.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/مسموح بالدخول — الطالب خالص المستحقات/i)).toBeInTheDocument();
    });

    expect(soundModule.playQrSuccessBeep).toHaveBeenCalledTimes(1);
    const checkInBtn = screen.getByRole('button', { name: /تسجيل حضور الآن/i });
    expect(checkInBtn).not.toBeDisabled();

    fireEvent.click(checkInBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/attendance/qr/check-in', {
        studentId: 'stu-2',
        sessionId: 'sess-2',
        sessionDate: '2026-11-14',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('تم تسجيل الحضور')).toBeInTheDocument();
    });
  });

  it('opens scanner connection check dialog and marks scanner verified on EDU:SCANNER-TEST scan', async () => {
    renderWorkspace();

    expect(screen.getByText('بانتظار اختبار السكانر')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /فحص وربط السكانر/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/فحص توصيل جهاز الـ Scanner/i),
      ).toBeInTheDocument();
    });

    const testInput = screen.getByPlaceholderText(/امسح كود الاختبار هنا/i);
    fireEvent.change(testInput, { target: { value: 'EDU:SCANNER-TEST' } });
    fireEvent.submit(testInput.closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('الاسكانر متصل ومؤكد')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /سماع صوت الإنذار/i }));

    expect(apiClient.get).not.toHaveBeenCalled();
    expect(soundModule.playQrSuccessBeep).toHaveBeenCalledTimes(1);
    expect(soundModule.playQrBlockedAlarmSound).toHaveBeenCalledTimes(1);
  });
});
