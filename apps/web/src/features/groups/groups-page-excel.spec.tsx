import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PERMISSIONS } from '@edu-center/shared';
import { ToastProvider } from '@/design-system';
import * as authContextModule from '@/features/auth/auth-context';
import { downloadBlobFile } from '@/lib/file-download';
import { GroupsPage } from './groups-page';

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

vi.mock('../grade-levels/use-grade-levels', () => ({
  useGradeLevels: () => ({
    gradeLevels: [{ id: 'gl-1', name: 'الصف الثالث الثانوي', isActive: true, orderIndex: 1 }],
    options: [{ value: 'الصف الثالث الثانوي', label: 'الصف الثالث الثانوي' }],
    data: [{ id: 'gl-1', name: 'الصف الثالث الثانوي', isActive: true, orderIndex: 1 }],
    isLoading: false,
  }),
}));

describe('GroupsPage Excel Import & Export Integration', () => {
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
            <GroupsPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );
  };

  it('hides Excel export & import buttons when user lacks permissions', () => {
    renderPage([PERMISSIONS.GROUPS_VIEW]);
    expect(screen.queryByRole('button', { name: /تصدير Excel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /استيراد من Excel/i })).not.toBeInTheDocument();
  });

  it('triggers filtered Excel export and opens Excel import modal when permitted', async () => {
    renderPage([
      PERMISSIONS.GROUPS_VIEW,
      PERMISSIONS.GROUPS_MANAGE,
      PERMISSIONS.REPORTS_EXPORT,
    ]);

    const exportBtn = screen.getByRole('button', { name: /تصدير Excel/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(downloadBlobFile).toHaveBeenCalledWith(
        '/groups/export',
        expect.stringMatching(/^groups-.*\.xlsx$/),
        expect.objectContaining({
          search: undefined,
          gradeLevel: undefined,
          isActive: undefined,
        }),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    });

    const importBtn = screen.getByRole('button', { name: /استيراد من Excel/i });
    fireEvent.click(importBtn);

    expect(await screen.findByText('استيراد المجموعات الدراسية من Excel')).toBeInTheDocument();
  });
});

