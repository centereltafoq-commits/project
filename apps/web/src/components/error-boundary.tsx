import * as React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/design-system';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  resetKey?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

/**
 * Catches unexpected render errors inside layout routes so a component crash
 * displays a recoverable Arabic message instead of blanking the whole screen.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message = error instanceof Error ? error.message : 'حدث خطأ غير متوقع في عرض الصفحة.';
    return { hasError: true, errorMessage: message };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: null });
    }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error('UI render boundary caught an error:', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, errorMessage: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="mx-auto my-12 max-w-lg rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-center shadow-sm dark:border-rose-900/50 dark:bg-rose-950/30"
        >
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-foreground">تعذّر عرض هذا الجزء من الصفحة</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            حدث خطأ غير متوقع أثناء التحميل. يمكنك إعادة المحاولة دون الحاجة إلى إعادة فتح النظام.
          </p>
          {this.state.errorMessage && (
            <p className="mt-3 rounded-lg bg-background/80 px-3 py-2 font-mono text-xs text-rose-700 dark:text-rose-300" dir="ltr">
              {this.state.errorMessage}
            </p>
          )}
          <div className="mt-5 flex items-center justify-center gap-2">
            <Button type="button" onClick={this.handleReset} className="gap-1.5">
              <RotateCcw className="h-4 w-4" />
              إعادة المحاولة
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.reload()}
            >
              تحديث الصفحة
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

