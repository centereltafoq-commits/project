import { describe, expect, it, vi, beforeEach } from 'vitest';
import Swal from 'sweetalert2';
import {
  confirmAction,
  showSuccessAlert,
  showErrorAlert,
  showWarningAlert,
} from './alerts';

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn(),
  },
}));

describe('Alerts Service (SweetAlert2 wrapper)', () => {
  const swalFireMock = vi.mocked(Swal.fire);

  beforeEach(() => {
    vi.clearAllMocks();
    document.documentElement.classList.remove('dark');
  });

  it('calls Swal.fire with destructive styling and returns true on confirm', async () => {
    swalFireMock.mockResolvedValueOnce({
      isConfirmed: true,
      isDenied: false,
      isDismissed: false,
    } as any);

    const result = await confirmAction({
      title: 'حذف سجل',
      text: 'هل أنت متأكد؟',
      isDestructive: true,
      confirmButtonText: 'نعم، حذف',
      cancelButtonText: 'تراجع',
    });

    expect(result).toBe(true);
    expect(swalFireMock).toHaveBeenCalledTimes(1);

    const callArgs = swalFireMock.mock.calls[0]![0] as any;
    expect(callArgs.title).toBe('حذف سجل');
    expect(callArgs.text).toBe('هل أنت متأكد؟');
    expect(callArgs.confirmButtonText).toBe('نعم، حذف');
    expect(callArgs.cancelButtonText).toBe('تراجع');
    expect(callArgs.customClass.confirmButton).toContain('bg-destructive');
  });

  it('returns false when user cancels the dialog', async () => {
    swalFireMock.mockResolvedValueOnce({
      isConfirmed: false,
      isDenied: false,
      isDismissed: true,
    } as any);

    const result = await confirmAction({
      title: 'إلغاء الاشتراك',
      isDestructive: false,
    });

    expect(result).toBe(false);
    const callArgs = swalFireMock.mock.calls[0]![0] as any;
    expect(callArgs.customClass.confirmButton).toContain('bg-primary');
  });

  it('adapts background for dark mode', async () => {
    document.documentElement.classList.add('dark');
    swalFireMock.mockResolvedValueOnce({ isConfirmed: true } as any);

    await confirmAction({ title: 'وضع ليلي' });

    const callArgs = swalFireMock.mock.calls[0]![0] as any;
    expect(callArgs.background).toBe('#0f172a');
    expect(callArgs.color).toBe('#f8fafc');
  });

  it('triggers showSuccessAlert with success icon and green button', async () => {
    swalFireMock.mockResolvedValueOnce({} as any);

    await showSuccessAlert('تم الحفظ بنجاح', 'تمت العملية بدون أخطاء');

    expect(swalFireMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'تم الحفظ بنجاح',
        text: 'تمت العملية بدون أخطاء',
        icon: 'success',
      }),
    );
  });

  it('triggers showErrorAlert with error icon and destructive button', async () => {
    swalFireMock.mockResolvedValueOnce({} as any);

    await showErrorAlert('حدث خطأ', 'فشل في الاتصال');

    expect(swalFireMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'حدث خطأ',
        text: 'فشل في الاتصال',
        icon: 'error',
      }),
    );
  });

  it('triggers showWarningAlert with warning icon', async () => {
    swalFireMock.mockResolvedValueOnce({} as any);

    await showWarningAlert('تنبيه محاسبي', 'الشهر مغلق مالياً');

    expect(swalFireMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'تنبيه محاسبي',
        text: 'الشهر مغلق مالياً',
        icon: 'warning',
      }),
    );
  });
});
