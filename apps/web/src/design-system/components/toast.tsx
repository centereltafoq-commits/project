import * as React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  notify: (message: string, type?: ToastType) => void;
}

const ToastContext = React.createContext<ToastContextValue>({
  notify: () => undefined,
});

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);

  const notify = React.useCallback((message: string, type: ToastType = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setItems((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-4 left-4 z-[100] flex flex-col gap-2 no-print" dir="rtl">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'flex min-w-[280px] max-w-md items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg transition-all',
              item.type === 'success' && 'border-emerald-500/30 bg-emerald-950 text-emerald-100',
              item.type === 'error' && 'border-rose-500/30 bg-rose-950 text-rose-100',
              item.type === 'info' && 'border-blue-500/30 bg-slate-900 text-slate-100',
            )}
          >
            {item.type === 'success' && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />}
            {item.type === 'error' && <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />}
            {item.type === 'info' && <Info className="h-5 w-5 shrink-0 text-blue-400" />}
            <span className="flex-1">{item.message}</span>
            <button
              onClick={() => setItems((prev) => prev.filter((t) => t.id !== item.id))}
              className="rounded p-0.5 opacity-70 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

