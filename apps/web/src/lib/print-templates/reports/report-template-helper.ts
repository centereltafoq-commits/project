import { formatCurrency } from '@/lib/formatters';
import { ReportPrintContext } from './report-print-types';

export function renderHeaderBanner(
  ctx: ReportPrintContext,
  options?: { customSubtitle?: string; docCode?: string },
): string {
  const centerName = ctx.settings.centerName || 'سنتر النخبة التعليمي';
  const logo = ctx.settings.logoUrl
    ? `<img src="${ctx.settings.logoUrl}" alt="${centerName}" class="center-logo" />`
    : '';
  const now = new Date();
  const printDate = `${now.toLocaleDateString('ar-EG')} - ${now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;

  return `
    <div class="header-banner">
      <div class="header-right">
        ${logo}
        <div>
          <h1 class="center-title">${centerName}</h1>
          <p class="center-subtitle">
            ${options?.customSubtitle || ctx.settings.centerSubtitle || 'نظام الإدارة الأكاديمي والمحاسبي المتكامل'}
            ${ctx.settings.academicYear ? ` • العام الدراسي: ${ctx.settings.academicYear}` : ''}
            ${ctx.settings.phone ? ` • هاتف: ${ctx.settings.phone}` : ''}
          </p>
        </div>
      </div>

      <div class="meta-box">
        <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">
          ${ctx.title}
        </div>
        ${ctx.yearMonth ? `<div>الشهر المالي / الأكاديمي: <strong>${ctx.yearMonth}</strong></div>` : ''}
        ${ctx.filterSummary ? `<div>معايير التصفية: <strong>${ctx.filterSummary}</strong></div>` : ''}
        <div>تاريخ ووقت الطباعة: <strong>${printDate}</strong></div>
        ${options?.docCode ? `<div>كود المستند: <strong style="font-family: monospace;">${options.docCode}</strong></div>` : ''}
      </div>
    </div>
  `;
}

export function renderKpisGrid(ctx: ReportPrintContext): string {
  if (!ctx.summary || ctx.summary.length === 0) return '';
  const currencySymbol = ctx.settings.currencySymbol || 'ج.م';

  const cardsHtml = ctx.summary
    .map((kpi) => {
      let displayVal: string | number = kpi.value;
      if (kpi.format === 'currency') {
        displayVal = formatCurrency(kpi.value, currencySymbol);
      } else if (kpi.format === 'percent') {
        displayVal = `${kpi.value}%`;
      }
      return `
        <div class="kpi-card">
          <div class="kpi-label">${kpi.label}</div>
          <div class="kpi-val">${displayVal}</div>
        </div>
      `;
    })
    .join('');

  return `<div class="kpi-grid">${cardsHtml}</div>`;
}

export interface SignatureRole {
  title: string;
  subtitle: string;
  name?: string;
}

export function renderSignaturesRow(signatures: SignatureRole[]): string {
  if (!signatures || signatures.length === 0) return '';

  const boxesHtml = signatures
    .map((sig) => `
      <div class="signature-box">
        <div class="signature-title">${sig.title}</div>
        <div style="font-size: 10px; color: #475569; margin-bottom: 25px;">${sig.name || sig.subtitle}</div>
        <div class="signature-line">${sig.subtitle}</div>
      </div>
    `)
    .join(`
      <div class="signature-box" style="display: flex; align-items: center; justify-content: center;">
        <div class="stamp-box">خاتم السنتر</div>
      </div>
    `);

  return `<div class="signatures-row">${boxesHtml}</div>`;
}

export function renderOfficialFooter(note?: string): string {
  return `
    <div class="official-footer">
      ${note || 'تم استخراج هذا التقرير آلياً عبر نظام إدارة المراكز التعليمية (Nazzem Edu ERP) • جميع البيانات رسمية ومطابقة لسجلات السنتر'}
    </div>
  `;
}

