import * as React from 'react';
import { ChevronLeft, ChevronRight, Inbox, Search, X } from 'lucide-react';
import { ALLOWED_PAGE_SIZES, DEFAULT_PAGE_SIZE, PaginationMeta } from '@edu-center/shared';
import { cn } from '@/lib/cn';
import { Button } from './button';
import { Card } from './card';

export interface TableColumn<T> {
  key: string;
  header: string;
  className?: string;
  headerClassName?: string;
  render: (row: T, index: number) => React.ReactNode;
}

interface ServerDataTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  meta?: PaginationMeta;
  isLoading?: boolean;
  rowKey: (row: T) => string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  page?: number;
  onPageChange?: (page: number) => void;
  limit?: number;
  onLimitChange?: (limit: number) => void;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  tableClassName?: string;
}

export function ServerDataTable<T>({
  columns,
  data,
  meta,
  isLoading = false,
  rowKey,
  searchPlaceholder = 'ابحث بالاسم أو الكود أو رقم الهاتف...',
  searchValue,
  onSearchChange,
  page = 1,
  onPageChange,
  limit = DEFAULT_PAGE_SIZE,
  onLimitChange,
  filters,
  actions,
  emptyTitle = 'لا توجد بيانات مطابقة',
  emptyDescription = 'جرّب تعديل كلمات البحث أو الفلاتر أو أضف سجلاً جديداً.',
  onRowClick,
  tableClassName,
}: ServerDataTableProps<T>) {
  const currentLimit = meta?.limit ?? limit;
  const currentPage = meta?.page ?? page;
  const totalItems = meta?.totalItems ?? data.length;
  const totalPages = meta?.totalPages ?? 1;
  const startIdx = totalItems === 0 ? 0 : (currentPage - 1) * currentLimit + 1;
  const endIdx = Math.min(totalItems, currentPage * currentLimit);

  return (
    <Card className="overflow-hidden">
      {(onSearchChange || filters || actions) && (
        <div className="flex flex-col gap-3 border-b border-border bg-muted/20 p-3.5 lg:flex-row lg:items-center lg:justify-between no-print">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {onSearchChange && (
              <div className="relative w-full sm:w-72 md:w-80">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchValue ?? ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-9 w-full rounded-lg border border-input bg-card pr-9 pl-8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {searchValue && (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
            {filters}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className={cn('w-full min-w-full border-collapse text-right text-xs', tableClassName)}>
          <thead>
            <tr className="border-b border-border bg-muted/40 text-xs font-bold text-muted-foreground">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-3.5 py-3 text-right text-xs font-bold text-muted-foreground whitespace-nowrap',
                    col.headerClassName,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  {columns.map((col) => (
                    <td key={col.key} className="px-3.5 py-3 whitespace-nowrap">
                      <div className="h-4 w-3/4 rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-14 text-center">
                  <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Inbox className="h-6 w-6" />
                    </div>
                    <p className="font-bold text-foreground">{emptyTitle}</p>
                    <p className="text-xs text-muted-foreground">{emptyDescription}</p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'transition-colors hover:bg-accent/40',
                    onRowClick && 'cursor-pointer',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'px-3.5 py-2.5 align-middle whitespace-nowrap text-xs',
                        col.className,
                      )}
                    >
                      {col.render(row, idx)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {onPageChange && (
        <div className="flex flex-col gap-3 border-t border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between no-print">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              عرض <strong className="text-foreground">{startIdx}</strong> إلى{' '}
              <strong className="text-foreground">{endIdx}</strong> من أصل{' '}
              <strong className="text-foreground">{totalItems}</strong> سجل
            </span>
            {onLimitChange && (
              <div className="flex items-center gap-1.5">
                <span>لكل صفحة:</span>
                <select
                  value={currentLimit}
                  onChange={(e) => onLimitChange(Number(e.target.value))}
                  className="rounded-md border border-input bg-card px-2 py-1 text-xs font-semibold text-foreground"
                >
                  {ALLOWED_PAGE_SIZES.map((sz) => (
                    <option key={sz} value={sz}>
                      {sz}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
            >
              <ChevronRight className="h-4 w-4" />
              السابق
            </Button>
            <span className="px-2 font-semibold text-foreground">
              صفحة {currentPage} من {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
            >
              التالي
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

