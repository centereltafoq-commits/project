import { formatCurrency, formatYearMonthAr } from '@/lib/formatters';
import { ReportPrintContext, ReportTemplateResult } from './report-print-types';
import {
  renderHeaderBanner,
  renderKpisGrid,
  renderOfficialFooter,
} from './report-template-helper';

export function renderAssistantStatementReport(ctx: ReportPrintContext): ReportTemplateResult {
  const currencySymbol = ctx.settings.currencySymbol || 'ج.م';

  const rowsHtml =
    ctx.rows.length > 0
      ? ctx.rows
          .map((r, idx) => {
            const dues = Number(r.totalDues ?? 0);
            const paid = Number(r.totalPaidOut ?? 0);
            const remaining = Number(r.remainingBalance ?? dues - paid);
            const ymDisplay = r.yearMonth ? formatYearMonthAr(String(r.yearMonth)) : '—';

            return `
        <tr>
          <td style="width: 35px; text-align: center;">${idx + 1}</td>
          <td style="font-family: monospace; font-weight: bold; text-align: center; color: #1e3a8a;">${r.assistantCode || '—'}</td>
          <td style="font-weight: 700; color: #0f172a;">${r.assistantName || '—'}</td>
          <td style="font-size: 11px; text-align: center;">${ymDisplay}</td>
          <td style="text-align: center; font-size: 11px;">
            <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0;">
              ${r.calculationMethodAr || 'راتب شهري ثنائي'}
            </span>
          </td>
          <td style="font-weight: bold; text-align: left; color: #0f172a;">${formatCurrency(dues, currencySymbol)}</td>
          <td style="font-weight: bold; text-align: left; color: #166534;">${formatCurrency(paid, currencySymbol)}</td>
          <td style="text-align: left;">
            <span style="font-weight: 800; padding: 2px 6px; border-radius: 4px; ${
              remaining > 0 ? 'background: #fef3c7; color: #92400e;' : 'background: #dcfce7; color: #166534;'
            }">
              ${formatCurrency(remaining, currencySymbol)}
            </span>
          </td>
        </tr>
      `;
          })
          .join('')
      : `
        <tr>
          <td colspan="8" style="text-align: center; color: #64748b; padding: 18px;">
            لا توجد مستحقات للمساعدين مسجلة مطابقة لمعايير البحث
          </td>
        </tr>
      `;

  const bodyHtml = `
    <div>
      ${renderHeaderBanner(ctx, { customSubtitle: 'مسير مستحقات وأجور المساعدين وإثبات صرف المكافآت' })}
      ${renderKpisGrid(ctx)}

      <div style="margin: 12px 0;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: 6px;">
          <span>إجمالي المساعدين بالمسير: <strong>${ctx.rows.length} مساعد</strong></span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">م</th>
              <th style="width: 85px; text-align: center;">كود المساعد</th>
              <th>اسم المساعد</th>
              <th style="width: 100px; text-align: center;">الشهر</th>
              <th style="width: 130px; text-align: center;">طريقة الحساب</th>
              <th style="width: 110px; text-align: left;">المستحق</th>
              <th style="width: 110px; text-align: left;">المنصرف</th>
              <th style="width: 115px; text-align: left;">المتبقي طرف السنتر</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      ${renderOfficialFooter('مسير أجور ومستحقات المساعدين')}
    </div>
  `;

  return { bodyHtml, orientation: 'landscape' };
}

