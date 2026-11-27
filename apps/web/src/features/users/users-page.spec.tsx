import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PERMISSIONS, SystemRole } from '@edu-center/shared';
import * as authContextModule from '@/features/auth/auth-context';
import { apiClient } from '@/lib/api-client';
import { ToastProvider } from '@/design-system';
import { UsersPage } from './users-page';

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
  extractErrorMessage: (err: unknown) => (err instanceof Error ? err.message : 'خطأ'),
}));

describe('UsersPage - Phone-Based Accounts UI', () => {
  const useAuthMock = vi.mocked(authContextModule.useAuth);

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({
      user: {
        id: 'owner-1',
        fullName: 'مدير السنتر',
        phone: '01000000001',
        roleCode: SystemRole.OWNER,
        roleNameAr: 'المالك',
        permissions: [PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_MANAGE, PERMISSIONS.ROLES_MANAGE],
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      hasPermission: () => true,
      hasAnyPermission: () => true,
    } as any);

    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url === '/roles') {
        return { data: [{ id: 'role-1', code: SystemRole.ACCOUNTANT, nameAr: 'محاسب' }] } as any;
      }
      if (url === '/users') {
        return {
          data: {
            data: [
              {
                id: 'u-1',
                fullName: 'أ. هاني المحاسب',
                email: null,
                phone: '01000000003',
                roleId: 'role-1',
                roleCode: SystemRole.ACCOUNTANT,
                roleNameAr: 'محاسب',
                isActive: true,
                lastLoginAt: null,
                createdAt: '2026-11-01T10:00:00Z',
              },
            ],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        } as any;
      }
      return { data: [] } as any;
    });
  });

  const renderPage = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <UsersPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );
  };

  it('displays phone numbers instead of email and opens Create User modal with phone field only', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('أ. هاني المحاسب')).toBeInTheDocument();
      expect(screen.getByText('01000000003')).toBeInTheDocument();
    });

    expect(screen.queryByText('البريد والهاتف')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /إضافة مستخدم جديد/i }));

    await waitFor(() => {
      expect(screen.getByText(/رقم الهاتف \(للدخول\)/i)).toBeInTheDocument();
    });
    expect(screen.queryByLabelText(/البريد الإلكتروني/i)).not.toBeInTheDocument();
  });
});
