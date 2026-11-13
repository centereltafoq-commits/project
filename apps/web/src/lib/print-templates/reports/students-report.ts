import { ReportPrintContext, ReportTemplateResult } from './report-print-types';
import {
  renderHeaderBanner,
  renderKpisGrid,
  renderOfficialFooter,
  renderSignaturesRow,
} from './report-template-helper';

export function renderStudentsReport(ctx: ReportPrintContext): ReportTemplateResult {
  const rowsHtml =
    ctx.rows.length > 0
      ? ctx.rows
          .map(
            (r, idx) => `
        <tr>
          <td style="width: 35px; text-align: center;">${idx + 1}</td>
          <td style="font-family: monospace; font-weight: bold; text-align: center; color: #1e3a8a;">${r.studentCode || '—'}</td>
          <td style="font-weight: 700; color: #0f172a;">${r.fullName || r.studentName || '—'}</td>
          <td style="font-family: monospace; font-size: 10px; color: #334155;">${r.phone || '—'}</td>
          <td style="font-family: monospace; font-size: 10px; color: #334155;">${r.guardianPhone || '—'}</td>
          <td style="font-size: 11px;">${r.gradeLevel || '—'}</td>
          <td style="text-align: center;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: bold; ${
              r.status === 'ACTIVE' || r.statusAr === 'نشط'
                ? 'background: #dcfce7; color: #166534; border: 1px solid #86efac;'
                : r.status === 'SUSPENDED' || r.statusAr === 'موقوف'
                  ? 'background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5;'
                  : 'background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;'
            }">
              ${r.statusAr || (r.status === 'ACTIVE' ? 'نشط' : r.status === 'SUSPENDED' ? 'موقوف' : 'معلق')}
            </span>
          </td>
          <td style="text-align: center; font-weight: bold;">${r.activeGroupsCount ?? 0} مجموعات</td>
        </tr>
      `,
          )
          .join('')
      : `
        <tr>
          <td colspan="8" style="text-align: center; color: #64748b; padding: 18px;">
            لا توجد بيانات طلاب مطابقة لمعايير البحث
          </td>
        </tr>
      `;

  const bodyHtml = `
    <div>
      ${renderHeaderBanner(ctx, { customSubtitle: 'سجل قيد وبيانات الطلاب والمجموعات الدراسية' })}
      ${renderKpisGrid(ctx)}

      <div style="margin: 12px 0;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: 6px;">
          <span>إجمالي الطلاب بالقائمة: <strong>${ctx.rows.length} طالب</strong></span>
          <span>سجل معتمد لشؤون الطلاب وقيد المراحل التعليمية</span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">م</th>
              <th style="width: 85px; text-align: center;">كود الطالب</th>
              <th>اسم الطالب بالكامل</th>
              <th style="width: 105px;">هاتف الطالب</th>
              <th style="width: 105px;">هاتف ولي الأمر</th>
              <th style="width: 120px;">المرحلة الدراسية</th>
              <th style="width: 80px; text-align: center;">الحالة</th>
              <th style="width: 90px; text-align: center;">المجموعات</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      ${renderSignaturesRow([
        { title: 'مسؤول شؤون الطلاب', subtitle: 'مراجعة بيانات القيد' },
        { title: 'المشرف الأكاديمي', subtitle: 'اعتماد الملف التعليمي' },
      ])}

      ${renderOfficialFooter('سجل قيد طلاب رسمي معتمد بفرع السنتر التعليمي')}
    </div>
  `;

  return { bodyHtml, orientation: 'landscape' };
}

