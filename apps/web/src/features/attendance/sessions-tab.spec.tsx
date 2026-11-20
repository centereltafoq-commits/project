import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PERMISSIONS, SessionStatus, SystemRole } from '@edu-center/shared';
import { ToastProvider } from '@/design-system';
import * as authContextModule from '@/features/auth/auth-context';
import { apiClient } from '@/lib/api-client';
import { SessionsTab } from './sessions-tab';
import { SessionRow } from './attendance.types';

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/features/settings/center-settings-context', () => ({
  useCenterSettings: () => ({
    settings: {
      centerName: 'سنتر الأمل',
    },
  }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
  extractErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'خطأ'),
}));

const MOCK_SESSIONS: SessionRow[] = [
  {
    id: 'ses-completed-1',
    groupId: 'grp-1',
    groupName: 'فيزياء ثالثة ثانوي - الأولى',
    groupCode: 'GRP-101',
    subject: 'الفيزياء',
    teacherId: 'tch-1',
    teacherName: 'أ. أحمد نبيل',
    classroomId: 'cls-1',
    classroomName: 'قاعة النور',
    roomNumber: 'R-101',
    sessionDate: '2026-11-05',
    yearMonth: '2026-11',
    startTime: '16:00',
    endTime: '18:00',
    status: SessionStatus.COMPLETED,
    topic: null,
    notes: null,
    presentCount: 0,
    recordedCount: 0,
    enrolledCount: 12,
    monthlySessionsCount: 4,
    completedSessionsInMonth: 2,
    sessionSequenceInMonth: 1,
  },
  {
    id: 'ses-completed-extra',
    groupId: 'grp-1',
    groupName: 'فيزياء ثالثة ثانوي - الأولى',
    groupCode: 'GRP-101',
    subject: 'الفيزياء',
    teacherId: 'tch-1',
    teacherName: 'أ. أحمد نبيل',
    classroomId: 'cls-1',
    classroomName: 'قاعة النور',
    roomNumber: 'R-101',
    sessionDate: '2026-11-26',
    yearMonth: '2026-11',
    startTime: '16:00',
    endTime: '18:00',
    status: SessionStatus.COMPLETED,
    topic: null,
    notes: null,
    presentCount: 8,
    recordedCount: 12,
    enrolledCount: 12,
    monthlySessionsCount: 4,
    completedSessionsInMonth: 5,
    sessionSequenceInMonth: 5,
  },
  {
    id: 'ses-scheduled-3',
    groupId: 'grp-1',
    groupName: 'فيزياء ثالثة ثانوي - الأولى',
    groupCode: 'GRP-101',
    subject: 'الفيزياء',
    teacherId: 'tch-1',
    teacherName: 'أ. أحمد نبيل',
    classroomId: 'cls-1',
    classroomName: 'قاعة النور',
    roomNumber: 'R-101',
    sessionDate: '2026-11-12',
    yearMonth: '2026-11',
    startTime: '16:00',
    endTime: '18:00',
    status: SessionStatus.SCHEDULED,
    topic: null,
    notes: null,
    presentCount: 0,
    recordedCount: 0,
    enrolledCount: 12,
    monthlySessionsCount: 4,
    completedSessionsInMonth: 2,
    sessionSequenceInMonth: null,
  },
];

function renderSessionsTab() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SessionsTab />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('SessionsTab (group subscription session counter vs individual student sheet)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authContextModule.useAuth).mockReturnValue({
      user: {
        id: 'usr-1',
        email: 'admin@center.com',
        fullName: 'المدير',
        roleCode: SystemRole.OWNER,
        permissions: [PERMISSIONS.ATTENDANCE_VIEW, PERMISSIONS.ATTENDANCE_RECORD],
      },
      isAuthenticated: true,
      isLoading: false,
      hasPermission: () => true,
      login: vi.fn(),
      logout: vi.fn(),
    } as any);

    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        data: MOCK_SESSIONS,
        meta: { page: 1, limit: 20, total: MOCK_SESSIONS.length, totalPages: 1 },
      },
    } as any);
  });

  it('displays subscription sequence badges separately from individual student attendance and shows complete button only for SCHEDULED sessions', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        id: 'ses-scheduled-3',
        status: SessionStatus.COMPLETED,
        sessionSequenceInMonth: 3,
        completedSessionsInMonth: 3,
        monthlySessionsCount: 4,
        isExtraSession: false,
      },
    } as any);

    renderSessionsTab();

    expect(await screen.findByText('الحصة 1 من 4')).toBeInTheDocument();
    expect(screen.getByText('حصة الاشتراك')).toBeInTheDocument();
    expect(screen.getByText('كشف الطلاب')).toBeInTheDocument();
    expect(screen.getByText('الحصة 5 من 4 (إضافية)')).toBeInTheDocument();
    expect(screen.getByText('المنفذ: 2 من 4')).toBeInTheDocument();

    expect(screen.getByText('حضور 8 من 12')).toBeInTheDocument();
    expect(screen.getAllByText('لم يُرصد (0 من 12)')).toHaveLength(2);

    const completeButtons = screen.getAllByRole('button', { name: /تحضير المجموعة/i });
    expect(completeButtons).toHaveLength(1);

    fireEvent.click(completeButtons[0]);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/attendance/sessions/ses-scheduled-3/complete-group');
    });

    expect(
      await screen.findByText(/تم تحضير المجموعة بنجاح \(الحصة 3 من 4 في الاشتراك\)/),
    ).toBeInTheDocument();
  });
});
