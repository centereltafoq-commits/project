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
    const validPngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const validPngFile = new File([validPngHeader], 'center-logo.png', {
      type: 'image/png',
    });

    fireEvent.change(fileInput, { target: { files: [validPngFile] } });

    await waitFor(() => {
      expect(settingsApi.uploadLogo).toHaveBeenCalledWith(validPngFile);
    });
  });

  it('rejects corrupted PNG image before uploading', async () => {
    renderComponent();

    const fileInput = await screen.findByTestId('logo-file-input');
    const corruptFile = new File(['not-a-real-png'], 'broken.png', {
      type: 'image/png',
    });

    fireEvent.change(fileInput, { target: { files: [corruptFile] } });

    await waitFor(() => {
      expect(settingsApi.uploadLogo).not.toHaveBeenCalled();
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

  it('renders Desktop & Hardware card when running in desktop mode', async () => {
    const mockSaveConfig = vi.fn().mockResolvedValue({});
    (window as any).desktopApi = {
      isDesktop: true,
      platform: 'win32',
      version: '1.0.0',
      getConfig: vi.fn().mockResolvedValue({
        serverMode: 'server',
        serverUrl: 'http://localhost:4000',
        defaultThermalPrinter: 'POS-80-Thermal',
        directPrintEnabled: true,
        isFirstLaunch: false,
      }),
      getServerStatus: vi.fn().mockResolvedValue({ running: true, port: 4000 }),
      getLocalIps: vi.fn().mockResolvedValue(['192.168.1.15']),
      getPrinters: vi.fn().mockResolvedValue([
        { name: 'POS-80-Thermal', displayName: 'POS 80mm Printer', isDefault: true, status: 0 },
        { name: 'PDF-Printer', displayName: 'PDF Printer', isDefault: false, status: 0 },
      ]),
      saveConfig: mockSaveConfig,
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      startServer: vi.fn().mockResolvedValue({ success: true }),
      stopServer: vi.fn().mockResolvedValue({ success: true }),
      printReceipt: vi.fn().mockResolvedValue({ success: true }),
    };

    renderComponent();

    expect(
      await screen.findByText('إعدادات أجهزة السنتر والطباعة الحرارية (Desktop & Hardware)'),
    ).toBeInTheDocument();
    expect(screen.getByText(/طابعة إيصالات السداد الحرارية الافتراضية/i)).toBeInTheDocument();
    expect(
      screen.getByText('تفعيل الطباعة الصامتة المباشرة لإيصالات السداد (بدون نافذة المتصفح)'),
    ).toBeInTheDocument();
    expect(screen.getByText('يعمل (منفذ 4000)')).toBeInTheDocument();
    expect(screen.getByText('http://192.168.1.15:4000')).toBeInTheDocument();

    // Toggle direct printing
    const toggleCheckbox = screen.getByLabelText(
      'تفعيل الطباعة الصامتة المباشرة لإيصالات السداد (بدون نافذة المتصفح)',
    );
    fireEvent.click(toggleCheckbox);

    await waitFor(() => {
      expect(mockSaveConfig).toHaveBeenCalledWith({ directPrintEnabled: false });
    });

    delete (window as any).desktopApi;
  });
});
