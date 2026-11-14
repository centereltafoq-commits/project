import { formatCurrency, formatYearMonthAr } from '@/lib/formatters';
import { ReportPrintContext, ReportTemplateResult } from './report-print-types';
import {
  renderHeaderBanner,
  renderKpisGrid,
  renderOfficialFooter,
} from './report-template-helper';

export function renderTeacherStatementReport(ctx: ReportPrintContext): ReportTemplateResult {
  const currencySymbol = ctx.settings.currencySymbol || 'ج.م';

  const rowsHtml =
    ctx.rows.length > 0
      ? ctx.rows
          .map((r, idx) => {
            const dues = Number(r.totalDues ?? r.grossRevenue ?? 0);
            const paid = Number(r.totalPaidOut ?? r.paidAmount ?? 0);
            const remaining = Number(r.remainingBalance ?? dues - paid);
            const ymDisplay = r.yearMonth ? formatYearMonthAr(String(r.yearMonth)) : '—';

            return `
        <tr>
          <td style="width: 35px; text-align: center;">${idx + 1}</td>
          <td style="font-family: monospace; font-weight: bold; text-align: center; color: #1e3a8a;">${r.teacherCode || '—'}</td>
          <td style="font-weight: 700; color: #0f172a;">${r.teacherName || '—'}</td>
          <td style="font-size: 11px; text-align: center;">${ymDisplay}</td>
          <td style="text-align: center; font-weight: bold;">${r.groupsCount ?? 0} مجموعات</td>
          <td style="text-align: center; font-weight: bold;">${r.executedSessionsCount ?? 0} حصة</td>
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
          <td colspan="9" style="text-align: center; color: #64748b; padding: 18px;">
            لا توجد مستحقات للمدرسين مسجلة مطابقة لمعايير البحث
          </td>
        </tr>
      `;

  const bodyHtml = `
    <div>
      ${renderHeaderBanner(ctx, { customSubtitle: 'كشف حساب مستحقات وتسويات أتعاب المدرسين والمنصرف الفعلي' })}
      ${renderKpisGrid(ctx)}

      <div style="margin: 12px 0;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: 6px;">
          <span>إجمالي تسويات المدرسين: <strong>${ctx.rows.length} مدرس</strong></span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">م</th>
              <th style="width: 85px; text-align: center;">كود المدرس</th>
              <th>اسم المدرس</th>
              <th style="width: 100px; text-align: center;">الشهر</th>
              <th style="width: 85px; text-align: center;">المجموعات</th>
              <th style="width: 85px; text-align: center;">الحصص</th>
              <th style="width: 110px; text-align: left;">إجمالي المستحق</th>
              <th style="width: 110px; text-align: left;">المنصرف</th>
              <th style="width: 115px; text-align: left;">المتبقي طرف السنتر</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      ${renderOfficialFooter('كشف مستحقات وتسويات أعضاء هيئة التدريس')}
    </div>
  `;

  return { bodyHtml, orientation: 'landscape' };
}

