import { CenterSettings } from '@/features/settings/settings.types';
import { formatCurrency, formatDateAr, formatYearMonthAr } from '@/lib/formatters';
import { printDocument } from '../print-service';

export interface ReceiptPrintData {
  receiptNumber: string;
  studentName: string;
  studentCode: string;
  phone?: string | null;
  parentPhone?: string | null;
  paymentDate: string | Date;
  yearMonth: string;
  paymentMethod: string;
  amount: number | string;
  receivedByName?: string | null;
  notes?: string | null;
  allocations?: Array<{
    groupName: string;
    groupCode?: string | null;
    allocatedAmount: number | string;
  }>;
}

export function buildThermalReceiptHtml(
  receipt: ReceiptPrintData,
  settings: Partial<CenterSettings>,
  currencySymbol = 'ج.م',
): string {
  const centerName = settings.centerName || 'سنتر النخبة التعليمي';
  const phone = settings.phone ? `<div style="font-size: 11px; margin-top: 2px;">هاتف: ${settings.phone}</div>` : '';
  const formattedDate = formatDateAr(receipt.paymentDate);

  const allocationsHtml =
    receipt.allocations && receipt.allocations.length > 0
      ? `
      <div style="margin: 8px 0; border-top: 1px dashed #333; border-bottom: 1px dashed #333; padding: 4px 0;">
        <table style="width: 100%; font-size: 11px; text-align: right; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="padding: 2px 0; text-align: right;">المجموعة</th>
              <th style="padding: 2px 0; text-align: left;">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            ${receipt.allocations
              .map(
                (a) => `
              <tr>
                <td style="padding: 2px 0;">${a.groupName}</td>
                <td style="padding: 2px 0; text-align: left; font-weight: bold;">${formatCurrency(a.allocatedAmount, currencySymbol)}</td>
              </tr>
            `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
      : '';

  return `
    <div style="text-align: center; font-family: 'IBM Plex Sans Arabic', -apple-system, sans-serif; font-size: 12px; line-height: 1.4; color: #000; padding: 4px; direction: rtl;">
      <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 800;">${centerName}</h3>
      <div style="font-size: 11px; color: #333;">إيصال تحصيل رسوم دراسية رسمي</div>
      ${phone}
      <div style="margin: 6px 0; border-top: 1px dashed #000;"></div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px;">
        <span>رقم الإيصال: <strong style="font-family: monospace;">${receipt.receiptNumber}</strong></span>
        <span>التاريخ: ${formattedDate}</span>
      </div>
      <div style="text-align: right; margin: 6px 0; font-size: 11px; line-height: 1.6; border-bottom: 1px dashed #ccc; padding-bottom: 4px;">
        <div>اسم الطالب: <strong>${receipt.studentName}</strong> (<span style="font-family: monospace;">${receipt.studentCode}</span>)</div>
        <div>شهر الاستحقاق: <strong>${formatYearMonthAr(receipt.yearMonth)}</strong></div>
        <div>طريقة السداد: <strong>${receipt.paymentMethod}</strong></div>
        ${receipt.receivedByName ? `<div>المحصّل / الخزينة: <strong>${receipt.receivedByName}</strong></div>` : ''}
      </div>
      ${allocationsHtml}
      <div style="margin: 8px 0; padding: 8px; background-color: #f1f5f9; border: 1px solid #000; border-radius: 4px; text-align: center;">
        <span style="font-size: 12px; font-weight: bold;">المبلغ المسدد: </span>
        <span style="font-size: 16px; font-weight: 900;">${formatCurrency(receipt.amount, currencySymbol)}</span>
      </div>
      ${receipt.notes ? `<div style="font-size: 10px; text-align: right; color: #444; margin-top: 4px;">ملاحظات: ${receipt.notes}</div>` : ''}
      <div style="margin-top: 10px; font-size: 10px; color: #666; text-align: center; border-top: 1px dashed #000; padding-top: 6px;">
        شكراً لتعاملكم معنا • تمنياتنا لطلابنا بالتفوق والنجاح
      </div>
    </div>
  `;
}

export async function printReceiptA4(options: {
  receipt: ReceiptPrintData;
  settings: Partial<CenterSettings>;
}): Promise<void> {
  const { receipt, settings } = options;
  const centerName = settings.centerName || 'سنتر النخبة التعليمي';
  const currencySymbol = settings.currencySymbol || 'ج.م';
  const formattedDate = formatDateAr(receipt.paymentDate);
  const formattedMonth = formatYearMonthAr(receipt.yearMonth);

  const allocationsRows =
    receipt.allocations && receipt.allocations.length > 0
      ? receipt.allocations
          .map(
            (a, idx) => `
        <tr>
          <td style="width: 40px; text-align: center;">${idx + 1}</td>
          <td style="font-weight: 700; color: #0f172a;">${a.groupName}</td>
          <td style="font-family: monospace; color: #64748b; text-align: center;">${a.groupCode || '—'}</td>
          <td style="font-weight: 800; text-align: left; color: #047857; font-size: 13px;">${formatCurrency(a.allocatedAmount, currencySymbol)}</td>
        </tr>
      `,
          )
          .join('')
      : `
        <tr>
          <td colspan="4" style="text-align: center; color: #64748b; padding: 14px;">سداد رسوم دراسية واشتراك شهري عام</td>
        </tr>
      `;

  const bodyHtml = `
    <div style="border: 2px solid #0f172a; border-radius: 12px; padding: 24px; position: relative;">
      <!-- Header Banner -->
      <div class="header-banner">
        <div class="header-right">
          ${
            settings.logoUrl
              ? `<img src="${settings.logoUrl}" alt="${centerName}" class="center-logo" />`
              : ''
          }
          <div>
            <h1 class="center-title">${centerName}</h1>
            <p class="center-subtitle">
              ${settings.centerSubtitle || 'نظام الإدارة المحاسبي والأكاديمي المتكامل'}
              ${settings.phone ? ` • هاتف: ${settings.phone}` : ''}
              ${settings.address ? ` • العنوان: ${settings.address}` : ''}
            </p>
          </div>
        </div>

        <div class="meta-box">
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">
            سند قبض رسمي (Payment Voucher)
          </div>
          <div>رقم الإيصال: <strong style="font-family: monospace; font-size: 13px; color: #1e3a8a;">${receipt.receiptNumber}</strong></div>
          <div>تاريخ الإصدار: <strong>${formattedDate}</strong></div>
          <div>شهر الاستحقاق: <strong>${formattedMonth}</strong></div>
        </div>
      </div>

      <!-- Student & Payment Info Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0;">
        <div style="border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">بيانات الطالب المسدد</div>
          <div style="font-size: 15px; font-weight: 800; color: #0f172a;">${receipt.studentName}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">كود الطالب: <strong style="font-family: monospace; color: #1e3a8a;">${receipt.studentCode}</strong></div>
          ${receipt.parentPhone ? `<div style="font-size: 11px; color: #475569;">هاتف ولي الأمر: ${receipt.parentPhone}</div>` : ''}
        </div>

        <div style="border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">تفاصيل عملية التحصيل</div>
          <div style="font-size: 13px; font-weight: 700; color: #0f172a;">طريقة السداد: ${receipt.paymentMethod}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">المحصّل / الخزينة: <strong>${receipt.receivedByName || 'الخزينة الرئيسية'}</strong></div>
          <div style="font-size: 11px; color: #047857; font-weight: 700; margin-top: 2px;">الحالة المالية: معتمد ومسجل بالدفاتر الحسابية</div>
        </div>
      </div>

      <!-- Allocations Table -->
      <div style="margin: 16px 0;">
        <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">بيان وتوزيع الرسوم الدراسية المحصلة:</div>
        <table>
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">م</th>
              <th>المجموعة / البند الدراسي</th>
              <th style="width: 110px; text-align: center;">كود المجموعة</th>
              <th style="width: 140px; text-align: left;">المبلغ المسدد</th>
            </tr>
          </thead>
          <tbody>
            ${allocationsRows}
          </tbody>
        </table>
      </div>

      <!-- Total Highlight Box -->
      <div style="display: flex; justify-content: space-between; align-items: center; background: #ecfdf5; border: 2px solid #10b981; border-radius: 8px; padding: 14px 20px; margin: 16px 0;">
        <div>
          <div style="font-size: 13px; font-weight: 700; color: #065f46;">
            إجمالي المبلغ المدفوع والمقبوض:
          </div>
          <div style="font-size: 11px; color: #047857; margin-top: 2px;">
            تم السداد نقداً / إلكترونياً وأودع في خزينة السنتر
          </div>
        </div>
        <div style="font-size: 22px; font-weight: 900; color: #047857;">
          ${formatCurrency(receipt.amount, currencySymbol)}
        </div>
      </div>

      ${
        receipt.notes
          ? `<div style="font-size: 11px; color: #475569; background: #f1f5f9; padding: 8px 12px; border-radius: 6px; margin: 10px 0; border: 1px solid #e2e8f0;">
              <strong>ملاحظات الإيصال:</strong> ${receipt.notes}
             </div>`
          : ''
      }

      <!-- Signatures Row -->
      <div class="signatures-row" style="margin-top: 28px;">
        <div class="signature-box">
          <div class="signature-title">المستلم / أمين الخزينة</div>
          <div class="signature-line">${receipt.receivedByName || 'الخزينة المعتمدة'}</div>
        </div>
        <div class="signature-box" style="display: flex; align-items: center; justify-content: center;">
          <div class="stamp-box">خاتم السنتر</div>
        </div>
        <div class="signature-box">
          <div class="signature-title">اعتماد الإدارة المالية</div>
          <div class="signature-line">إدارة ${centerName}</div>
        </div>
      </div>

      <!-- Official Footer -->
      <div class="official-footer">
        يعتبر هذا السند وثيقة مالية رسمية لإثبات سداد الرسوم • يرجى الاحتفاظ بهذا الإيصال للمراجعة والاستفسار
      </div>
    </div>
  `;

  await printDocument({
    title: `إيصال_${receipt.receiptNumber}_${receipt.studentName}`,
    bodyHtml,
    orientation: 'portrait',
  });
}

