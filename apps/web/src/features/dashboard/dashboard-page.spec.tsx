import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PERMISSIONS, SystemRole } from '@edu-center/shared';
import * as authContextModule from '@/features/auth/auth-context';
import { apiClient } from '@/lib/api-client';
import { DashboardPage } from './dashboard-page';
import { DashboardSummaryData } from './dashboard.types';

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
  extractErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'خطأ'),
}));

const MOCK_SUMMARY: DashboardSummaryData = {
  yearMonth: '2026-11',
  todayDate: '2026-11-13',
  totalStudents: 120,
  activeStudents: 108,
  teachersCount: 14,
  assistantsCount: 6,
  groupsCount: 24,
  todaySessionsCount: 2,
  todaySessions: [
    {
      id: 'sess-1',
      groupId: 'grp-1',
      groupName: 'فيزياء ثالثة ثانوي - أ',
      subject: 'فيزياء',
      gradeLevel: 'الصف الثالث الثانوي',
      teacherName: 'أ. كريم منصور',
      classroomName: 'القاعة الذهبية',
      roomNumber: 'R-101',
      startTime: '14:00',
      endTime: '16:00',
      status: 'SCHEDULED',
    },
    {
      id: 'sess-2',
      groupId: 'grp-2',
      groupName: 'كيمياء ثانية ثانوي - ب',
      subject: 'كيمياء',
      gradeLevel: 'الصف الثاني الثانوي',
      teacherName: 'أ. سارة فؤاد',
      classroomName: 'القاعة الفضية',
      roomNumber: 'R-102',
      startTime: '16:00',
      endTime: '18:00',
      status: 'COMPLETED',
    },
  ],
  todayAttendance: {
    present: 45,
    absent: 5,
    excused: 2,
  },
  monthlySessionsStats: {
    totalSessions: 96,
    executedSessions: 48,
    scheduledSessions: 48,
    totalBillableSessions: 400,
    totalPaidSessions: 320,
    totalUnpaidSessions: 80,
    collectionRateSessions: 80,
  },
  monthlyPaymentStats: {
    paidStudentsCount: 85,
    unpaidStudentsCount: 23,
    totalBilledStudentsCount: 108,
    paidGroupsCount: 18,
    unpaidGroupsCount: 6,
    totalBilledGroupsCount: 24,
  },
  monthlySessionProgress: {
    totalTrackedEnrollments: 19,
    nearLastTotalCount: 7,
    lastOrCompletedTotalCount: 5,
    inProgressTotalCount: 7,
    notStartedTotalCount: 0,
    tracks: [
      {
        targetSessions: 4,
        totalEnrollments: 19,
        notStartedCount: 0,
        inProgressCount: 7,
        nearLastCount: 7,
        lastOrCompletedCount: 5,
        steps: [
          { stepNumber: 1, label: 'الحصة 1', isNearLast: false, isLast: false, studentsCount: 3 },
          { stepNumber: 2, label: 'الحصة 2', isNearLast: false, isLast: false, studentsCount: 4 },
          { stepNumber: 3, label: 'الحصة 3 (قبل الأخيرة)', isNearLast: true, isLast: false, studentsCount: 7 },
          { stepNumber: 4, label: 'الحصة 4 (الأخيرة)', isNearLast: false, isLast: true, studentsCount: 5 },
        ],
      },
    ],
    students: [
      {
        enrollmentId: 'enr-near-1',
        studentId: 'stu-1',
        studentName: 'أحمد سامي',
        studentCode: 'ST-101',
        studentPhone: '01012345678',
        groupId: 'grp-1',
        groupName: 'فيزياء ثالثة ثانوي - أ',
        groupCode: 'GRP-1',
        subject: 'فيزياء',
        attendedSessions: 3,
        targetSessions: 4,
        stepNumber: 3,
        status: 'NEAR_LAST',
        remainingBalance: 250,
      },
      {
        enrollmentId: 'enr-last-1',
        studentId: 'stu-2',
        studentName: 'نور محمد',
        studentCode: 'ST-102',
        studentPhone: '01099988877',
        groupId: 'grp-1',
        groupName: 'فيزياء ثالثة ثانوي - أ',
        groupCode: 'GRP-1',
        subject: 'فيزياء',
        attendedSessions: 4,
        targetSessions: 4,
        stepNumber: 4,
        status: 'LAST_OR_DONE',
        remainingBalance: 0,
      },
    ],
  },
  totalRevenue: 45000,
  totalCollectedPayments: 36000,
  totalReceivables: 9000,
  totalTeacherDues: 22000,
  totalAssistantDues: 4000,
  totalExpenses: 3000,
  netCenterResult: 16000,
  netCashFlow: 11000,
  totalTeacherPaidOut: 18000,
  totalAssistantPaidOut: 4000,
  classroomsSummary: {
    total: 3,
    availableNow: 1,
    occupiedNow: 1,
    maintenance: 1,
  },
  classroomsLive: [
    {
      id: 'room-1',
      roomNumber: 'R-101',
      name: 'القاعة الذهبية',
      maxCapacity: 45,
      liveState: 'AVAILABLE',
      occupantTitle: null,
    },
    {
      id: 'room-2',
      roomNumber: 'R-102',
      name: 'القاعة الفضية',
      maxCapacity: 35,
      liveState: 'OCCUPIED',
      occupantTitle: 'كيمياء ثانية ثانوي - ب',
    },
    {
      id: 'room-3',
      roomNumber: 'R-103',
      name: 'المعمل',
      maxCapacity: 25,
      liveState: 'MAINTENANCE',
      occupantTitle: null,
    },
  ],
};

describe('DashboardPage Bento Executive UX', () => {
  const useAuthMock = vi.mocked(authContextModule.useAuth);

  const setupAuth = (perms: string[]) => {
    useAuthMock.mockReturnValue({
      user: {
        id: 'u1',
        fullName: 'مدير السنتر',
        email: 'admin@educenter.com',
        roleCode: SystemRole.OWNER,
        roleNameAr: 'المالك',
        permissions: perms,
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: (p: string) => perms.includes(p),
      hasAnyPermission: (...ps: string[]) => ps.some((p) => perms.includes(p)),
    } as any);
  };

  const renderPage = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: MOCK_SUMMARY } as any);
  });

  it('renders session-billing & teacher dues Hero KPIs prominently alongside Bento operations workspace', async () => {
    setupAuth([
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.FINANCE_VIEW,
      PERMISSIONS.CLASSROOMS_VIEW,
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.GROUPS_VIEW,
      PERMISSIONS.STUDENTS_VIEW,
      PERMISSIONS.REPORTS_VIEW,
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('الطلاب اللي دفعت')).toBeInTheDocument();
    });

    expect(screen.getByText('الطلاب اللي مدفعتش')).toBeInTheDocument();
    expect(screen.getByText('المجموعات اللي دفعت')).toBeInTheDocument();
    expect(screen.getByText('المجموعات اللي مدفعتش')).toBeInTheDocument();

    // Paid/unpaid student & group counts & teacher dues appear clearly at top
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('23')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('22,000 ج.م')).toBeInTheDocument();

    expect(screen.queryByText('وصول سريع:')).not.toBeInTheDocument();

    // Bento Today Sessions table renders both sessions
    expect(screen.getByRole('link', { name: 'فيزياء ثالثة ثانوي - أ' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'كيمياء ثانية ثانوي - ب' })).toBeInTheDocument();

    // Live Rooms are visible alongside sessions
    expect(screen.getByText('القاعات اللحظية')).toBeInTheDocument();
    expect(screen.getByText('المعمل')).toBeInTheDocument();

    // Organized Near-Last-Session Tracker renders step breakdown for 4-session cycle
    expect(screen.getByText(/متابعة الحصص والاقتراب من الحصة الأخيرة/i)).toBeInTheDocument();
    expect(screen.getByText('نظام 4 حصص بالشهر')).toBeInTheDocument();
    expect(screen.getByText('الحصة 3')).toBeInTheDocument();
    expect(screen.getByText('الحصة 4')).toBeInTheDocument();

    // Clicking the 3rd-session step expands only students in 3rd session
    fireEvent.click(screen.getByRole('button', { name: /الحصة 3/i }));
    expect(screen.getByText('أحمد سامي')).toBeInTheDocument();
    expect(screen.queryByText('نور محمد')).not.toBeInTheDocument();
  });

  it('filters today sessions by status pill and search input, and filters live rooms', async () => {
    setupAuth([
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.GROUPS_VIEW,
      PERMISSIONS.CLASSROOMS_VIEW,
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'فيزياء ثالثة ثانوي - أ' })).toBeInTheDocument();
    });

    // Click "منفذة" status filter in Today Sessions
    const completedButtons = screen.getAllByRole('button', { name: /منفذة/i });
    fireEvent.click(completedButtons[0]);

    expect(screen.queryByRole('link', { name: 'فيزياء ثالثة ثانوي - أ' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'كيمياء ثانية ثانوي - ب' })).toBeInTheDocument();

    // Reset to All and filter by search
    fireEvent.click(screen.getAllByRole('button', { name: /الكل/i })[0]);
    const searchInput = screen.getByPlaceholderText('بحث بالمجموعة أو المدرس...');
    fireEvent.change(searchInput, { target: { value: 'كريم' } });

    expect(screen.getByRole('link', { name: 'فيزياء ثالثة ثانوي - أ' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'كيمياء ثانية ثانوي - ب' })).not.toBeInTheDocument();

    // Filter live rooms by "صيانة"
    const maintenanceButtons = screen.getAllByRole('button', { name: /صيانة/i });
    fireEvent.click(maintenanceButtons[0]);

    expect(screen.getByText('المعمل')).toBeInTheDocument();
    expect(screen.queryByText('القاعة الذهبية')).not.toBeInTheDocument();
  });

  it('switches to Financial Equation tab and Academic tab cleanly with RBAC', async () => {
    setupAuth([
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.FINANCE_VIEW,
      PERMISSIONS.STUDENTS_VIEW,
      PERMISSIONS.TEACHERS_VIEW,
      PERMISSIONS.ASSISTANTS_VIEW,
      PERMISSIONS.GROUPS_VIEW,
      PERMISSIONS.REPORTS_VIEW,
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('التحليل المالي للشهر')).toBeInTheDocument();
    });

    // Activate Financial Tab
    const financeTab = screen.getByRole('tab', { name: /التحليل المالي للشهر/i });
    fireEvent.mouseDown(financeTab, { button: 0 });
    fireEvent.click(financeTab);

    await waitFor(() => {
      expect(screen.getByText('الجانب الدائن: الإيرادات والتحصيل')).toBeInTheDocument();
      expect(screen.getByText('الجانب المدين: الالتزامات والمصروفات')).toBeInTheDocument();
    });

    // Activate Academic Tab
    const academicTab = screen.getByRole('tab', { name: /المؤشرات الأكاديمية والكوادر/i });
    fireEvent.mouseDown(academicTab, { button: 0 });
    fireEvent.click(academicTab);

    await waitFor(() => {
      expect(screen.getByText('الطلاب المسجلون')).toBeInTheDocument();
      expect(screen.getByText('تحليل التزام الحضور والغياب اليوم')).toBeInTheDocument();
    });
  });

  it('hides financial tab, teacher dues & paid/unpaid session cards when lacking FINANCE_VIEW', async () => {
    setupAuth([
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.STUDENTS_VIEW,
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('الطلاب النشطون بالسنتر')).toBeInTheDocument();
    });

    expect(screen.queryByText('الطلاب اللي دفعت')).not.toBeInTheDocument();
    expect(screen.queryByText('المجموعات اللي دفعت')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /التحليل المالي للشهر/i })).not.toBeInTheDocument();
  });

  it('allows 1-click group attendance completion for SCHEDULED today sessions when authorized', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { sessionId: 'sess-1', status: 'COMPLETED' } } as any);

    setupAuth([
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.ATTENDANCE_VIEW,
      PERMISSIONS.ATTENDANCE_RECORD,
      PERMISSIONS.GROUPS_VIEW,
    ]);

    renderPage();

    const completeButtons = await screen.findAllByRole('button', { name: /تحضير المجموعة/i });
    expect(completeButtons).toHaveLength(1);

    fireEvent.click(completeButtons[0]);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/attendance/sessions/sess-1/complete-group');
    });
  });
});
