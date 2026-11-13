export type DuplicateImportStrategy = 'skip' | 'error';

export type ExcelImportRowStatus = 'valid' | 'skip' | 'error';

export interface ExcelImportPreviewRow<T = Record<string, unknown>> {
  rowNumber: number;
  status: ExcelImportRowStatus;
  data: T;
  errors: string[];
  warnings: string[];
}

export interface ExcelImportPreviewResponse<T = Record<string, unknown>> {
  totalRows: number;
  validCount: number;
  skippedCount: number;
  errorCount: number;
  warningCount: number;
  rows: ExcelImportPreviewRow<T>[];
}

export interface ExcelImportCommitResponse {
  importedCount: number;
  skippedCount: number;
  failedCount: number;
}

export interface ExcelColumnSpec {
  key: string;
  header: string;
  width?: number;
  numFmt?: string;
  dropdownValues?: string[];
}

export interface WorkbookInstructionsSpec {
  sheetName?: string;
  title: string;
  lines: string[];
  sampleHeaders?: string[];
  sampleRow?: unknown[];
  referenceLists?: Array<{ title: string; items: string[] }>;
}

export interface WorkbookBuildSpec {
  sheetName: string;
  columns: ExcelColumnSpec[];
  rows: Array<Record<string, unknown>>;
  validationRowCount?: number;
  instructionsSheet?: WorkbookInstructionsSpec;
}

export interface ParsedExcelRow {
  rowNumber: number;
  cells: Record<string, unknown>;
}

export interface ParsedExcelSheet {
  sheetName: string;
  headers: string[];
  rows: ParsedExcelRow[];
}

export interface ParseSheetOptions {
  maxRows?: number;
}

