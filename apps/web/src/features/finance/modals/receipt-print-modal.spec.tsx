import * as React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReceiptPrintModal } from './receipt-print-modal';
import { PaymentMethod } from '@edu-center/shared';

describe('ReceiptPrintModal Component', () => {
  const mockReceipt = {
    id: 'receipt-123',
    studentId: 'student-1',
    studentName: 'أحمد محمود',
    studentCode: 'STU001',
    receiptNumber: 'REC-2026-0001',
    amount: 500,
    paymentMethod: PaymentMethod.CASH,
    paymentDate: '2026-11-08T10:00:00.000Z',
    yearMonth: '2026-11',
    receivedByName: 'كاشير السنتر',
    allocations: [
      {
        groupId: 'grp-1',
        groupName: 'لغة عربية - ثانوية عامة',
        groupCode: 'ARB-1',
        allocatedAmount: 500,
      },
    ],
  };

  beforeEach(() => {
    delete (window as any).desktopApi;
    window.print = vi.fn();
  });

  it('prints using window.print() in standard web browser mode', async () => {
    const handleClose = vi.fn();
    render(<ReceiptPrintModal receipt={mockReceipt as any} onClose={handleClose} />);

    const printBtn = screen.getByRole('button', { name: /طباعة الإيصال/i });
    fireEvent.click(printBtn);

    await waitFor(() => {
      expect(window.print).toHaveBeenCalled();
    });
  });

  it('prints silently via desktopApi when direct print is enabled', async () => {
    const mockPrintReceipt = vi.fn().mockResolvedValue({ success: true });
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
      getLocalIps: vi.fn().mockResolvedValue([]),
      getPrinters: vi.fn().mockResolvedValue([]),
      saveConfig: vi.fn().mockResolvedValue({}),
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      startServer: vi.fn().mockResolvedValue({ success: true }),
      stopServer: vi.fn().mockResolvedValue({ success: true }),
      printReceipt: mockPrintReceipt,
    };

    const handleClose = vi.fn();
    render(<ReceiptPrintModal receipt={mockReceipt as any} onClose={handleClose} />);

    const printBtn = await screen.findByRole('button', { name: /طباعة الإيصال/i });
    fireEvent.click(printBtn);

    await waitFor(() => {
      expect(mockPrintReceipt).toHaveBeenCalledWith(
        expect.objectContaining({
          printerName: 'POS-80-Thermal',
          htmlContent: expect.stringContaining('أحمد محمود'),
        }),
      );
    });

    expect(window.print).not.toHaveBeenCalled();
  });

  it('falls back to window.print() if desktop direct print is disabled', async () => {
    const mockPrintReceipt = vi.fn();
    (window as any).desktopApi = {
      isDesktop: true,
      platform: 'win32',
      version: '1.0.0',
      getConfig: vi.fn().mockResolvedValue({
        serverMode: 'server',
        serverUrl: 'http://localhost:4000',
        defaultThermalPrinter: 'POS-80-Thermal',
        directPrintEnabled: false,
        isFirstLaunch: false,
      }),
      getServerStatus: vi.fn().mockResolvedValue({ running: true, port: 4000 }),
      getLocalIps: vi.fn().mockResolvedValue([]),
      getPrinters: vi.fn().mockResolvedValue([]),
      saveConfig: vi.fn().mockResolvedValue({}),
      testConnection: vi.fn().mockResolvedValue({ ok: true }),
      startServer: vi.fn().mockResolvedValue({ success: true }),
      stopServer: vi.fn().mockResolvedValue({ success: true }),
      printReceipt: mockPrintReceipt,
    };

    const handleClose = vi.fn();
    render(<ReceiptPrintModal receipt={mockReceipt as any} onClose={handleClose} />);

    // Wait for hook to finish loading
    await waitFor(() => {
      expect((window as any).desktopApi.getConfig).toHaveBeenCalled();
    });

    const printBtn = screen.getByRole('button', { name: /طباعة الإيصال/i });
    fireEvent.click(printBtn);

    expect(mockPrintReceipt).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(window.print).toHaveBeenCalled();
    });
  });
});
