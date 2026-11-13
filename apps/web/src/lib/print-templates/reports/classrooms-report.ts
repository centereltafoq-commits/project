import { ReportPrintContext, ReportTemplateResult } from './report-print-types';
import {
  renderHeaderBanner,
  renderKpisGrid,
  renderOfficialFooter,
  renderSignaturesRow,
} from './report-template-helper';

export function renderClassroomsReport(ctx: ReportPrintContext): ReportTemplateResult {
  const rowsHtml =
    ctx.rows.length > 0
      ? ctx.rows
          .map(
            (r, idx) => `
        <tr>
          <td style="width: 35px; text-align: center;">${idx + 1}</td>
          <td style="font-family: monospace; font-weight: bold; text-align: center; color: #1e3a8a;">${r.roomNumber || idx + 1}</td>
          <td style="font-weight: 700; color: #0f172a;">${r.name || 'قاعة دراسية'}</td>
          <td style="text-align: center; font-weight: 800; color: #047857;">${r.maxCapacity ?? 0} مقعد</td>
          <td style="text-align: center;">
            <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; ${
              r.status === 'AVAILABLE' || r.statusAr === 'متاحة'
                ? 'background: #dcfce7; color: #166534;'
                : r.status === 'OCCUPIED' || r.statusAr === 'مشغولة'
                  ? 'background: #eff6ff; color: #1e40af;'
                  : 'background: #fee2e2; color: #991b1b;'
            }">
              ${r.statusAr || r.status || 'متاحة'}
            </span>
          </td>
          <td style="text-align: center; font-weight: bold;">${r.sessionsCount ?? 0} حصة</td>
          <td style="text-align: center; font-weight: bold;">${r.confirmedBookingsCount ?? 0} حجز</td>
        </tr>
      `,
          )
          .join('')
      : `
        <tr>
          <td colspan="7" style="text-align: center; color: #64748b; padding: 18px;">
            لا توجد بيانات قاعات مسجلة مطابقة لمعايير البحث
          </td>
        </tr>
      `;

  const bodyHtml = `
    <div>
      ${renderHeaderBanner(ctx, { customSubtitle: 'سجل الطاقة الاستيعابية وتجهيزات القاعات ومعدلات التشغيل الأسبوعية' })}
      ${renderKpisGrid(ctx)}

      <div style="margin: 12px 0;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: 6px;">
          <span>إجمالي القاعات بالقائمة: <strong>${ctx.rows.length} قاعة</strong></span>
          <span>سجل مرافق وتجهيزات تعليمية معتمد لإدارة السنتر</span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">م</th>
              <th style="width: 80px; text-align: center;">رقم القاعة</th>
              <th>اسم القاعة</th>
              <th style="width: 100px; text-align: center;">السعة القصوى</th>
              <th style="width: 90px; text-align: center;">الحالة</th>
              <th style="width: 90px; text-align: center;">الحصص</th>
              <th style="width: 100px; text-align: center;">الحجوزات</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      ${renderSignaturesRow([
        { title: 'مسؤول الصيانة والمرافق', subtitle: 'فحص التجهيزات والسلامة' },
        { title: 'مشرف التشغيل', subtitle: 'إدارة جداول القاعات' },
      ])}

      ${renderOfficialFooter('سجل رسمي للطاقة الاستيعابية ومرافق السنتر التعليمي')}
    </div>
  `;

  return { bodyHtml, orientation: 'portrait' };
}

