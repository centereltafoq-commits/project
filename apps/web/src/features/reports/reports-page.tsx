import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, Printer } from 'lucide-react';
import { DEFAULT_PAGE_SIZE, PERMISSIONS } from '@edu-center/shared';
import { Button, PageHeader, ServerDataTable, StatCard, useToast } from '@/design-system';
import { useAuth } from '@/features/auth/auth-context';
import { useDebounce } from '@/hooks/use-debounce';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { getCurrentYearMonth } from '@/lib/formatters';
import { formatReportKpiValue, resolveReportColumns } from './columns/resolve-report-columns';
import { ReportsToolbar } from './components/reports-toolbar';
import {
  ALL_REPORTS_DEFINITIONS,
  ReportApiResponse,
  ReportFilterOptionsData,
  ReportTypeSlug,
} from './reports.types';

export function ReportsPage() {
  const { hasPermission } = useAuth();
  const { notify } = useToast();
  const canExport = hasPermission(PERMISSIONS.REPORTS_EXPORT);

  const [activeReport, setActiveReport] = React.useState<ReportTypeSlug>('students');
  const [yearMonth, setYearMonth] = React.useState<string>(() => getCurrentYearMonth());
  const [groupId, setGroupId] = React.useState('');
  const [teacherId, setTeacherId] = React.useState('');
  const [studentId, setStudentId] = React.useState('');
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(DEFAULT_PAGE_SIZE);
  const [isExporting, setIsExporting] = React.useState(false);
  const [printAllRows, setPrintAllRows] = React.useState<Record<string, unknown>[] | null>(null);

  const activeDefinition = React.useMemo(
    () => ALL_REPORTS_DEFINITIONS.find((d) => d.slug === activeReport) ?? ALL_REPORTS_DEFINITIONS[0],
    [activeReport],
  );

  const { data: filterOptions } = useQuery<ReportFilterOptionsData>({
    queryKey: ['reports-filter-options'],
    queryFn: async () => {
      const res = await apiClient.get<ReportFilterOptionsData>('/reports/filter-options');
      return res.data;
    },
    staleTime: 60_000,
  });

  const queryParams = React.useMemo(
    () => ({
      yearMonth: activeDefinition.usesMonth ? yearMonth : undefined,
      groupId: activeDefinition.usesGroup && groupId ? groupId : undefined,
      teacherId: activeDefinition.usesTeacher && teacherId ? teacherId : undefined,
      studentId: activeDefinition.usesStudent && studentId ? studentId : undefined,
      search: debouncedSearch || undefined,
      page,
      limit,
    }),
    [activeDefinition, yearMonth, groupId, teacherId, studentId, debouncedSearch, page, limit],
  );

  const { data, isLoading } = useQuery<ReportApiResponse>({
    queryKey: ['report-data', activeReport, queryParams],
    queryFn: async () => {
      const res = await apiClient.get<ReportApiResponse>(`/reports/${activeReport}`, {
        params: queryParams,
      });
      return res.data;
    },
  });

  const handleExportCsv = async () => {
    if (!canExport) {
      notify('ليس لديك صلاحية تصدير التقارير', 'error');
      return;
    }
    setIsExporting(true);
    try {
      const res = await apiClient.get<Blob>(`/reports/${activeReport}/export-csv`, {
        params: { ...queryParams, page: undefined, limit: undefined },
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${activeReport}-${yearMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      notify('تم تصدير التقرير بصيغة CSV (UTF-8 BOM) المتوافقة مع Excel بنجاح', 'success');
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = async () => {
    const totalPages = data?.meta?.totalPages ?? 1;
    if (canExport && totalPages > 1) {
      try {
        const res = await apiClient.get<ReportApiResponse>(`/reports/${activeReport}`, {
          params: { ...queryParams, exportAll: 'true' },
        });
        setPrintAllRows(res.data.data);
        setTimeout(() => {
          window.print();
          setPrintAllRows(null);
        }, 120);
        return;
      } catch {
        // Fallback to printing visible page
      }
    }
    window.print();
  };

  const columns = React.useMemo(() => resolveReportColumns(activeReport), [activeReport]);
  const displayRows = printAllRows ?? data?.data ?? [];
  const isSummaryOnly = activeReport === 'financial-summary';

  return (
    <div className="space-y-5">
      <PageHeader
        title="مركز التقارير الشاملة والتصدير (11 تقريراً)"
        description={activeDefinition.fullTitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canExport && (
              <Button variant="success" size="md" isLoading={isExporting} onClick={handleExportCsv}>
                <Download className="h-4 w-4" />
                تصدير Excel / CSV (UTF-8 BOM للعربية)
              </Button>
            )}
            <Button variant="primary" size="md" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              طباعة التقرير
            </Button>
          </div>
        }
      />

      <ReportsToolbar
        activeReport={activeReport}
        onSelectReport={(slug) => {
          setActiveReport(slug);
          setPage(1);
        }}
        activeDefinition={activeDefinition}
        yearMonth={yearMonth}
        onYearMonthChange={(v) => {
          setYearMonth(v);
          setPage(1);
        }}
        groupId={groupId}
        onGroupChange={(v) => {
          setGroupId(v);
          setPage(1);
        }}
        teacherId={teacherId}
        onTeacherChange={(v) => {
          setTeacherId(v);
          setPage(1);
        }}
        studentId={studentId}
        onStudentChange={(v) => {
          setStudentId(v);
          setPage(1);
        }}
        search={search}
        onResetFilters={() => {
          setYearMonth(getCurrentYearMonth());
          setGroupId('');
          setTeacherId('');
          setStudentId('');
          setSearch('');
          setPage(1);
        }}
        filterOptions={filterOptions}
      />

      {data?.summary && data.summary.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {data.summary.map((kpi) => (
            <StatCard
              key={kpi.key}
              title={kpi.label}
              value={formatReportKpiValue(kpi)}
              icon={BarChart3}
              tone={kpi.tone ?? 'primary'}
            />
          ))}
        </div>
      )}

      <ServerDataTable
        columns={columns}
        data={displayRows}
        meta={data?.meta}
        isLoading={isLoading}
        rowKey={(r) => String(r.id ?? Math.random())}
        searchPlaceholder="ابحث داخل التقرير الحالي..."
        searchValue={search}
        onSearchChange={
          isSummaryOnly
            ? undefined
            : (v) => {
                setSearch(v);
                setPage(1);
              }
        }
        page={page}
        onPageChange={isSummaryOnly ? undefined : setPage}
        limit={limit}
        onLimitChange={
          isSummaryOnly
            ? undefined
            : (l) => {
                setLimit(l);
                setPage(1);
              }
        }
        emptyTitle="لا توجد سجلات مطابقة لمعايير التقرير"
        emptyDescription="جرّب تغيير الشهر المالي أو إعادة ضبط الفلاتر لعرض النتائج."
      />
    </div>
  );
}

export default ReportsPage;
