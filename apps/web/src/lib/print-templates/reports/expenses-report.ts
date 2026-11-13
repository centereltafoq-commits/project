import { formatCurrency, formatDateAr } from '@/lib/formatters';
import { ReportPrintContext, ReportTemplateResult } from './report-print-types';
import {
  renderHeaderBanner,
  renderKpisGrid,
  renderOfficialFooter,
  renderSignaturesRow,
} from './report-template-helper';

export function renderExpensesReport(ctx: ReportPrintContext): ReportTemplateResult {
  const currencySymbol = ctx.settings.currencySymbol || 'ج.م';

  const rowsHtml =
    ctx.rows.length > 0
      ? ctx.rows
          .map((r, idx) => {
            const amount = Number(r.amount ?? 0);
            const dateDisplay = r.expenseDate ? formatDateAr(r.expenseDate) : '—';

            return `
        <tr>
          <td style="width: 35px; text-align: center;">${idx + 1}</td>
          <td style="font-size: 11px; text-align: center;">${dateDisplay}</td>
          <td style="font-weight: 700; color: #1e3a8a;">
            <span style="background: #eff6ff; padding: 2px 8px; border-radius: 4px; border: 1px solid #bfdbfe;">
              ${r.categoryAr || r.category || 'نثريات وتشغيل'}
            </span>
          </td>
          <td style="font-size: 11px; color: #0f172a; font-weight: 600;">${r.title || r.description || '—'}</td>
          <td style="font-weight: 800; text-align: left; color: #b91c1c; font-size: 12px;">${formatCurrency(amount, currencySymbol)}</td>
          <td style="text-align: center; font-size: 11px;">
            <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1;">
              ${r.paymentMethodAr || r.paymentMethod || 'نقدي'}
            </span>
          </td>
          <td style="font-size: 11px; color: #475569;">${r.recordedByName || 'المسؤول الإداري'}</td>
        </tr>
      `;
          })
          .join('')
      : `
        <tr>
          <td colspan="7" style="text-align: center; color: #64748b; padding: 18px;">
            لا توجد مصروفات تشغيلية مسجلة مطابقة لمعايير البحث
          </td>
        </tr>
      `;

  const bodyHtml = `
    <div>
      ${renderHeaderBanner(ctx, { customSubtitle: 'سجل يومية المصروفات والنثريات والمدفوعات التشغيلية المعتمدة' })}
      ${renderKpisGrid(ctx)}

      <div style="margin: 12px 0;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: 6px;">
          <span>إجمالي سندات الصرف بالقائمة: <strong>${ctx.rows.length} سند</strong></span>
          <span>سجل مصروفات ونفقات رسمي مطابق لفواتير ومستندات الصرف</span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">م</th>
              <th style="width: 100px; text-align: center;">تاريخ الصرف</th>
              <th style="width: 130px;">بند المصروف</th>
              <th>البيان / الوصف</th>
              <th style="width: 120px; text-align: left; color: #991b1b;">المبلغ المنصرف</th>
              <th style="width: 100px; text-align: center;">طريقة السداد</th>
              <th style="width: 120px;">القائم بالصرف</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      ${renderSignaturesRow([
        { title: 'المحاسب القائم بالصرف', subtitle: 'إعداد ومطابقة الفاتورة' },
        { title: 'المدير المالي والتنفيذي', subtitle: 'اعتماد سندات الصرف' },
      ])}

      ${renderOfficialFooter('سجل رسمي لإثبات سندات الصرف والمصروفات التشغيلية المعتمدة')}
    </div>
  `;

  return { bodyHtml, orientation: 'landscape' };
}

