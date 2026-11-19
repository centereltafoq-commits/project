import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PERMISSIONS, StudentStatus } from '@edu-center/shared';
import * as authContextModule from '@/features/auth/auth-context';
import { apiClient } from '@/lib/api-client';
import { StudentQuickViewModal } from './student-quick-view-modal';

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/features/settings/center-settings-context', () => ({
  useCenterSettings: () => ({
    settings: { currencySymbol: 'ج.م', centerName: 'سنتر النخبة' },
  }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe('StudentQuickViewModal', () => {
  const useAuthMock = vi.mocked(authContextModule.useAuth);

  const sampleStudent = {
    id: 'stu-1',
    studentCode: 'STU-2026-7536',
    fullName: 'محمد عبدالعزيز احمد',
    phone: null,
    guardianPhone: null,
    gradeLevel: 'اولي اعدادي',
    registrationDate: '2026-11-14',
    status: StudentStatus.ACTIVE,
    notes: null,
    activeGroupsCount: 1,
    createdAt: '2026-11-14T10:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      hasPermission: (perm: string) =>
        perm === PERMISSIONS.FINANCE_VIEW || perm === PERMISSIONS.STUDENTS_UPDATE,
    } as any);
  });

  const renderModal = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StudentQuickViewModal
            student={sampleStudent}
            open
            onOpenChange={vi.fn()}
            onEdit={vi.fn()}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  };

  it('automatically loads and shows PAID current month status when remaining is zero', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        yearMonth: '2026-11',
        enrollments: [{ id: 'e1', status: 'ACTIVE' }],
        monthTotals: {
          totalDue: 400,
          totalPaid: 400,
          remaining: 0,
          presentCount: 4,
          absentCount: 0,
          totalSessions: 4,
        },
      },
    } as any);

    renderModal();

    expect(await screen.findByText('تم سداد الشهر الحالي بالكامل')).toBeInTheDocument();
    expect(screen.getByText('مدفوع بالكامل')).toBeInTheDocument();
  });

  it('automatically shows UNPAID current month status when dues are unpaid', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        yearMonth: '2026-11',
        enrollments: [{ id: 'e1', status: 'ACTIVE' }],
        monthTotals: {
          totalDue: 350,
          totalPaid: 0,
          remaining: 350,
          presentCount: 2,
          absentCount: 0,
          totalSessions: 2,
        },
      },
    } as any);

    renderModal();

    expect(await screen.findByText('لم يتم سداد الشهر الحالي بعد')).toBeInTheDocument();
    expect(screen.getByText('غير مدفوع')).toBeInTheDocument();
  });
});
