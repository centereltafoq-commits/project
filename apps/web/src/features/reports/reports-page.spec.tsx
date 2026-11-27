import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PERMISSIONS } from '@edu-center/shared';
import { ToastProvider } from '@/design-system';
import * as authContextModule from '@/features/auth/auth-context';
import { apiClient } from '@/lib/api-client';
import { ReportsPage } from './reports-page';

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: { data: [], meta: { page: 1, limit: 25, totalItems: 0, totalPages: 1 } } }),
  },
  extractErrorMessage: (e: unknown) => String(e),
}));

describe('ReportsPage RBAC & Empty Permission Safety', () => {
  const useAuthMock = vi.mocked(authContextModule.useAuth);

  it('does not crash and renders ForbiddenPage without firing API calls when user has REPORTS_VIEW but zero sub-report permissions', () => {
    const getSpy = vi.mocked(apiClient.get);
    getSpy.mockClear();

    useAuthMock.mockReturnValue({
      hasPermission: (perm: string) => perm === PERMISSIONS.REPORTS_VIEW,
      user: { id: 'u-1', fullName: 'Restricted', roleCode: 'CUSTOM' },
    } as any);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <ReportsPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );

    expect(
      screen.getByText('لا تملك صلاحيات لعرض أي من تقارير النظام. يرجى مراجعة مسؤول النظام.'),
    ).toBeInTheDocument();
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('allows assistant with FINANCE_COLLECT_PAYMENT to access collections & student-statement reports while hiding profit reports', () => {
    const perms = new Set<string>([PERMISSIONS.REPORTS_VIEW, PERMISSIONS.FINANCE_COLLECT_PAYMENT]);
    useAuthMock.mockReturnValue({
      hasPermission: (perm: string) => perms.has(perm),
      user: { id: 'ast-1', fullName: 'Assistant', roleCode: 'ASSISTANT' },
    } as any);

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <ReportsPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('button', { name: /7\. التحصيل والمدفوعات/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3\. كشف حساب الطالب/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /4\. إيرادات المجموعات/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /5\. كشف المدرس/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /9\. التحليل والملخص المالي/i })).not.toBeInTheDocument();
  });
});
