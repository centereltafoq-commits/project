import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StudentStatus } from '@edu-center/shared';
import { ToastProvider } from '@/design-system';
import { apiClient } from '@/lib/api-client';
import { generateStudentsQrPdf } from '@/lib/pdf/student-qr-pdf.generator';
import { StudentQrPdfModal } from './student-qr-pdf-modal';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
  extractErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

vi.mock('@/features/grade-levels/use-grade-levels', () => ({
  useGradeLevels: () => ({
    gradeLevels: [
      { id: 'gl-1', name: 'الأول الثانوي', isActive: true, orderIndex: 1 },
      { id: 'gl-2', name: 'الثاني الثانوي', isActive: true, orderIndex: 2 },
    ],
    options: [
      { value: 'الأول الثانوي', label: 'الأول الثانوي' },
      { value: 'الثاني الثانوي', label: 'الثاني الثانوي' },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/lib/pdf/student-qr-pdf.generator', async () => {
  const actual = await vi.importActual<typeof import('@/lib/pdf/student-qr-pdf.generator')>(
    '@/lib/pdf/student-qr-pdf.generator',
  );
  return {
    ...actual,
    generateStudentsQrPdf: vi.fn().mockResolvedValue({
      totalPages: 1,
      fileName: 'student-qr-codes-GRP-101-2026-11-20.pdf',
    }),
  };
});

const GROUP_1 = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  groupCode: 'GRP-101',
  name: 'فيزياء السبت أ',
  subject: 'الفيزياء',
  gradeLevel: 'الأول الثانوي',
  activeStudentsCount: 2,
};

const GROUP_2 = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  groupCode: 'GRP-202',
  name: 'رياضيات الأحد ب',
  subject: 'الرياضيات',
  gradeLevel: 'الثاني الثانوي',
  activeStudentsCount: 1,
};

const GROUP_1_STUDENTS = [
  {
    id: 'stu-1',
    studentCode: 'STU-2026-1001',
    fullName: 'أحمد محمود',
    phone: null,
    guardianPhone: null,
    gradeLevel: 'الأول الثانوي',
    registrationDate: '2026-10-01',
    status: StudentStatus.ACTIVE,
    notes: null,
    createdAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'stu-2',
    studentCode: 'STU-2026-1002',
    fullName: 'سلمى عادل',
    phone: null,
    guardianPhone: null,
    gradeLevel: 'الأول الثانوي',
    registrationDate: '2026-10-02',
    status: StudentStatus.ACTIVE,
    notes: null,
    createdAt: '2026-10-02T10:00:00.000Z',
  },
];

function renderModal(props: Partial<React.ComponentProps<typeof StudentQrPdfModal>> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <StudentQrPdfModal open={true} onOpenChange={vi.fn()} {...props} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('StudentQrPdfModal (group-based QR card printing)', () => {
  const apiGetMock = vi.mocked(apiClient.get);
  const generatePdfMock = vi.mocked(generateStudentsQrPdf);

  beforeEach(() => {
    vi.clearAllMocks();
    apiGetMock.mockImplementation(async (url: string, config?: any) => {
      if (url === '/groups') {
        return {
          data: {
            data: [GROUP_1, GROUP_2],
            meta: { page: 1, limit: 100, totalItems: 2, totalPages: 1 },
          },
        } as any;
      }
      if (url === '/students') {
        expect(config?.params?.groupId).toBe(GROUP_1.id);
        return {
          data: {
            data: GROUP_1_STUDENTS,
            meta: { page: 1, limit: 100, totalItems: 2, totalPages: 1 },
          },
        } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });
  });

  it('loads groups, waits for a group selection before fetching students, and disables PDF export', async () => {
    renderModal();

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/groups', {
        params: { page: 1, limit: 100, isActive: 'true' },
      });
    });

    expect(apiGetMock).not.toHaveBeenCalledWith('/students', expect.anything());
    expect(screen.getByText('يرجى اختيار مجموعة معينة أولاً')).toBeInTheDocument();

    const generateBtn = screen.getByRole('button', { name: /توليد وتحميل PDF/i });
    expect(generateBtn).toBeDisabled();
  });

  it('filters groups by grade level and clears an incompatible selected group', async () => {
    renderModal({ initialGroupId: GROUP_1.id });

    await waitFor(() => {
      expect(screen.getByText('أحمد محمود')).toBeInTheDocument();
    });

    const gradeCombobox = screen.getByRole('combobox', { name: /تصفية حسب الصف الدراسي/i });
    fireEvent.click(gradeCombobox);
    fireEvent.click(await screen.findByText('الثاني الثانوي'));

    await waitFor(() => {
      expect(screen.getByText('يرجى اختيار مجموعة معينة أولاً')).toBeInTheDocument();
    });

    const groupCombobox = screen.getByRole('combobox', { name: /المجموعة/i });
    fireEvent.click(groupCombobox);

    expect(await screen.findByText('رياضيات الأحد ب (GRP-202)')).toBeInTheDocument();
    expect(screen.queryByText('فيزياء السبت أ (GRP-101)')).not.toBeInTheDocument();
  });

  it('fetches students for the selected group, toggles activeOnly, and generates group-tagged PDF', async () => {
    renderModal();

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/groups', expect.anything());
    });

    const groupCombobox = screen.getByRole('combobox', { name: /المجموعة/i });
    await waitFor(() => expect(groupCombobox).not.toBeDisabled());
    fireEvent.click(groupCombobox);
    fireEvent.click(await screen.findByText('فيزياء السبت أ (GRP-101)'));

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/students', {
        params: {
          page: 1,
          limit: 100,
          groupId: GROUP_1.id,
          status: StudentStatus.ACTIVE,
        },
      });
    });

    expect(await screen.findByText('أحمد محمود')).toBeInTheDocument();
    expect(screen.getByText('سلمى عادل')).toBeInTheDocument();

    const activeCheckbox = screen.getByLabelText('الطلاب النشطين فقط');
    fireEvent.click(activeCheckbox);

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith('/students', {
        params: {
          page: 1,
          limit: 100,
          groupId: GROUP_1.id,
          status: undefined,
        },
      });
    });

    const generateBtn = await screen.findByRole('button', {
      name: /توليد وتحميل PDF \(2\)/i,
    });
    expect(generateBtn).not.toBeDisabled();
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(generatePdfMock).toHaveBeenCalledWith(
        expect.objectContaining({
          preset: 'compact-20',
          title: 'STUDENT QR PASS CARDS',
          subtitle: 'Group: GRP-101',
          filename: expect.stringMatching(/^student-qr-codes-GRP-101-\d{4}-\d{2}-\d{2}\.pdf$/),
          students: [
            expect.objectContaining({ id: 'stu-1', studentCode: 'STU-2026-1001', fullName: 'أحمد محمود' }),
            expect.objectContaining({ id: 'stu-2', studentCode: 'STU-2026-1002', fullName: 'سلمى عادل' }),
          ],
        }),
      );
    });
  });
});
