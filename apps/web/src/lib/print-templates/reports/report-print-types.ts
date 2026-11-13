import { CenterSettings } from '@/features/settings/settings.types';
import { ReportSummaryKpiItem, ReportTypeSlug } from '@/features/reports/reports.types';
export { type ReportTypeSlug };

export interface ReportPrintContext {
  slug: ReportTypeSlug;
  title: string;
  yearMonth?: string;
  filterSummary?: string;
  summary: ReportSummaryKpiItem[];
  rows: Array<Record<string, any>>;
  settings: Partial<CenterSettings>;
}

export interface ReportTemplateResult {
  bodyHtml: string;
  orientation: 'portrait' | 'landscape';
}

