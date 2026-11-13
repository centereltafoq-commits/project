import { formatDateAr } from '@/lib/formatters';
import { ReportPrintContext, ReportTemplateResult } from './report-print-types';
import {
  renderHeaderBanner,
  renderKpisGrid,
  renderOfficialFooter,
  renderSignaturesRow,
} from './report-template-helper';

export function renderBookingsReport(ctx: ReportPrintContext): ReportTemplateResult {
  const rowsHtml =
    ctx.rows.length > 0
      ? ctx.rows
          .map((r, idx) => {
            const dateDisplay = r.requestedDate ? formatDateAr(r.requestedDate) : '—';

            return `
        <tr>
          <td style="width: 35px; text-align: center;">${idx + 1}</td>
          <td style="font-weight: 700; color: #1e3a8a; text-align: center;">
            <span style="background: #eff6ff; padding: 2px 6px; border-radius: 4px; font-size: 11px;">
              ${r.requestTypeAr || 'حجز قاعة'}
            </span>
          </td>
          <td style="font-weight: 700; color: #0f172a;">${r.partyLabel || r.teacherName || r.studentName || '—'}</td>
          <td style="font-size: 11px; color: #334155;">${r.purpose || 'نشاط تعليمي / حصة'}</td>
          <td style="font-size: 11px; text-align: center;">${dateDisplay}</td>
          <td style="font-family: monospace; font-size: 11px; text-align: center; color: #0f172a;">${r.timeSlot || '—'}</td>
          <td style="font-weight: 600; color: #047857;">${r.classroomLabel || r.classroomName || '—'}</td>
          <td style="text-align: center;">
            <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; ${
              r.status === 'CONFIRMED' || r.statusAr === 'مؤكد'
                ? 'background: #dcfce7; color: #166534;'
                : r.status === 'PENDING' || r.statusAr === 'قيد الانتظار'
                  ? 'background: #fef9c3; color: #854d0e;'
                  : r.status === 'COMPLETED' || r.statusAr === 'مكتمل'
                    ? 'background: #f3e8ff; color: #6b21a8;'
                    : 'background: #fee2e2; color: #991b1b;'
            }">
              ${r.statusAr || r.status || 'مؤكد'}
            </span>
          </td>
        </tr>
      `;
          })
          .join('')
      : `
        <tr>
          <td colspan="8" style="text-align: center; color: #64748b; padding: 18px;">
            لا توجد حجوزات للقاعات مسجلة مطابقة لمعايير البحث
          </td>
        </tr>
      `;

  const bodyHtml = `
    <div>
      ${renderHeaderBanner(ctx, { customSubtitle: 'جدول تشغيل وحجوزات القاعات والفعاليات الأكاديمية والتدريبية' })}
      ${renderKpisGrid(ctx)}

      <div style="margin: 12px 0;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: 6px;">
          <span>إجمالي الحجوزات بالقائمة: <strong>${ctx.rows.length} حجز</strong></span>
          <span>جدول تشغيلي معتمد لتوزيع مواعيد القاعات والفترات الزمنية</span>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">م</th>
              <th style="width: 90px; text-align: center;">نوع الحجز</th>
              <th>الطرف الحاجز / المدرس</th>
              <th>الغرض والنشاط</th>
              <th style="width: 95px; text-align: center;">التاريخ</th>
              <th style="width: 110px; text-align: center;">الفترة الزمنية</th>
              <th style="width: 100px;">القاعة</th>
              <th style="width: 85px; text-align: center;">الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      ${renderSignaturesRow([
        { title: 'مشرف تشغيل القاعات', subtitle: 'جدولة وتجهيز القاعات' },
        { title: 'المشرف الإداري العام', subtitle: 'اعتماد المواعيد' },
      ])}

      ${renderOfficialFooter('جدول تشغيل وحجوزات القاعات المعتمد بفرع السنتر التعليمي')}
    </div>
  `;

  return { bodyHtml, orientation: 'landscape' };
}

