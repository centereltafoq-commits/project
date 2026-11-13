import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PERMISSIONS } from '@edu-center/shared';
import { ToastProvider } from '@/design-system';
import * as authContextModule from '@/features/auth/auth-context';
import { downloadBlobFile } from '@/lib/file-download';
import { StudentsPage } from './students-page';

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

const MOCK_GRADE_LEVELS = {
  gradeLevels: [],
  options: [{ value: 'الأول الثانوي', label: 'الأول الثانوي' }],
  isLoading: false,
};

vi.mock('../grade-levels/use-grade-levels', () => ({
  useGradeLevels: () => MOCK_GRADE_LEVELS,
}));

describe('StudentsPage Excel Import & Export Integration', () => {
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
            <StudentsPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );
  };

  it('hides Excel export & import buttons when user lacks permissions', () => {
    renderPage([PERMISSIONS.STUDENTS_VIEW]);
    expect(screen.queryByRole('button', { name: /تصدير Excel/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /استيراد من Excel/i })).not.toBeInTheDocument();
  });

  it('triggers filtered Excel export and opens Excel import modal when permitted', async () => {
    renderPage([
      PERMISSIONS.STUDENTS_VIEW,
      PERMISSIONS.STUDENTS_CREATE,
      PERMISSIONS.REPORTS_EXPORT,
    ]);

    const exportBtn = screen.getByRole('button', { name: /تصدير Excel/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(downloadBlobFile).toHaveBeenCalledWith(
        '/students/export',
        expect.stringMatching(/^students-.*\.xlsx$/),
        expect.objectContaining({
          search: undefined,
          status: undefined,
          gradeLevel: undefined,
        }),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    });

    const importBtn = screen.getByRole('button', { name: /استيراد من Excel/i });
    fireEvent.click(importBtn);

    expect(await screen.findByText('استيراد بيانات الطلاب من Excel')).toBeInTheDocument();
  });
});
