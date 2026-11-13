import { formatCurrency, formatDateAr, formatYearMonthAr } from '@/lib/formatters';
import { ReportPrintContext, ReportTemplateResult } from './report-print-types';
import {
  renderHeaderBanner,
  renderKpisGrid,
  renderOfficialFooter,
  renderSignaturesRow,
} from './report-template-helper';

export function renderCollectionsReport(ctx: ReportPrintContext): ReportTemplateResult {
  const currencySymbol = ctx.settings.currencySymbol || 'ج.م';

  const rowsHtml =
    ctx.rows.length > 0
      ? ctx.rows
          .map((r, idx) => {
            const amount = Number(r.amount ?? 0);
            const dateDisplay = r.paymentDate ? formatDateAr(r.paymentDate) : '—';
            const ymDisplay = r.yearMonth ? formatYearMonthAr(String(r.yearMonth)) : '—';

            return `
        <tr>
          <td style="width: 35px; text-align: center;">${idx + 1}</td>
          <td style="font-family: monospace; font-weight: bold; text-align: center; color: #1e3a8a;">${r.receiptNumber || '—'}</td>
          <td style="font-size: 11px; text-align: center;">${dateDisplay}</td>
          <td style="font-weight: 700; color: #0f172a;">${r.studentName || '—'}</td>
          <td style="font-size: 11px; text-align: center;">${ymDisplay}</td>
          <td style="font-weight: 800; text-align: left; color: #047857; font-size: 12px;">${formatCurrency(amount, currencySymbol)}</td>
          <td style="text-align: center; font-size: 11px;">
            <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1; font-weight: 600;">
              ${r.paymentMethodAr || r.paymentMethod || 'نقدي'}
            </span>
          </td>
          <td style="font-size: 11px; color: #334155;">${r.collectorName || r.receivedByName || 'الخزينة العامة'}</td>
        </tr>
      `;
          })
          .join('')
      : `
        <tr>
          <td colspan="8" style="text-align: center; color: #64748b; padding: 18px;">
            لا توجد سندات تحصيل مسجلة مطابقة لمعايير البحث
          </td>
        </tr>
      `;

  const bodyHtml = `
    <div>
      ${renderHeaderBanner(ctx, { customSubtitle: 'سجل يومية المقبوضات وسندات التحصيل وتدفقات الخزينة' })}
      ${renderKpisGrid(ctx)}

      <div style="margin: 12px 0;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: 6px;">
          <span>إجمالي سندات التحصيل بالقائمة: <strong>${ctx.rows.length} إيصال</strong></span>
          <span>سجل مقبوضات رسمي مطابق لقيود الخزينة والحسابات البنكية</span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">م</th>
              <th style="width: 90px; text-align: center;">رقم الإيصال</th>
              <th style="width: 100px; text-align: center;">تاريخ السداد</th>
              <th>اسم الطالب</th>
              <th style="width: 100px; text-align: center;">شهر الاستحقاق</th>
              <th style="width: 110px; text-align: left;">المبلغ المحصل</th>
              <th style="width: 100px; text-align: center;">طريقة الدفع</th>
              <th style="width: 120px;">المحصّل / الخزينة</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      ${renderSignaturesRow([
        { title: 'أمين الخزينة', subtitle: 'استلام النقدية والتحصيلات' },
        { title: 'المراجع المالي', subtitle: 'مطابقة الإيرادات والقيود' },
      ])}

      ${renderOfficialFooter('سجل رسمي لإثبات سندات التحصيل والمقبوضات النقدية والإلكترونية')}
    </div>
  `;

  return { bodyHtml, orientation: 'landscape' };
}

