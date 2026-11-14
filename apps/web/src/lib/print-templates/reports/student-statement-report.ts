import { formatCurrency, formatYearMonthAr } from '@/lib/formatters';
import { ReportPrintContext, ReportTemplateResult } from './report-print-types';
import {
  renderHeaderBanner,
  renderKpisGrid,
  renderOfficialFooter,
} from './report-template-helper';

export function renderStudentStatementReport(ctx: ReportPrintContext): ReportTemplateResult {
  const currencySymbol = ctx.settings.currencySymbol || 'ج.م';

  const rowsHtml =
    ctx.rows.length > 0
      ? ctx.rows
          .map((r, idx) => {
            const due = Number(r.totalDue ?? 0);
            const paid = Number(r.totalPaid ?? 0);
            const remaining = Number(r.remainingBalance ?? due - paid);
            const ymDisplay = r.yearMonth ? formatYearMonthAr(String(r.yearMonth)) : '—';

            return `
        <tr>
          <td style="width: 35px; text-align: center;">${idx + 1}</td>
          <td style="font-family: monospace; font-weight: bold; text-align: center; color: #1e3a8a;">${r.studentCode || '—'}</td>
          <td style="font-weight: 700; color: #0f172a;">${r.studentName || '—'}</td>
          <td style="font-weight: 600; color: #334155;">${r.groupName || '—'}</td>
          <td style="font-size: 11px; text-align: center;">${ymDisplay}</td>
          <td style="font-weight: bold; text-align: left; color: #0f172a;">${formatCurrency(due, currencySymbol)}</td>
          <td style="font-weight: bold; text-align: left; color: #166534;">${formatCurrency(paid, currencySymbol)}</td>
          <td style="text-align: left;">
            <span style="font-weight: 800; padding: 2px 6px; border-radius: 4px; ${
              remaining > 0 ? 'background: #fee2e2; color: #991b1b;' : 'background: #dcfce7; color: #166534;'
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
            لا توجد مستحقات أو مطالبات مالية مسجلة مطابقة لمعايير البحث
          </td>
        </tr>
      `;

  const bodyHtml = `
    <div>
      ${renderHeaderBanner(ctx, { customSubtitle: 'كشف حساب مستحقات ومدفوعات الطلاب الشهرية والذمم المدينة' })}
      ${renderKpisGrid(ctx)}

      <div style="margin: 12px 0;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: 6px;">
          <span>إجمالي المطالبات المسجلة: <strong>${ctx.rows.length} سجل</strong></span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">م</th>
              <th style="width: 85px; text-align: center;">كود الطالب</th>
              <th>اسم الطالب</th>
              <th>المجموعة الدراسية</th>
              <th style="width: 100px; text-align: center;">الشهر</th>
              <th style="width: 110px; text-align: left;">المستحق</th>
              <th style="width: 110px; text-align: left;">المسدد</th>
              <th style="width: 115px; text-align: left;">المتبقي / المديونية</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      ${renderOfficialFooter('كشف حساب مستحقات ومدفوعات الطلاب')}
    </div>
  `;

  return { bodyHtml, orientation: 'landscape' };
}

