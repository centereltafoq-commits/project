import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  EnrollmentStatus,
  FullMonthAbsencePolicy,
  GroupRevenueSplitMethod,
  PERMISSIONS,
} from '@edu-center/shared';
import { ToastProvider } from '@/design-system';
import * as authContextModule from '@/features/auth/auth-context';
import { apiClient } from '@/lib/api-client';
import { GroupEnrollmentsSection } from './group-enrollments-section';
import { GroupDetailData } from './groups.types';

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
  },
  extractErrorMessage: (e: unknown) => String(e),
}));

vi.mock('./subscribe-student-modal', () => ({
  SubscribeStudentModal: () => null,
}));

vi.mock('@/components/excel-import-modal', () => ({
  ExcelImportModal: () => null,
}));

const sampleGroup: GroupDetailData = {
  id: 'grp-1',
  groupCode: 'GRP-4101',
  name: 'فيزياء تالتة ثانوي',
  subject: 'الفيزياء',
  gradeLevel: 'الثالث الثانوي',
  primaryTeacherId: 'tch-1',
  primaryTeacherName: 'أ. محمد',
  defaultClassroomId: 'cls-1',
  defaultClassroomName: 'قاعة 1',
  monthlySessionsCount: 4,
  monthlyPrice: '400',
  calculatedSessionPrice: '100',
  scheduleSlots: [],
  maxStudents: 30,
  isActive: true,
  notes: null,
  activeStudentsCount: 3,
  revenueSplitMethod: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
  teacherSharePerStudent: '300',
  centerSharePerStudent: '100',
  teacherPercentage: '75',
  fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
  chargeExcusedAbsence: false,
  financialPolicy: null,
  teachers: [],
  assistants: [],
};

const sampleEnrollments = [
  {
    id: 'enr-1',
    studentId: 'stu-1',
    studentCode: 'STU-5001',
    studentName: 'أحمد علي',
    studentPhone: '01011111111',
    guardianPhone: '01022222222',
    gradeLevel: 'الثالث الثانوي',
    groupId: 'grp-1',
    startDate: '2026-11-01',
    endDate: null,
    agreedMonthlyPrice: '400',
    agreedSessionsCount: 4,
    agreedSessionPrice: '100',
    status: EnrollmentStatus.ACTIVE,
    notes: null,
    monthSummary: {
      yearMonth: '2026-11',
      paymentStatus: 'PAID' as const,
      totalDue: 400,
      totalPaid: 400,
      remaining: 0,
      totalSessions: 4,
      presentCount: 3,
      absentCount: 1,
      excusedCount: 0,
      isClosed: false,
    },
  },
  {
    id: 'enr-2',
    studentId: 'stu-2',
    studentCode: 'STU-5002',
    studentName: 'سارة حسن',
    studentPhone: '01033333333',
    guardianPhone: '01044444444',
    gradeLevel: 'الثالث الثانوي',
    groupId: 'grp-1',
    startDate: '2026-11-01',
    endDate: null,
    agreedMonthlyPrice: '400',
    agreedSessionsCount: 4,
    agreedSessionPrice: '100',
    status: EnrollmentStatus.ACTIVE,
    notes: null,
    monthSummary: {
      yearMonth: '2026-11',
      paymentStatus: 'PARTIAL' as const,
      totalDue: 400,
      totalPaid: 200,
      remaining: 200,
      totalSessions: 4,
      presentCount: 2,
      absentCount: 1,
      excusedCount: 1,
      isClosed: false,
    },
  },
  {
    id: 'enr-3',
    studentId: 'stu-3',
    studentCode: 'STU-5003',
    studentName: 'كريم محمود',
    studentPhone: '01055555555',
    guardianPhone: '01066666666',
    gradeLevel: 'الثالث الثانوي',
    groupId: 'grp-1',
    startDate: '2026-11-01',
    endDate: null,
    agreedMonthlyPrice: '400',
    agreedSessionsCount: 4,
    agreedSessionPrice: '100',
    status: EnrollmentStatus.ACTIVE,
    notes: null,
    monthSummary: {
      yearMonth: '2026-11',
      paymentStatus: 'UNPAID' as const,
      totalDue: 400,
      totalPaid: 0,
      remaining: 400,
      totalSessions: 4,
      presentCount: 4,
      absentCount: 0,
      excusedCount: 0,
      isClosed: false,
    },
  },
];

function renderSection() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <GroupEnrollmentsSection group={sampleGroup} />
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('GroupEnrollmentsSection', () => {
  const useAuthMock = vi.mocked(authContextModule.useAuth);
  const apiGetMock = vi.mocked(apiClient.get);

  beforeEach(() => {
    vi.clearAllMocks();
    apiGetMock.mockResolvedValue({
      data: {
        data: sampleEnrollments,
        meta: { page: 1, limit: 25, totalItems: 3, totalPages: 1 },
      },
    } as any);
  });

  it('displays monthly attendance pills, payment badges, quick summary pills, and refetches on MonthPicker change', async () => {
    useAuthMock.mockReturnValue({
      hasPermission: (perm: string) =>
        perm === PERMISSIONS.FINANCE_VIEW || perm === PERMISSIONS.ENROLLMENTS_MANAGE,
    } as any);

    renderSection();

    await waitFor(() => {
      expect(screen.getByText('أحمد علي')).toBeInTheDocument();
    });

    // Quick summary counts above table
    expect(screen.getByText('مدفوع: 1')).toBeInTheDocument();
    expect(screen.getByText('جزئي: 1')).toBeInTheDocument();
    expect(screen.getByText('غير مسدد: 1')).toBeInTheDocument();

    // Per-row payment statuses & numbers
    expect(screen.getByText('مدفوع')).toBeInTheDocument();
    expect(screen.getByText('سُدد 400 ج.م')).toBeInTheDocument();
    expect(screen.getByText('سداد جزئي')).toBeInTheDocument();
    expect(screen.getByText('دفع 200 ج.م • متبقي 200 ج.م')).toBeInTheDocument();
    expect(screen.getByText('غير مسدد')).toBeInTheDocument();
    expect(screen.getByText('مطلوب 400 ج.م')).toBeInTheDocument();

    // Attendance summary counters
    expect(screen.getByText('3 حاضر')).toBeInTheDocument();
    expect(screen.getByText('1 عذر')).toBeInTheDocument();

    // Change selected month via MonthPicker
    const pickerTrigger = screen.getByRole('button', { name: /نوفمبر|يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|ديسمبر/ });
    fireEvent.click(pickerTrigger);
    const octOption = await screen.findByRole('button', { name: 'أكتوبر (10)' });
    fireEvent.click(octOption);

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(
        '/groups/grp-1/enrollments',
        expect.objectContaining({
          params: expect.objectContaining({ yearMonth: expect.stringMatching(/^\d{4}-10$/) }),
        }),
      );
    });
  });

  it('hides payment column and summary counts when lacking FINANCE_VIEW while preserving attendance', async () => {
    useAuthMock.mockReturnValue({
      hasPermission: (perm: string) => perm === PERMISSIONS.ENROLLMENTS_VIEW,
    } as any);

    renderSection();

    await waitFor(() => {
      expect(screen.getByText('أحمد علي')).toBeInTheDocument();
    });

    expect(screen.getByText('3 حاضر')).toBeInTheDocument();
    expect(screen.queryByText('مدفوع: 1')).not.toBeInTheDocument();
    expect(screen.queryByText('سداد جزئي')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /استيراد \/ نقل Excel/i })).not.toBeInTheDocument();
  });

  it('renders bulk subscribe, Excel import/transfer, and export actions when authorized', async () => {
    useAuthMock.mockReturnValue({
      hasPermission: (perm: string) =>
        perm === PERMISSIONS.ENROLLMENTS_VIEW ||
        perm === PERMISSIONS.ENROLLMENTS_MANAGE ||
        perm === PERMISSIONS.REPORTS_EXPORT,
    } as any);

    renderSection();

    await waitFor(() => {
      expect(screen.getByText('أحمد علي')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /تسجيل اشتراك طلاب/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /استيراد \/ نقل Excel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /تصدير Excel/i })).toBeInTheDocument();
  });
});
