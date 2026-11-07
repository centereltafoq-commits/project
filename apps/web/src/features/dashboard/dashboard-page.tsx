import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Banknote,
  GraduationCap,
  RefreshCw,
} from 'lucide-react';
import { PERMISSIONS } from '@edu-center/shared';
import {
  Button,
  Card,
  MonthPicker,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { formatYearMonthAr, getCurrentYearMonth } from '@/lib/formatters';
import { DashboardAcademicTab } from './components/dashboard-academic-tab';
import { DashboardFinanceTab } from './components/dashboard-finance-tab';
import { DashboardHeroKpis } from './components/dashboard-hero-kpis';
import { DashboardMonthlySessionsCard } from './components/dashboard-monthly-sessions-card';
import { DashboardOperationsTab } from './components/dashboard-operations-tab';
import { DashboardSummaryData } from './dashboard.types';

export function DashboardPage() {
  const { hasPermission } = useAuth();
  const canViewFinance = hasPermission(PERMISSIONS.FINANCE_VIEW);
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
            <MonthPicker
              label="الشهر المالي:"
              value={yearMonth}
              onChange={setYearMonth}
            />

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
          {/* Skeleton for 4 Hero Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Card key={idx} className="h-28 animate-pulse bg-muted/50" />
            ))}
          </div>
          {/* Skeleton for tabs & main card */}
          <div className="h-10 w-80 animate-pulse rounded-lg bg-muted/50" />
          <Card className="h-96 animate-pulse bg-muted/50" />
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
        <div className="space-y-6">
          {/* 1. الشريط العلوي الثابت لأهم 4 أرقام حيوية */}
          <DashboardHeroKpis data={data} />

          {/* 2. مؤشرات حركة الحصص والتحصيل الشهري (المنفذة، المستحقة، المسددة، والمتأخرات) */}
          <DashboardMonthlySessionsCard data={data} />

          {/* 3. التبويبات التنفيذية المنظمة */}
          <Tabs defaultValue="operations" className="space-y-5">
            <TabsList className={`grid w-full ${canViewFinance ? 'grid-cols-3' : 'grid-cols-2'} sm:w-auto`}>
              <TabsTrigger value="operations" className="gap-2 font-bold">
                <Activity className="h-4 w-4 text-primary" />
                <span>غرفة العمليات اليومية</span>
                {data.todaySessionsCount > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary font-mono">
                    {data.todaySessionsCount}
                  </span>
                )}
              </TabsTrigger>

              {canViewFinance && (
                <TabsTrigger value="finance" className="gap-2 font-bold">
                  <Banknote className="h-4 w-4 text-emerald-600" />
                  <span>التحليل المالي للشهر</span>
                </TabsTrigger>
              )}

              <TabsTrigger value="academic" className="gap-2 font-bold">
                <GraduationCap className="h-4 w-4 text-purple-600" />
                <span>المؤشرات الأكاديمية والكوادر</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="operations">
              <DashboardOperationsTab data={data} />
            </TabsContent>

            {canViewFinance && (
              <TabsContent value="finance">
                <DashboardFinanceTab data={data} />
              </TabsContent>
            )}

            <TabsContent value="academic">
              <DashboardAcademicTab data={data} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
