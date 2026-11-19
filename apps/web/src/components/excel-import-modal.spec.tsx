import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '@/design-system';
import { apiClient } from '@/lib/api-client';
import { confirmAction } from '@/lib/alerts';
import { ExcelImportModal } from './excel-import-modal';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
  extractErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

vi.mock('@/lib/alerts', () => ({
  confirmAction: vi.fn(),
}));

describe('ExcelImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (!window.URL.createObjectURL) {
      window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    } else {
      vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    }
    if (!window.URL.revokeObjectURL) {
      window.URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => undefined);
    }
  });

  const renderModal = (onOpenChange = vi.fn()) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ExcelImportModal
            open
            onOpenChange={onOpenChange}
            title="استيراد بيانات الطلاب من Excel"
            entityLabelPlural="الطلاب"
            templateUrl="/students/import/template"
            templateFilename="students-import-template.xlsx"
            previewUrl="/students/import/preview"
            commitUrl="/students/import/commit"
            previewColumns={[
              { key: 'fullName', label: 'اسم الطالب' },
              { key: 'phone', label: 'هاتف الطالب', dir: 'ltr' },
              { key: 'gradeLevel', label: 'الصف الدراسي' },
            ]}
            invalidateQueryKeys={[['students']]}
          />
        </ToastProvider>
      </QueryClientProvider>,
    );
  };

  it('downloads the ready .xlsx template when clicking template download button', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: new Blob(['xlsx']),
      headers: {},
    } as any);

    renderModal();

    const downloadBtn = screen.getByRole('button', { name: /تحميل نموذج Excel الجاهز/i });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/students/import/template',
        expect.objectContaining({ responseType: 'blob' }),
      );
    });
  });

  it('uploads .xlsx file to preview endpoint, renders validation counts & row errors, and commits after confirmation', async () => {
    vi.mocked(apiClient.post)
      .mockResolvedValueOnce({
        data: {
          totalRows: 2,
          validCount: 1,
          skippedCount: 0,
          errorCount: 1,
          warningCount: 0,
          rows: [
            {
              rowNumber: 2,
              status: 'valid',
              data: { fullName: 'أحمد طارق', phone: '01012345678', gradeLevel: 'الأول الثانوي' },
              errors: [],
              warnings: [],
            },
            {
              rowNumber: 3,
              status: 'error',
              data: { fullName: '', phone: '123', gradeLevel: 'غير معروف' },
              errors: ['اسم الطالب مطلوب ويجب ألا يقل عن حرفين'],
              warnings: [],
            },
          ],
        },
      } as any)
      .mockResolvedValueOnce({
        data: {
          importedCount: 1,
          skippedCount: 0,
          failedCount: 1,
        },
      } as any);

    vi.mocked(confirmAction).mockResolvedValue(true);

    const onOpenChange = vi.fn();
    renderModal(onOpenChange);

    const fileInput = screen.getByTestId('excel-import-file-input');
    const file = new File(['PK\x03\x04'], 'students.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/students/import/preview',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
        }),
      );
    });

    expect(await screen.findByText('أحمد طارق')).toBeInTheDocument();
    expect(screen.getByText('اسم الطالب مطلوب ويجب ألا يقل عن حرفين')).toBeInTheDocument();

    // Enable skipInvalidRows toggle when mixed errors exist
    const skipToggle = screen.getByRole('checkbox');
    fireEvent.click(skipToggle);

    const commitBtn = screen.getByRole('button', { name: /تنفيذ الاستيراد/i });
    fireEvent.click(commitBtn);

    await waitFor(() => {
      expect(confirmAction).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/students/import/commit',
        expect.any(FormData),
        expect.objectContaining({
          headers: { 'Content-Type': 'multipart/form-data' },
        }),
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('provides descriptive tooltips explaining both duplicate policy options', () => {
    renderModal();

    const skipBtn = screen.getByRole('button', { name: 'تخطي الأكواد الموجودة' });
    const errBtn = screen.getByRole('button', { name: 'اعتبار المكرر خطأ' });

    expect(skipBtn).toHaveAttribute('title', expect.stringContaining('تجاهل هذا الصف'));
    expect(errBtn).toHaveAttribute('title', expect.stringContaining('يُحسب الصف كخطأ'));
    expect(screen.getByText(/إدخال باقي الصفوف الجديدة فقط/i)).toBeInTheDocument();
    expect(screen.getByText(/يُطلب مراجعته قبل الحفظ النهائي/i)).toBeInTheDocument();
  });
});

