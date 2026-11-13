import Swal, { SweetAlertIcon, SweetAlertOptions } from 'sweetalert2';

export interface ConfirmActionOptions {
  title: string;
  text?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  isDestructive?: boolean;
  icon?: SweetAlertIcon;
}

/**
 * Returns customized base options for SweetAlert2 that respect
 * RTL direction, active dark mode, and the system's design system.
 */
function getBaseSwalOptions(): SweetAlertOptions {
  const isDark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark');

  return {
    customClass: {
      popup:
        'rounded-2xl border border-border shadow-2xl p-6 font-sans text-right select-none',
      title: 'text-lg font-black text-foreground mb-1',
      htmlContainer: 'text-xs sm:text-sm text-muted-foreground leading-relaxed',
      confirmButton:
        'inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition-all focus:outline-none cursor-pointer',
      cancelButton:
        'inline-flex items-center justify-center rounded-xl border border-border bg-card hover:bg-accent px-5 py-2.5 text-xs sm:text-sm font-bold text-foreground shadow-sm transition-all focus:outline-none cursor-pointer ml-3',
      actions: 'gap-3 mt-4 justify-start flex-row-reverse',
    },
    buttonsStyling: false,
    background: isDark ? '#0f172a' : '#ffffff',
    color: isDark ? '#f8fafc' : '#0f172a',
  };
}

/**
 * Enterprise confirmation dialog replacing native window.confirm().
 * Fully supports RTL, dark mode, and destructive vs regular actions.
 */
export async function confirmAction({
  title,
  text,
  confirmButtonText = 'نعم، متأكد',
  cancelButtonText = 'إلغاء',
  isDestructive = false,
  icon = 'warning',
}: ConfirmActionOptions): Promise<boolean> {
  const base = getBaseSwalOptions();

  const confirmBtnClass = isDestructive
    ? 'inline-flex items-center justify-center rounded-xl bg-destructive hover:bg-destructive/90 px-5 py-2.5 text-xs sm:text-sm font-bold text-destructive-foreground shadow-sm transition-all focus:outline-none cursor-pointer'
    : 'inline-flex items-center justify-center rounded-xl bg-primary hover:bg-primary/90 px-5 py-2.5 text-xs sm:text-sm font-bold text-primary-foreground shadow-sm transition-all focus:outline-none cursor-pointer';

  const result = await Swal.fire({
    ...base,
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true,
    customClass: {
      ...base.customClass,
      confirmButton: confirmBtnClass,
    },
  });

  return Boolean(result.isConfirmed);
}

/**
 * Displays a styled success notification alert.
 */
export async function showSuccessAlert(
  title: string,
  text?: string,
): Promise<void> {
  const base = getBaseSwalOptions();
  await Swal.fire({
    ...base,
    title,
    text,
    icon: 'success',
    confirmButtonText: 'حسناً',
    customClass: {
      ...base.customClass,
      confirmButton:
        'inline-flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition-all focus:outline-none cursor-pointer',
    },
  });
}

/**
 * Displays a styled error notification alert.
 */
export async function showErrorAlert(
  title: string,
  text?: string,
): Promise<void> {
  const base = getBaseSwalOptions();
  await Swal.fire({
    ...base,
    title,
    text,
    icon: 'error',
    confirmButtonText: 'حسناً',
    customClass: {
      ...base.customClass,
      confirmButton:
        'inline-flex items-center justify-center rounded-xl bg-destructive hover:bg-destructive/90 px-5 py-2.5 text-xs sm:text-sm font-bold text-destructive-foreground shadow-sm transition-all focus:outline-none cursor-pointer',
    },
  });
}

/**
 * Displays a styled warning alert.
 */
export async function showWarningAlert(
  title: string,
  text?: string,
): Promise<void> {
  const base = getBaseSwalOptions();
  await Swal.fire({
    ...base,
    title,
    text,
    icon: 'warning',
    confirmButtonText: 'فهمت ذلك',
    customClass: {
      ...base.customClass,
      confirmButton:
        'inline-flex items-center justify-center rounded-xl bg-amber-600 hover:bg-amber-700 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm transition-all focus:outline-none cursor-pointer',
    },
  });
}
