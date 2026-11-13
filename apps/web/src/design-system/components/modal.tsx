import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE_CLASSES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

function isSwalEventTarget(target: EventTarget | null): boolean {
  if (typeof document !== 'undefined' && document.querySelector('.swal2-container')) {
    return true;
  }
  const el = target as HTMLElement | null;
  return Boolean(el?.closest?.('.swal2-container'));
}

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = 'md',
}: ModalProps) {
  const [swalOpen, setSwalOpen] = React.useState(false);

  React.useEffect(() => {
    const onSwalToggle = (event: Event) => {
      const detail = (event as CustomEvent<boolean>).detail;
      setSwalOpen(Boolean(detail));
    };
    window.addEventListener('edu:swal-toggle', onSwalToggle);
    return () => window.removeEventListener('edu:swal-toggle', onSwalToggle);
  }, []);

  return (
    <DialogPrimitive.Root
      open={open}
      modal={!swalOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isSwalEventTarget(null)) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogPrimitive.Portal>
        {swalOpen ? (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" aria-hidden="true" />
        ) : (
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        )}
        <DialogPrimitive.Content
          dir="rtl"
          onPointerDownOutside={(e) => {
            if (isSwalEventTarget(e.target)) e.preventDefault();
          }}
          onFocusOutside={(e) => {
            if (isSwalEventTarget(e.target)) e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (isSwalEventTarget(e.target)) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (isSwalEventTarget(e.target)) e.preventDefault();
          }}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[95vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-xl focus:outline-none',
            SIZE_CLASSES[size],
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-4 border-b border-border pb-3">
            <div>
              <DialogPrimitive.Title className="text-lg font-bold text-foreground">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

