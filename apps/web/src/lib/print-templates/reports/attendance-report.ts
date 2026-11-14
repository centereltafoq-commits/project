import { ReportPrintContext, ReportTemplateResult } from './report-print-types';
import {
  renderHeaderBanner,
  renderKpisGrid,
  renderOfficialFooter,
} from './report-template-helper';

export function renderAttendanceReport(ctx: ReportPrintContext): ReportTemplateResult {
  const rowsHtml =
    ctx.rows.length > 0
      ? ctx.rows
          .map(
            (r, idx) => `
        <tr>
          <td style="width: 35px; text-align: center;">${idx + 1}</td>
          <td style="font-family: monospace; font-weight: bold; text-align: center; color: #1e3a8a;">${r.studentCode || '—'}</td>
          <td style="font-weight: 700; color: #0f172a;">${r.studentName || r.fullName || '—'}</td>
          <td style="font-weight: 600; color: #334155;">${r.groupName || '—'}</td>
          <td style="text-align: center; font-weight: bold; color: #166534; background: #f0fdf4;">${r.presentCount ?? 0}</td>
          <td style="text-align: center; font-weight: bold; color: #991b1b; background: #fef2f2;">${r.absentCount ?? 0}</td>
          <td style="text-align: center; font-weight: bold; color: #854d0e; background: #fefce8;">${r.excusedCount ?? 0}</td>
          <td style="text-align: center; font-weight: 800;">
            <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; ${
              Number(r.attendanceRate ?? 0) >= 80
                ? 'background: #dcfce7; color: #166534;'
                : Number(r.attendanceRate ?? 0) >= 50
                  ? 'background: #fef9c3; color: #854d0e;'
                  : 'background: #fee2e2; color: #991b1b;'
            }">
              ${r.attendanceRate ?? 0}%
            </span>
          </td>
        </tr>
      `,
          )
          .join('')
      : `
        <tr>
          <td colspan="8" style="text-align: center; color: #64748b; padding: 18px;">
            لا توجد بيانات حضور مسجلة مطابقة لمعايير البحث
          </td>
        </tr>
      `;

  const bodyHtml = `
    <div>
      ${renderHeaderBanner(ctx, { customSubtitle: 'تقرير المتابعة والانضباط الأكاديمي للحصص والمجموعات' })}
      ${renderKpisGrid(ctx)}

      <div style="margin: 12px 0;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: 6px;">
          <span>إجمالي الطلاب المسجلين بالتقرير: <strong>${ctx.rows.length} طالب</strong></span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">م</th>
              <th style="width: 85px; text-align: center;">كود الطالب</th>
              <th>اسم الطالب</th>
              <th style="width: 140px;">المجموعة الدراسية</th>
              <th style="width: 65px; text-align: center; color: #166534;">حضور</th>
              <th style="width: 65px; text-align: center; color: #991b1b;">غياب</th>
              <th style="width: 65px; text-align: center; color: #854d0e;">بعذر</th>
              <th style="width: 85px; text-align: center;">نسبة الانضباط</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      ${renderOfficialFooter('تقرير الحضور والغياب الأكاديمي للطلاب')}
    </div>
  `;

  return { bodyHtml, orientation: 'landscape' };
}

