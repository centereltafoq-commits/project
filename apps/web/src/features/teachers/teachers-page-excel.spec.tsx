import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PERMISSIONS } from '@edu-center/shared';
import { ToastProvider } from '@/design-system';
import * as authContextModule from '@/features/auth/auth-context';
import { apiClient } from '@/lib/api-client';
import { downloadBlobFile } from '@/lib/file-download';
import { TeachersPage } from './teachers-page';

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: { data: [], meta: { page: 1, limit: 25, totalItems: 0, totalPages: 1 } },
    }),
    post: vi.fn(),
  },
  extractErrorMessage: (e: unknown) => String(e),
}));

vi.mock('@/lib/file-download', () => ({
  downloadBlobFile: vi.fn().mockResolvedValue(undefined),
}));

describe('TeachersPage Excel Import & Export Integration', () => {
  const useAuthMock = vi.mocked(authContextModule.useAuth);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPage = (permissions: string[]) => {
    useAuthMock.mockReturnValue({
      hasPermission: (perm: string) => permissions.includes(perm),
      user: { id: 'u1', fullName: 'Admin', roleCode: 'OWNER' },
    } as any);

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter>
            <TeachersPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );
  };

  it('hides Excel export & import buttons when user lacks permissions', () => {
    renderPage([PERMISSIONS.TEACHERS_VIEW]);
    expect(screen.queryByRole('button', { name: /تصدير Excel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /استيراد من Excel/i })).not.toBeInTheDocument();
  });

  it('triggers filtered Excel export and opens Excel import modal when permitted', async () => {
    renderPage([
      PERMISSIONS.TEACHERS_VIEW,
      PERMISSIONS.TEACHERS_MANAGE,
      PERMISSIONS.REPORTS_EXPORT,
    ]);

    const exportBtn = screen.getByRole('button', { name: /تصدير Excel/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(downloadBlobFile).toHaveBeenCalledWith(
        '/teachers/export',
        expect.stringMatching(/^teachers-.*\.xlsx$/),
        expect.objectContaining({
          search: undefined,
          employmentStatus: undefined,
          specialization: undefined,
        }),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    });

    const importBtn = screen.getByRole('button', { name: /استيراد من Excel/i });
    fireEvent.click(importBtn);

    expect(await screen.findByText('استيراد بيانات المدرسين من Excel')).toBeInTheDocument();
  });

  it('renders total, active, and inactive teacher summary KPI cards', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        data: [],
        meta: { page: 1, limit: 25, totalItems: 18, totalPages: 1 },
        summary: {
          totalCount: 18,
          activeCount: 15,
          inactiveCount: 3,
        },
      },
    } as any);

    renderPage([PERMISSIONS.TEACHERS_VIEW]);

    const totalCard = screen.getByRole('button', { name: /إجمالي المدرسين/i });
    const activeCard = screen.getByRole('button', { name: /المدرسين النشطين/i });
    const inactiveCard = screen.getByRole('button', { name: /المدرسين غير النشطين/i });

    expect(await within(totalCard).findByText('18')).toBeInTheDocument();
    expect(within(activeCard).getByText('15')).toBeInTheDocument();
    expect(within(inactiveCard).getByText('3')).toBeInTheDocument();
  });
});

