import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AssistantCalculationMethod } from '@edu-center/shared';
import { afterEach, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/design-system';
import { apiClient } from '@/lib/api-client';
import { AssistantFormModal } from './assistant-form-modal';

afterEach(() => vi.restoreAllMocks());

it('sends an explicit clear when the saved agreement note is emptied', async () => {
  const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue({});
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AssistantFormModal
          open
          onOpenChange={() => undefined}
          assistant={{
            id: 'assistant-1',
            assistantCode: 'AST-1234',
            fullName: 'مساعد تجريبي',
            phone: '01012345678',
            calculationMethod: AssistantCalculationMethod.CUSTOM_AGREEMENT,
            rateValue: '45.00',
            customFormulaNote: 'اتفاق سابق',
            status: 'ACTIVE',
            createdAt: '2026-11-18T00:00:00.000Z',
          }}
        />
      </ToastProvider>
    </QueryClientProvider>,
  );

  const note = screen.getByLabelText('شرح الاتفاق المالي / ملاحظات الاحتساب');
  expect(note).toHaveValue('اتفاق سابق');
  fireEvent.change(note, { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));

  await waitFor(() => {
    expect(patch).toHaveBeenCalledWith(
      '/assistants/assistant-1',
      expect.objectContaining({ customFormulaNote: null }),
    );
  });
});
