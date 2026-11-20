import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ToastProvider } from '@/design-system';
import { auditLogsApi } from '../audit-logs.api';
import { AuditLogRow } from './audit-log-quick-view-modal';
import { AuditRollbackModal } from './audit-rollback-modal';

vi.mock('../audit-logs.api', () => ({
  auditLogsApi: {
    getRollbackPreview: vi.fn(),
    executeRollback: vi.fn(),
  },
}));

const SAMPLE_LOG: AuditLogRow = {
  id: '550e8400-e29b-41d4-a716-446655440999',
  actorName: 'محاسب السنتر',
  action: 'FINANCE_COLLECT_PAYMENT',
  actionAr: 'تحصيل مدفوعات طالب',
  entityType: 'payment',
  entityTypeAr: 'مدفوعات الطلاب',
  entityId: 'pay-1',
  ipAddress: '127.0.0.1',
  createdAt: '2026-11-20T12:00:00.000Z',
  isReversible: true,
  isReverted: false,
};

function renderModal(onOpenChange = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuditRollbackModal open={true} onOpenChange={onOpenChange} log={SAMPLE_LOG} />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('AuditRollbackModal', () => {
  const getPreviewMock = vi.mocked(auditLogsApi.getRollbackPreview);
  const executeMock = vi.mocked(auditLogsApi.executeRollback);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays exact system impact and warnings and executes rollback with reason', async () => {
    const onOpenChange = vi.fn();
    getPreviewMock.mockResolvedValue({
      auditLogId: SAMPLE_LOG.id,
      action: SAMPLE_LOG.action,
      actionAr: SAMPLE_LOG.actionAr!,
      entityType: SAMPLE_LOG.entityType,
      entityTypeAr: SAMPLE_LOG.entityTypeAr!,
      entityId: SAMPLE_LOG.entityId,
      isReversible: true,
      canRollback: true,
      alreadyReverted: false,
      blockedReason: null,
      affectedMonths: ['2026-11'],
      warnings: ['يوجد (1) تعديل أحدث مسجل على نفس السجل.'],
      affectedChanges: [
        {
          area: 'إيصال التحصيل',
          summary: 'إلغاء وحذف إيصال رقم (RCP-1) بقيمة 300 ج.م',
          detail: 'سيتم حذف الإيصال وإعادة المتبقي على الطالب',
          severity: 'warning',
        },
        {
          area: 'رصيد ومستحقات الطالب',
          summary: 'تعديل المسدد من 300 ج.م إلى 0 ج.م',
          detail: 'سيرتفع المتبقي من 0 إلى 300 ج.م',
          severity: 'info',
        },
      ],
    });
    executeMock.mockResolvedValue({
      success: true,
      revertedAuditLogId: SAMPLE_LOG.id,
      affectedMonths: ['2026-11'],
      affectedChanges: [],
      message: 'تم التراجع بنجاح عن (تحصيل مدفوعات طالب)',
    });

    renderModal(onOpenChange);

    expect(
      await screen.findByText('إلغاء وحذف إيصال رقم (RCP-1) بقيمة 300 ج.م'),
    ).toBeInTheDocument();
    expect(screen.getByText('يوجد (1) تعديل أحدث مسجل على نفس السجل.')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/تم التحصيل لطالب آخر بالخطأ/i), {
      target: { value: 'تحصيل مكرر للطالب' },
    });

    const confirmBtn = screen.getByRole('button', { name: /تأكيد الرجوع عن العملية/i });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(executeMock).toHaveBeenCalledWith(SAMPLE_LOG.id, 'تحصيل مكرر للطالب');
    });
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('shows blockedReason and disables confirmation when rollback is unsafe', async () => {
    getPreviewMock.mockResolvedValue({
      auditLogId: SAMPLE_LOG.id,
      action: SAMPLE_LOG.action,
      actionAr: SAMPLE_LOG.actionAr!,
      entityType: SAMPLE_LOG.entityType,
      entityTypeAr: SAMPLE_LOG.entityTypeAr!,
      entityId: SAMPLE_LOG.entityId,
      isReversible: true,
      canRollback: false,
      alreadyReverted: false,
      blockedReason: 'الشهر المالي (2026-11) مغلق نهائياً',
      affectedMonths: ['2026-11'],
      warnings: [],
      affectedChanges: [],
    });

    renderModal();

    expect(
      await screen.findByText('الشهر المالي (2026-11) مغلق نهائياً'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /تأكيد الرجوع عن العملية/i }),
    ).toBeDisabled();
  });
});
