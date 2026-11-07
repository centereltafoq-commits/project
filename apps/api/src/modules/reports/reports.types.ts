import { PaginatedResult } from '@edu-center/shared';
import { ReportType } from './dto/report-query.dto';

export const MAX_EXPORT_ROWS = 5000;

export interface ReportSummaryKpi {
  key: string;
  label: string;
  value: number | string;
  format?: 'currency' | 'number' | 'percent' | 'text';
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'purple';
}

export interface ReportPayload<T = Record<string, unknown>> extends PaginatedResult<T> {
  reportType: ReportType;
  titleAr: string;
  yearMonth: string;
  generatedAt: string;
  summary: ReportSummaryKpi[];
}

export interface ReportFilterOption {
  id: string;
  code: string;
  label: string;
}

export interface ReportFilterOptionsResponse {
  groups: ReportFilterOption[];
  teachers: ReportFilterOption[];
  students: ReportFilterOption[];
}

export interface NormalizedReportPagination {
  page: number;
  limit: number;
  offset: number;
  isExport: boolean;
}
