import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PERMISSIONS, StudentStatus } from '@edu-center/shared';
import { ToastProvider } from '@/design-system';
import * as authContextModule from '@/features/auth/auth-context';
import { apiClient } from '@/lib/api-client';
import * as whatsappUtil from '@/lib/whatsapp.util';
import { WhatsappPage } from './whatsapp-page';

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/features/settings/center-settings-context', () => ({
  useCenterSettings: () => ({ settings: { centerName: 'سنتر التفوق التعليمي' } }),
}));

vi.mock('@/features/grade-levels/use-grade-levels', () => ({
  useGradeLevels: () => ({
    gradeLevels: [{ id: 'gl-1', name: 'الأول الثانوي', isActive: true, orderIndex: 1 }],
    options: [{ value: 'الأول الثانوي', label: 'الأول الثانوي' }],
    isLoading: false,
  }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  extractErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

const MOCK_TEMPLATES = [
  {
    id: 'tpl-subscription-reminder',
    title: 'تذكير بسداد الاشتراك الشهري',
    category: 'SUBSCRIPTION',
    content: 'السلام عليكم {اسم_الطالب}، نذكركم بسداد مجموعة {المجموعة} — {اسم_السنتر}.',
    isDefault: true,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  },
];

const MOCK_GROUP = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  groupCode: 'GRP-101',
  name: 'فيزياء السبت أ',
  subject: 'الفيزياء',
  gradeLevel: 'الأول الثانوي',
  primaryTeacherId: 't-1',
  primaryTeacherName: 'أ. كريم',
  activeStudentsCount: 2,
};

const MOCK_STUDENTS = [
  {
    id: 'stu-1',
    studentCode: 'STU-2026-1001',
    fullName: 'أحمد محمود',
    phone: '01011112222',
    guardianPhone: '01012345678',
    gradeLevel: 'الأول الثانوي',
    registrationDate: '2026-10-01',
    status: StudentStatus.ACTIVE,
    notes: null,
    createdAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'stu-2',
    studentCode: 'STU-2026-1002',
    fullName: 'سارة علي',
    phone: '01122223333',
    guardianPhone: '01199887766',
    gradeLevel: 'الأول الثانوي',
    registrationDate: '2026-10-02',
    status: StudentStatus.ACTIVE,
    notes: null,
    createdAt: '2026-10-02T10:00:00.000Z',
  },
];

function renderWhatsappPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MemoryRouter>
          <WhatsappPage />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('WhatsappPage (templates, one-time unsaved messages, single & group send)', () => {
  const apiGetMock = vi.mocked(apiClient.get);
  const apiPatchMock = vi.mocked(apiClient.patch);
  const apiPostMock = vi.mocked(apiClient.post);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authContextModule.useAuth).mockReturnValue({
      user: { id: 'u1', fullName: 'Admin', roleCode: 'OWNER' },
      hasPermission: (p: string) =>
        (
          [
            PERMISSIONS.STUDENTS_VIEW,
            PERMISSIONS.STUDENTS_UPDATE,
            PERMISSIONS.GROUPS_VIEW,
            PERMISSIONS.GROUPS_MANAGE,
          ] as readonly string[]
        ).includes(p),
    } as any);

    apiGetMock.mockImplementation(async (url: string) => {
      if (url === '/whatsapp/templates') {
        return { data: MOCK_TEMPLATES } as any;
      }
      if (url === '/students') {
        return {
          data: {
            data: MOCK_STUDENTS,
            meta: { page: 1, limit: 100, totalItems: 2, totalPages: 1 },
          },
        } as any;
      }
      if (url === '/groups') {
        return {
          data: {
            data: [MOCK_GROUP],
            meta: { page: 1, limit: 100, totalItems: 1, totalPages: 1 },
          },
        } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });
  });

  it('loads default template, supports inline template editing & saving, and launches WhatsApp for a direct phone number', async () => {
    const openSpy = vi
      .spyOn(whatsappUtil, 'openWhatsAppLink')
      .mockResolvedValue({ success: true, openedVia: 'browser-window' });

    apiPatchMock.mockResolvedValueOnce({
      data: {
        ...MOCK_TEMPLATES[0],
        content: 'تذكير محدث للطالب {اسم_الطالب} — {اسم_السنتر}',
      },
    } as any);

    renderWhatsappPage();

    const editor = await screen.findByLabelText('نص الرسالة القابل للتعديل');
    await waitFor(() => {
      expect((editor as HTMLTextAreaElement).value).toContain('نذكركم');
    });

    fireEvent.change(editor, {
      target: { value: 'تذكير محدث للطالب {اسم_الطالب} — {اسم_السنتر}' },
    });

    const saveBtn = await screen.findByRole('button', { name: /حفظ التعديلات/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(apiPatchMock).toHaveBeenCalledWith(
        '/whatsapp/templates/tpl-subscription-reminder',
        { content: 'تذكير محدث للطالب {اسم_الطالب} — {اسم_السنتر}' },
      );
    });

    fireEvent.change(
      screen.getByPlaceholderText(/01012345678/),
      { target: { value: '01012345678' } },
    );
    fireEvent.change(screen.getByPlaceholderText('مثال: أحمد محمد'), {
      target: { value: 'يوسف كريم' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /فتح واتساب وإرسال الرسالة الآن/i }),
    );

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        `https://web.whatsapp.com/send?phone=201012345678&text=${encodeURIComponent(
          'تذكير محدث للطالب يوسف كريم — سنتر التفوق التعليمي',
        )}`,
      );
    });
  });

  it('supports one-time unsaved messages without calling template save endpoints', async () => {
    const openSpy = vi
      .spyOn(whatsappUtil, 'openWhatsAppLink')
      .mockResolvedValue({ success: true, openedVia: 'browser-window' });

    renderWhatsappPage();
    await screen.findByLabelText('نص الرسالة القابل للتعديل');

    fireEvent.click(screen.getByRole('button', { name: /رسالة مرة واحدة \(بدون حفظ\)/i }));
    expect(
      screen.getByText(/وضع الرسالة الفورية — تُكتب للإرسال الآن ولن تُحفظ/i),
    ).toBeInTheDocument();

    const editor = screen.getByLabelText('نص الرسالة القابل للتعديل');
    fireEvent.change(editor, { target: { value: 'رسالة سريعة مرة واحدة فقط' } });
    fireEvent.change(screen.getByPlaceholderText(/01012345678/), {
      target: { value: '01099887766' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /فتح واتساب وإرسال الرسالة الآن/i }),
    );

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        `https://web.whatsapp.com/send?phone=201099887766&text=${encodeURIComponent(
          'رسالة سريعة مرة واحدة فقط',
        )}`,
      );
    });
    expect(apiPostMock).not.toHaveBeenCalled();
    expect(apiPatchMock).not.toHaveBeenCalled();
  });

  it('selects a group and steps through enrolled students with personalized WhatsApp Web links', async () => {
    const openSpy = vi
      .spyOn(whatsappUtil, 'openWhatsAppLink')
      .mockResolvedValue({ success: true, openedVia: 'browser-window' });

    renderWhatsappPage();
    await screen.findByLabelText('نص الرسالة القابل للتعديل');

    fireEvent.click(screen.getByRole('button', { name: /مجموعة معينة/i }));

    const groupCombobox = await screen.findByRole('combobox', { name: /المجموعة المختارة/i });
    await waitFor(() => expect(groupCombobox).not.toBeDisabled());
    fireEvent.click(groupCombobox);
    fireEvent.click(await screen.findByText('فيزياء السبت أ (GRP-101)'));

    await waitFor(() => {
      expect(screen.getAllByText('أحمد محمود').length).toBeGreaterThanOrEqual(1);
    });

    const nextBtn = await screen.findByRole('button', {
      name: /فتح التالي في واتساب \(2\)/i,
    });
    fireEvent.click(nextBtn);

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        `https://web.whatsapp.com/send?phone=201012345678&text=${encodeURIComponent(
          'السلام عليكم أحمد محمود، نذكركم بسداد مجموعة فيزياء السبت أ — سنتر التفوق التعليمي.',
        )}`,
      );
    });

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /فتح التالي في واتساب \(1\)/i }),
      ).toBeInTheDocument();
    });
  });
});
