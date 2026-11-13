import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Upload,
  XCircle,
} from 'lucide-react';
import { Badge, Button, Modal, useToast } from '@/design-system';
import { confirmAction } from '@/lib/alerts';
import { apiClient, extractErrorMessage } from '@/lib/api-client';
import { downloadBlobFile } from '@/lib/file-download';

export type DuplicateImportStrategy = 'skip' | 'error';

export interface ExcelImportPreviewRow {
  rowNumber: number;
  status: 'valid' | 'skip' | 'error';
  data: Record<string, unknown>;
  errors: string[];
  warnings: string[];
}

export interface ExcelImportPreviewResponse {
  totalRows: number;
  validCount: number;
  skippedCount: number;
  errorCount: number;
  warningCount: number;
  rows: ExcelImportPreviewRow[];
}

export interface ExcelImportCommitResponse {
  importedCount: number;
  skippedCount: number;
  failedCount: number;
}

export interface ExcelImportColumnPreview {
  key: string;
  label: string;
  dir?: 'ltr' | 'rtl';
}

export interface ExcelImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  entityLabelPlural: string;
  templateUrl: string;
  templateFilename: string;
  previewUrl: string;
  commitUrl: string;
  previewColumns: ExcelImportColumnPreview[];
  invalidateQueryKeys: string[][];
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function ExcelImportModal({
  open,
  onOpenChange,
  title,
  entityLabelPlural,
  templateUrl,
  templateFilename,
  previewUrl,
  commitUrl,
  previewColumns,
  invalidateQueryKeys,
}: ExcelImportModalProps) {
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = React.useState<DuplicateImportStrategy>('skip');
  const [skipInvalidRows, setSkipInvalidRows] = React.useState(false);
  const [preview, setPreview] = React.useState<ExcelImportPreviewResponse | null>(null);
  const [filterTab, setFilterTab] = React.useState<'all' | 'valid' | 'error' | 'skip'>('all');
  const [isDownloadingTemplate, setIsDownloadingTemplate] = React.useState(false);
  const [isPreviewing, setIsPreviewing] = React.useState(false);
  const [isCommitting, setIsCommitting] = React.useState(false);
  const [clientFileError, setClientFileError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setPreview(null);
      setDuplicateStrategy('skip');
      setSkipInvalidRows(false);
      setFilterTab('all');
      setClientFileError(null);
    }
  }, [open]);

  const runPreview = React.useCallback(
    async (file: File, strategy: DuplicateImportStrategy) => {
      setIsPreviewing(true);
      setClientFileError(null);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('duplicateStrategy', strategy);

        const res = await apiClient.post<ExcelImportPreviewResponse>(previewUrl, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setPreview(res.data);
        setSkipInvalidRows(false);
        setFilterTab('all');
      } catch (err) {
        setPreview(null);
        const msg = extractErrorMessage(err);
        setClientFileError(msg);
        notify(msg, 'error');
      } finally {
        setIsPreviewing(false);
      }
    },
    [notify, previewUrl],
  );

  const handleFilePicked = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setClientFileError('يرجى اختيار ملف Excel بامتداد .xlsx فقط.');
      setSelectedFile(null);
      setPreview(null);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setClientFileError('حجم الملف يتجاوز الحد الأقصى المسموح (5 ميجابايت).');
      setSelectedFile(null);
      setPreview(null);
      return;
    }

    setSelectedFile(file);
    void runPreview(file, duplicateStrategy);
  };

  const handleStrategyChange = (strategy: DuplicateImportStrategy) => {
    setDuplicateStrategy(strategy);
    if (selectedFile) {
      void runPreview(selectedFile, strategy);
    }
  };

  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      await downloadBlobFile(
        templateUrl,
        templateFilename,
        undefined,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      notify('تم تحميل نموذج Excel الجاهز بنجاح', 'success');
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleCommit = async () => {
    if (!selectedFile || !preview || preview.validCount === 0) return;

    const confirmText =
      preview.errorCount > 0 && skipInvalidRows
        ? `سيتم استيراد ${preview.validCount} سجل صالح وتخطي ${preview.errorCount + preview.skippedCount} صفاً غير صالح أو مكرر.`
        : `سيتم استيراد ${preview.validCount} سجل إلى قائمة ${entityLabelPlural}${
            preview.skippedCount > 0 ? ` مع تخطي ${preview.skippedCount} صفاً مكرراً` : ''
          }.`;

    const confirmed = await confirmAction({
      title: `تأكيد استيراد ${entityLabelPlural}`,
      text: confirmText,
      confirmButtonText: `نعم، استيراد ${preview.validCount} سجل`,
      cancelButtonText: 'مراجعة أولاً',
      icon: 'question',
    });

    if (!confirmed) return;

    setIsCommitting(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('duplicateStrategy', duplicateStrategy);
      formData.append('skipInvalidRows', String(skipInvalidRows));

      const res = await apiClient.post<ExcelImportCommitResponse>(commitUrl, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      await Promise.all(
        invalidateQueryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );

      notify(
        `تم استيراد ${res.data.importedCount} سجل بنجاح${
          res.data.skippedCount > 0 ? ` (تخطي ${res.data.skippedCount})` : ''
        }${res.data.failedCount > 0 ? ` (مستبعد ${res.data.failedCount})` : ''}`,
        'success',
      );
      onOpenChange(false);
    } catch (err) {
      notify(extractErrorMessage(err), 'error');
    } finally {
      setIsCommitting(false);
    }
  };

  const filteredRows = React.useMemo(() => {
    if (!preview) return [];
    if (filterTab === 'all') return preview.rows;
    return preview.rows.filter((row) => row.status === filterTab);
  }, [filterTab, preview]);

  const canCommit =
    Boolean(preview) &&
    (preview?.validCount ?? 0) > 0 &&
    ((preview?.errorCount ?? 0) === 0 || skipInvalidRows) &&
    !isPreviewing &&
    !isCommitting;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={title}
      description="حمّل النموذج الرسمي المعتمد، املأ البيانات بالورقة الأولى، ثم راجع المعاينة قبل الحفظ النهائي."
    >
      <div className="space-y-5">
        {/* Step 1: Download official template */}
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <span>1. تحميل نموذج Excel الرسمي</span>
            </div>
            <p className="text-xs text-muted-foreground">
              يحتوي النموذج على الأعمدة الصحيحة، قوائم منسدلة تلقائية، وحماية للأصفار البادئة في أرقام الهواتف.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            isLoading={isDownloadingTemplate}
            onClick={handleDownloadTemplate}
            className="shrink-0 border-emerald-600/40 text-emerald-700 hover:bg-emerald-600/10 dark:text-emerald-400"
          >
            <Download className="h-4 w-4" />
            تحميل نموذج Excel الجاهز
          </Button>
        </div>

        {/* Step 2: Upload & duplicate policy */}
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-bold text-foreground">
              2. رفع الملف وتحديد سياسة الأكواد المكررة
            </span>
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => handleStrategyChange('skip')}
                className={`rounded-md px-3 py-1 font-semibold transition-colors ${
                  duplicateStrategy === 'skip'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                تخطي الأكواد الموجودة
              </button>
              <button
                type="button"
                onClick={() => handleStrategyChange('error')}
                className={`rounded-md px-3 py-1 font-semibold transition-colors ${
                  duplicateStrategy === 'error'
                    ? 'bg-destructive text-destructive-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                اعتبار المكرر خطأ
              </button>
            </div>
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFilePicked(e.dataTransfer.files?.[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/20 px-4 py-6 text-center transition-colors hover:border-primary/60 hover:bg-primary/5"
          >
            <input
              ref={fileInputRef}
              data-testid="excel-import-file-input"
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(e) => {
                handleFilePicked(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Upload className="h-7 w-7 text-primary" />
            <div className="text-sm font-bold text-foreground">
              {selectedFile
                ? selectedFile.name
                : 'اسحب ملف Excel (.xlsx) وأفلته هنا أو انقر للاختيار'}
            </div>
            <p className="text-xs text-muted-foreground">
              الصيغة المدعومة: .xlsx فقط — الحد الأقصى 2,000 صف / 5 ميجابايت
            </p>
            {isPreviewing && (
              <div className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>جارٍ فحص وتحليل الصفوف...</span>
              </div>
            )}
          </div>

          {clientFileError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              <XCircle className="h-4 w-4 shrink-0" />
              <span>{clientFileError}</span>
            </div>
          )}
        </div>

        {/* Step 3: Validation summary & preview table */}
        {preview && (
          <div className="space-y-3 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-foreground">
                3. نتيجة فحص البيانات قبل الحفظ
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="neutral">إجمالي الصفوف: {preview.totalRows}</Badge>
                <Badge variant="success">صالح للاستيراد: {preview.validCount}</Badge>
                {preview.skippedCount > 0 && (
                  <Badge variant="warning">متخطى: {preview.skippedCount}</Badge>
                )}
                <Badge variant={preview.errorCount > 0 ? 'danger' : 'neutral'}>
                  أخطاء: {preview.errorCount}
                </Badge>
              </div>
            </div>

            {/* Filter tabs */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-border pb-2 text-xs">
              {(
                [
                  { id: 'all', label: `الكل (${preview.totalRows})` },
                  { id: 'valid', label: `الصالح فقط (${preview.validCount})` },
                  { id: 'error', label: `الأخطاء فقط (${preview.errorCount})` },
                  ...(preview.skippedCount > 0
                    ? [{ id: 'skip' as const, label: `المتخطى (${preview.skippedCount})` }]
                    : []),
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
                    filterTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {preview.totalRows === 0 ? (
              <div className="rounded-lg border border-border bg-muted/20 p-6 text-center text-xs text-muted-foreground">
                الملف لا يحتوي على صفوف بيانات بعد صف العناوين.
              </div>
            ) : (
              <div className="max-h-72 overflow-auto rounded-lg border border-border">
                <table className="w-full text-right text-xs">
                  <thead className="sticky top-0 z-10 border-b border-border bg-muted/90 backdrop-blur-sm">
                    <tr>
                      <th className="px-3 py-2 font-bold text-foreground">الصف</th>
                      <th className="px-3 py-2 font-bold text-foreground">الحالة</th>
                      {previewColumns.map((col) => (
                        <th key={col.key} className="px-3 py-2 font-bold text-foreground">
                          {col.label}
                        </th>
                      ))}
                      <th className="px-3 py-2 font-bold text-foreground">ملاحظات الفحص</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredRows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={
                          row.status === 'error'
                            ? 'bg-destructive/5'
                            : row.status === 'skip'
                              ? 'bg-amber-500/5'
                              : 'hover:bg-muted/30'
                        }
                      >
                        <td className="whitespace-nowrap px-3 py-2 font-mono font-bold text-muted-foreground">
                          #{row.rowNumber}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {row.status === 'valid' && (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              صالح
                            </span>
                          )}
                          {row.status === 'skip' && (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              متخطى
                            </span>
                          )}
                          {row.status === 'error' && (
                            <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                              <XCircle className="h-3.5 w-3.5" />
                              خطأ
                            </span>
                          )}
                        </td>
                        {previewColumns.map((col) => {
                          const raw = row.data?.[col.key];
                          const text =
                            raw === null || raw === undefined || raw === ''
                              ? '—'
                              : String(raw);
                          return (
                            <td
                              key={col.key}
                              dir={col.dir}
                              className="max-w-[180px] truncate px-3 py-2 text-foreground"
                            >
                              {text}
                            </td>
                          );
                        })}
                        <td className="min-w-[200px] space-y-1 px-3 py-2">
                          {row.errors.map((errMsg, idx) => (
                            <div key={`err-${idx}`} className="font-semibold text-destructive">
                              {errMsg}
                            </div>
                          ))}
                          {row.warnings.map((warnMsg, idx) => (
                            <div key={`warn-${idx}`} className="text-amber-600 dark:text-amber-400">
                              {warnMsg}
                            </div>
                          ))}
                          {row.errors.length === 0 && row.warnings.length === 0 && (
                            <span className="text-muted-foreground">جاهز للاستيراد</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {preview.errorCount > 0 && preview.validCount > 0 && (
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                <input
                  type="checkbox"
                  checked={skipInvalidRows}
                  onChange={(e) => setSkipInvalidRows(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <span>
                  استيراد الصفوف الصالحة فقط ({preview.validCount} صف) وتخطي صفوف الأخطاء ({preview.errorCount} صف)
                </span>
              </label>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!canCommit}
            isLoading={isCommitting}
            onClick={handleCommit}
          >
            تنفيذ الاستيراد{preview?.validCount ? ` (${preview.validCount})` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
