import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '@/design-system';
import { SettingsPage } from './settings-page';
import { CenterSettingsProvider } from './center-settings-context';
import { settingsApi } from './settings-api';

vi.mock('./settings-api', () => ({
  settingsApi: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
    resetAcademicYear: vi.fn(),
    uploadLogo: vi.fn(),
    removeLogo: vi.fn(),
  },
}));

describe('SettingsPage Component', () => {
  const mockSettings = {
    id: 'default',
    centerName: 'سنتر النخبة التعليمي',
    centerSubtitle: 'نظام الإدارة المتكامل',
    logoUrl: 'https://example.com/logo.png',
    phone: '01000000000',
    address: 'القاهرة، مصر',
    academicYear: '2026 / 2027',
    currencySymbol: 'ج.م',
    updatedAt: new Date().toISOString(),
    updatedBy: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(settingsApi.getSettings).mockResolvedValue(mockSettings);
  });

  const renderComponent = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <CenterSettingsProvider>
            <MemoryRouter>
              <SettingsPage />
            </MemoryRouter>
          </CenterSettingsProvider>
        </ToastProvider>
      </QueryClientProvider>,
    );
  };

  it('renders branding fields and Danger Zone card with start new academic year button', async () => {
    renderComponent();

    expect(await screen.findByText('إعدادات وهوية السنتر')).toBeInTheDocument();
    expect(screen.getByText('منطقة العمليات الحساسة (Danger Zone)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /بدء سنة دراسية جديدة والتصفير/i })).toBeInTheDocument();
  });

  it('opens NewAcademicYearModal when danger button is clicked', async () => {
    renderComponent();

    const dangerBtn = await screen.findByRole('button', {
      name: /بدء سنة دراسية جديدة والتصفير/i,
    });
    fireEvent.click(dangerBtn);

    expect(await screen.findByText(/تأكيد بدء سنة دراسية جديدة/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('أدخل 6 أرقام')).toBeInTheDocument();
  });

  it('allows removing active logo', async () => {
    vi.mocked(settingsApi.removeLogo).mockResolvedValue({
      success: true,
      message: 'تم حذف الشعار بنجاح',
    });

    renderComponent();

    const removeBtn = await screen.findByRole('button', { name: /إزالة الشعار/i });
    expect(removeBtn).toBeInTheDocument();

    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(settingsApi.removeLogo).toHaveBeenCalled();
    });

    expect(
      screen.getByText(/اسحب صورة الشعار وأفلتها هنا، أو اضغط للاختيار من الكمبيوتر/i),
    ).toBeInTheDocument();
  });

  it('uploads logo file when selected from machine', async () => {
    vi.mocked(settingsApi.uploadLogo).mockResolvedValue({
      logoUrl: '/api/settings/logo/uploaded-logo.png',
      fileName: 'uploaded-logo.png',
    });

    renderComponent();

    const fileInput = await screen.findByTestId('logo-file-input');
    const fakeFile = new File(['fake-png-content'], 'center-logo.png', {
      type: 'image/png',
    });

    fireEvent.change(fileInput, { target: { files: [fakeFile] } });

    await waitFor(() => {
      expect(settingsApi.uploadLogo).toHaveBeenCalledWith(fakeFile);
    });
  });

  it('allows opening manual URL fallback input', async () => {
    renderComponent();

    const toggleBtn = await screen.findByRole('button', {
      name: /إدخال رابط صورة يدوي/i,
    });
    fireEvent.click(toggleBtn);

    expect(screen.getByPlaceholderText('https://example.com/logo.png')).toBeInTheDocument();
  });
});
