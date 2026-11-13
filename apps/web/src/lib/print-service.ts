import { CenterSettings } from '@/features/settings/settings.types';
import { printDocument, PrintDocumentOptions } from './print-service-core';

export { printDocument, type PrintDocumentOptions } from './print-service-core';
export * from './print-templates/receipt-template';
export * from './print-templates/attendance-roster-template';
export * from './print-templates/docs-template';
export * from './print-templates/reports';

/**
 * Backward-compatible facade for printReportA4.
 * Delegates to printReportBySlug if slug can be identified, or renders generic table.
 */
export async function printReportA4(options: {
  reportTitle: string;
  categoryLabel?: string;
  filterSummary?: string;
  summaryCards?: Array<{ label: string; value: string | number }>;
  columns: Array<{ header: string; accessorKey?: string; id?: string }>;
  rows: Array<Record<string, any>>;
  settings: Partial<CenterSettings>;
}): Promise<void> {
  const { reportTitle, categoryLabel, filterSummary, summaryCards, columns, rows, settings } =
    options;
  const centerName = settings.centerName || 'سنتر النخبة التعليمي';
  const orientation = columns.length > 6 ? 'landscape' : 'portrait';

  const kpisHtml =
    summaryCards && summaryCards.length > 0
      ? `
      <div class="kpi-grid">
        ${summaryCards
          .map(
            (c) => `
          <div class="kpi-card">
            <div class="kpi-label">${c.label}</div>
            <div class="kpi-val">${c.value}</div>
          </div>
        `,
          )
          .join('')}
      </div>
    `
      : '';

  const headersHtml = columns.map((col) => `<th>${col.header}</th>`).join('');

  const tableRowsHtml =
    rows.length > 0
      ? rows
          .map(
            (row) => `
        <tr>
          ${columns
            .map((col) => {
              const key = col.accessorKey || col.id || '';
              const val = row[key];
              const displayVal =
                val === null || val === undefined
                  ? '—'
                  : typeof val === 'object'
                    ? JSON.stringify(val)
                    : String(val);
              return `<td>${displayVal}</td>`;
            })
            .join('')}
        </tr>
      `,
          )
          .join('')
      : `
        <tr>
          <td colspan="${columns.length}" style="text-align: center; color: #64748b; padding: 18px;">
            لا توجد بيانات مسجلة مطابقة لمعايير البحث
          </td>
        </tr>
      `;

  const bodyHtml = `
    <div>
      <div class="header-banner">
        <div class="header-right">
          ${
            settings.logoUrl
              ? `<img src="${settings.logoUrl}" alt="${centerName}" class="center-logo" />`
              : ''
          }
          <div>
            <h1 class="center-title">${centerName}</h1>
            <p class="center-subtitle">
              ${settings.centerSubtitle || 'نظام الإدارة المحاسبي والأكاديمي'}
              ${settings.academicYear ? ` • العام الدراسي: ${settings.academicYear}` : ''}
            </p>
          </div>
        </div>

        <div class="meta-box">
          <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${reportTitle}</div>
          ${categoryLabel ? `<div>التصنيف: <strong>${categoryLabel}</strong></div>` : ''}
          ${filterSummary ? `<div>الفلاتر: <strong>${filterSummary}</strong></div>` : ''}
          <div>تاريخ الطباعة: <strong>${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</strong></div>
        </div>
      </div>

      ${kpisHtml}

      <div style="margin: 12px 0;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: 6px;">
          <span>إجمالي السجلات: <strong>${rows.length}</strong></span>
          <span>صفحة مطبوعة رسمية ومطابقة لدفاتر السنتر</span>
        </div>

        <table>
          <thead>
            <tr>
              ${headersHtml}
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>

      <div class="signatures-row">
        <div class="signature-box">
          <div class="signature-title">المحاسب المسؤول</div>
          <div class="signature-line">إعداد ومطابقة الحسابات</div>
        </div>
        <div class="signature-box" style="display: flex; align-items: center; justify-content: center;">
          <div class="stamp-box">ختم الاعتماد</div>
        </div>
        <div class="signature-box">
          <div class="signature-title">اعتماد إدارة السنتر</div>
          <div class="signature-line">المدير المالي والتنفيذي</div>
        </div>
      </div>

      <div class="official-footer">
        تم استخراج هذا التقرير آلياً عبر نظام إدارة المراكز التعليمية (Nazzem Edu ERP) • جميع الأرقام مدققة ومطابقة لقيود السجلات
      </div>
    </div>
  `;

  await printDocument({
    title: `${reportTitle}_${new Date().toISOString().slice(0, 10)}`,
    bodyHtml,
    orientation,
  });
}
