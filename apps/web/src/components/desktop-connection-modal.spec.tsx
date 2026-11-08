import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DesktopConnectionModal } from './desktop-connection-modal';

describe('DesktopConnectionModal Component', () => {
  beforeEach(() => {
    delete (window as any).desktopApi;
  });

  it('does not render when not in desktop mode', () => {
    const { container } = render(<DesktopConnectionModal />);
    expect(container.firstChild).toBeNull();
  });

  it('renders modal when isDesktop is true and isFirstLaunch is true', async () => {
    (window as any).desktopApi = {
      isDesktop: true,
      platform: 'win32',
      version: '1.0.0',
      getConfig: vi.fn().mockResolvedValue({
        serverMode: 'server',
        serverUrl: 'http://localhost:4000',
        isFirstLaunch: true,
      }),
      getServerStatus: vi.fn().mockResolvedValue({ running: false, port: 4000 }),
      getLocalIps: vi.fn().mockResolvedValue(['192.168.1.25']),
      getPrinters: vi.fn().mockResolvedValue([]),
      saveConfig: vi.fn().mockResolvedValue({}),
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      startServer: vi.fn().mockResolvedValue({ success: true }),
      stopServer: vi.fn().mockResolvedValue({ success: true }),
      printReceipt: vi.fn().mockResolvedValue({ success: true }),
    };

    render(<DesktopConnectionModal />);

    expect(await screen.findByText('إعداد اتصال السنتر والشبكة المحلية (LAN)')).toBeInTheDocument();
    expect(screen.getByText('تشغيل هذا الجهاز كسيرفر رئيسي للسنتر')).toBeInTheDocument();
    expect(screen.getByText('الاتصال بسيرفر السنتر')).toBeInTheDocument();
  });

  it('selects server mode, shows local IPs, and saves config on confirm', async () => {
    const mockSaveConfig = vi.fn().mockResolvedValue({});
    const mockStartServer = vi.fn().mockResolvedValue({ success: true });

    (window as any).desktopApi = {
      isDesktop: true,
      platform: 'win32',
      version: '1.0.0',
      getConfig: vi.fn().mockResolvedValue({
        serverMode: 'server',
        serverUrl: 'http://localhost:4000',
        isFirstLaunch: true,
      }),
      getServerStatus: vi.fn().mockResolvedValue({ running: false, port: 4000 }),
      getLocalIps: vi.fn().mockResolvedValue(['192.168.1.25']),
      getPrinters: vi.fn().mockResolvedValue([]),
      saveConfig: mockSaveConfig,
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      startServer: mockStartServer,
      stopServer: vi.fn().mockResolvedValue({ success: true }),
      printReceipt: vi.fn().mockResolvedValue({ success: true }),
    };

    render(<DesktopConnectionModal />);

    expect(await screen.findByText('تشغيل هذا الجهاز كسيرفر رئيسي للسنتر')).toBeInTheDocument();
    expect(await screen.findByText(/192.168.1.25:4000/)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /تأكيد والبدء كسيرفر رئيسي/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockStartServer).toHaveBeenCalled();
      expect(mockSaveConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          serverMode: 'server',
          serverUrl: 'http://localhost:4000',
          isFirstLaunch: false,
        }),
      );
    });
  });

  it('switches to client mode, tests connection ping, and saves client config', async () => {
    const mockSaveConfig = vi.fn().mockResolvedValue({});
    const mockTestConnection = vi.fn().mockResolvedValue({ ok: true });

    (window as any).desktopApi = {
      isDesktop: true,
      platform: 'win32',
      version: '1.0.0',
      getConfig: vi.fn().mockResolvedValue({
        serverMode: 'server',
        serverUrl: 'http://localhost:4000',
        isFirstLaunch: true,
      }),
      getServerStatus: vi.fn().mockResolvedValue({ running: false, port: 4000 }),
      getLocalIps: vi.fn().mockResolvedValue([]),
      getPrinters: vi.fn().mockResolvedValue([]),
      saveConfig: mockSaveConfig,
      testConnection: mockTestConnection,
      startServer: vi.fn().mockResolvedValue({ success: true }),
      stopServer: vi.fn().mockResolvedValue({ success: true }),
      printReceipt: vi.fn().mockResolvedValue({ success: true }),
    };

    render(<DesktopConnectionModal />);

    const clientModeTab = await screen.findByText('الاتصال بسيرفر السنتر');
    fireEvent.click(clientModeTab);

    expect(await screen.findByLabelText(/عنوان سيرفر السنتر الرئيسي/i)).toBeInTheDocument();

    const pingBtn = screen.getByRole('button', { name: /فحص الاتصال/i });
    fireEvent.click(pingBtn);

    await waitFor(() => {
      expect(mockTestConnection).toHaveBeenCalled();
    });

    const saveBtn = screen.getByRole('button', { name: /حفظ ومتابعة/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockSaveConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          serverMode: 'client',
          isFirstLaunch: false,
        }),
      );
    });
  });
});
