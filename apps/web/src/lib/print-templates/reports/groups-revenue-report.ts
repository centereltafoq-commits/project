import { formatCurrency } from '@/lib/formatters';
import { ReportPrintContext, ReportTemplateResult } from './report-print-types';
import {
  renderHeaderBanner,
  renderKpisGrid,
  renderOfficialFooter,
} from './report-template-helper';

export function renderGroupsRevenueReport(ctx: ReportPrintContext): ReportTemplateResult {
  const currencySymbol = ctx.settings.currencySymbol || 'ج.م';

  const rowsHtml =
    ctx.rows.length > 0
      ? ctx.rows
          .map((r, idx) => {
            const gross = Number(r.grossRevenue ?? 0);
            const teacherShare = Number(r.teacherShare ?? 0);
            const centerShare = Number(r.centerShare ?? 0);

            return `
        <tr>
          <td style="width: 35px; text-align: center;">${idx + 1}</td>
          <td style="font-family: monospace; font-weight: bold; text-align: center; color: #1e3a8a;">${r.groupCode || '—'}</td>
          <td style="font-weight: 700; color: #0f172a;">${r.groupName || '—'}</td>
          <td style="font-weight: 600; color: #334155;">${r.teacherName || '—'}</td>
          <td style="text-align: center; font-weight: bold;">${r.studentsCount ?? 0} طالب</td>
          <td style="font-weight: bold; text-align: left; color: #0f172a;">${formatCurrency(gross, currencySymbol)}</td>
          <td style="font-weight: bold; text-align: left; color: #d97706;">${formatCurrency(teacherShare, currencySymbol)}</td>
          <td style="font-weight: bold; text-align: left; color: #059669;">${formatCurrency(centerShare, currencySymbol)}</td>
        </tr>
      `;
          })
          .join('')
      : `
        <tr>
          <td colspan="8" style="text-align: center; color: #64748b; padding: 18px;">
            لا توجد إيرادات مسجلة للمجموعات مطابقة لمعايير البحث
          </td>
        </tr>
      `;

  const bodyHtml = `
    <div>
      ${renderHeaderBanner(ctx, { customSubtitle: 'تقرير إيرادات المجموعات وتوزيع الأنصبة التعاقدية بين السنتر والمدرسين' })}
      ${renderKpisGrid(ctx)}

      <div style="margin: 12px 0;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: 6px;">
          <span>إجمالي المجموعات المحتسبة: <strong>${ctx.rows.length} مجموعة</strong></span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">م</th>
              <th style="width: 85px; text-align: center;">كود المجموعة</th>
              <th>اسم المجموعة</th>
              <th>المدرس المسؤول</th>
              <th style="width: 80px; text-align: center;">الطلاب</th>
              <th style="width: 120px; text-align: left;">إجمالي الإيراد</th>
              <th style="width: 120px; text-align: left; color: #b45309;">نصيب المدرس</th>
              <th style="width: 120px; text-align: left; color: #047857;">نصيب السنتر</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      ${renderOfficialFooter('تقرير توزيع إيرادات الحصص والمجموعات')}
    </div>
  `;

  return { bodyHtml, orientation: 'landscape' };
}

