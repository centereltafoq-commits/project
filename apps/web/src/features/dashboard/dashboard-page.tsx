import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, RefreshCw } from 'lucide-react';
import { Button, Card, PageHeader } from '@/design-system';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { formatYearMonthAr, getCurrentYearMonth } from '@/lib/formatters';
import { DashboardKpiGrids } from './components/dashboard-kpi-grids';
import { DashboardLivePanels } from './components/dashboard-live-panels';
import { DashboardSummaryData } from './dashboard.types';

export function DashboardPage() {
  const [yearMonth, setYearMonth] = React.useState<string>(() => getCurrentYearMonth());

  const { data, isLoading, isError, error, refetch, isFetching } =
    useQuery<DashboardSummaryData>({
      queryKey: ['dashboard-summary', yearMonth],
      queryFn: async () => {
        const res = await apiClient.get<DashboardSummaryData>('/dashboard/summary', {
          params: { yearMonth },
        });
        return res.data;
      },
      staleTime: 25_000,
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="لوحة التحكم التنفيذية"
        description={`نظرة شاملة ومباشرة على الأداء الأكاديمي والمالي والتشغيلي للسنتر — ${formatYearMonthAr(yearMonth)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-1.5">
              <Calendar className="h-4 w-4 text-primary" />
              <label htmlFor="dashboard-month" className="text-xs font-bold text-muted-foreground">
                الشهر المالي:
              </label>
              <input
                id="dashboard-month"
                type="month"
                value={yearMonth}
                onChange={(e) => {
                  if (e.target.value) setYearMonth(e.target.value);
                }}
                className="bg-transparent text-sm font-bold text-foreground focus:outline-none"
              />
            </div>

            {yearMonth !== getCurrentYearMonth() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setYearMonth(getCurrentYearMonth())}
              >
                الشهر الحالي
              </Button>
            )}

            <Button
              variant="outline"
              size="md"
              onClick={() => refetch()}
              isLoading={isFetching && !isLoading}
            >
              <RefreshCw className="h-4 w-4" />
              تحديث
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, idx) => (
              <Card key={idx} className="h-28 animate-pulse bg-muted/50" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Card key={idx} className="h-28 animate-pulse bg-muted/50" />
            ))}
          </div>
          <Card className="h-64 animate-pulse bg-muted/50" />
        </div>
      ) : isError || !data ? (
        <Card className="p-8 text-center">
          <p className="text-base font-bold text-destructive">
            تعذّر تحميل مؤشرات لوحة التحكم
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{extractErrorMessage(error)}</p>
          <Button variant="primary" size="sm" className="mt-4" onClick={() => refetch()}>
            إعادة المحاولة
          </Button>
        </Card>
      ) : (
        <>
          <DashboardKpiGrids data={data} />
          <DashboardLivePanels data={data} />
        </>
      )}
    </div>
  );
}

export default DashboardPage;
