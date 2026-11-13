import { formatCurrency } from '@/lib/formatters';
import { ReportPrintContext, ReportTemplateResult } from './report-print-types';
import {
  renderHeaderBanner,
  renderKpisGrid,
  renderOfficialFooter,
  renderSignaturesRow,
} from './report-template-helper';

export function renderFinancialSummaryReport(ctx: ReportPrintContext): ReportTemplateResult {
  const currencySymbol = ctx.settings.currencySymbol || 'ج.م';

  // If granular rows exist, group them by sectionAr
  const hasRows = ctx.rows.length > 0;
  let breakdownTableHtml = '';

  if (hasRows) {
    const sectionsMap = new Map<string, Array<Record<string, any>>>();
    for (const r of ctx.rows) {
      const sec = (r.sectionAr as string) || 'البنود المالية العامة';
      const list = sectionsMap.get(sec) ?? [];
      list.push(r);
      sectionsMap.set(sec, list);
    }

    const sectionsHtml = Array.from(sectionsMap.entries())
      .map(([sectionName, items]) => {
        const subtotal = items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
        return `
          <div style="margin-bottom: 16px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
            <div style="background: #f1f5f9; padding: 8px 12px; font-weight: 800; font-size: 13px; color: #0f172a; display: flex; justify-content: space-between;">
              <span>${sectionName}</span>
              <span>المجموع: ${formatCurrency(subtotal, currencySymbol)}</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th style="width: 35px; text-align: center;">م</th>
                  <th>البند المالي</th>
                  <th style="width: 130px; text-align: left;">القيمة</th>
                  <th>ملاحظات وتفاصيل</th>
                </tr>
              </thead>
              <tbody>
                ${items
                  .map(
                    (it, idx) => `
                  <tr>
                    <td style="width: 35px; text-align: center;">${idx + 1}</td>
                    <td style="font-weight: 600;">${it.lineItemAr || it.title || 'بند مالي'}</td>
                    <td style="font-weight: bold; text-align: left; color: #0f172a;">${formatCurrency(it.amount, currencySymbol)}</td>
                    <td style="font-size: 11px; color: #475569;">${it.notes || it.description || '—'}</td>
                  </tr>
                `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `;
      })
      .join('');

    breakdownTableHtml = sectionsHtml;
  } else {
    // Build an executive table directly from summary KPIs
    breakdownTableHtml = `
      <div style="border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; margin-top: 14px;">
        <div style="background: #f1f5f9; padding: 10px 14px; font-weight: 800; font-size: 13px; color: #0f172a;">
          بيان المؤشرات المالية والحسابات الختامية للشهر
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">م</th>
              <th>المؤشر المالي / الحساب</th>
              <th style="width: 160px; text-align: left;">القيمة المالية</th>
              <th>طبيعة الحساب والتأثير المالي</th>
            </tr>
          </thead>
          <tbody>
            ${(ctx.summary || [])
              .map(
                (kpi, idx) => `
              <tr>
                <td style="width: 35px; text-align: center;">${idx + 1}</td>
                <td style="font-weight: 700; color: #0f172a;">${kpi.label}</td>
                <td style="font-weight: 800; text-align: left; font-size: 13px; color: ${
                  kpi.tone === 'danger'
                    ? '#b91c1c'
                    : kpi.tone === 'success'
                      ? '#047857'
                      : kpi.tone === 'warning'
                        ? '#d97706'
                        : '#1e3a8a'
                };">
                  ${kpi.format === 'currency' ? formatCurrency(kpi.value, currencySymbol) : kpi.format === 'percent' ? `${kpi.value}%` : kpi.value}
                </td>
                <td style="font-size: 11px; color: #475569;">
                  ${
                    kpi.tone === 'success'
                      ? 'تدفقات نقدية موجبة / أرباح محققة'
                      : kpi.tone === 'danger'
                        ? 'تدفقات منصرفة / تكاليف ومصروفات'
                        : kpi.tone === 'warning'
                          ? 'ذمم مدينة وأرصدة معلقة'
                          : 'مؤشر أداء مالي عام'
                  }
                </td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  const bodyHtml = `
    <div>
      ${renderHeaderBanner(ctx, { customSubtitle: 'قائمة الدخل والملخص المالي التنفيذي الشامل للسنتر' })}
      ${renderKpisGrid(ctx)}

      <div style="margin: 16px 0;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: 8px;">
          <span>تقرير الإدارة المالية العليا ومجلس الإدارة</span>
          <span>سري وخاص بإدارة السنتر • أرقام مدققة ومطابقة لميزان المراجعة</span>
        </div>

        ${breakdownTableHtml}
      </div>

      ${renderSignaturesRow([
        { title: 'المدير المالي', subtitle: 'إعداد ومطابقة القوائم المالية' },
        { title: 'المالك / المدير العام', subtitle: 'الاعتماد النهائي للأرباح' },
      ])}

      ${renderOfficialFooter('القائمة المالية التنفيذية لنتائج الأعمال التشغيلية - معتمدة من الإدارة المالية')}
    </div>
  `;

  return { bodyHtml, orientation: 'portrait' };
}

