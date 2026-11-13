import { CenterSettings } from '@/features/settings/settings.types';
import { formatCurrency, formatDateAr } from './formatters';

export interface PrintDocumentOptions {
  title: string;
  bodyHtml: string;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Executes an isolated print job inside an invisible iframe.
 * This guarantees ONLY the intended document is sent to the printer,
 * completely immune to modal backdrops, sidebars, headers, or web page chrome.
 */
export function printDocument({
  title,
  bodyHtml,
  orientation = 'portrait',
}: PrintDocumentOptions): Promise<void> {
  return new Promise((resolve) => {
    // Remove any leftover print iframes
    const oldIframe = document.getElementById('edu-print-iframe');
    if (oldIframe) {
      oldIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'edu-print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.zIndex = '-9999';

    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      window.print();
      resolve();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>${title}</title>
          <style>
            @page {
              size: A4 ${orientation};
              margin: 10mm 10mm 12mm 10mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: 'IBM Plex Sans Arabic', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Tahoma, sans-serif;
              font-size: 12px;
              line-height: 1.5;
              margin: 0;
              padding: 0;
              direction: rtl;
              text-align: right;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 10px 0;
              page-break-inside: auto;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 6px 10px;
              font-size: 11px;
              text-align: right;
              vertical-align: middle;
            }
            th {
              background-color: #f1f5f9 !important;
              font-weight: 700;
              color: #0f172a;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            .header-banner {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 12px;
              margin-bottom: 14px;
            }
            .header-right {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .center-logo {
              height: 52px;
              width: 52px;
              object-fit: contain;
              border-radius: 6px;
            }
            .center-title {
              font-size: 18px;
              font-weight: 800;
              color: #0f172a;
              margin: 0 0 2px 0;
            }
            .center-subtitle {
              font-size: 11px;
              color: #475569;
              margin: 0;
            }
            .meta-box {
              text-align: left;
              font-size: 11px;
              color: #475569;
              line-height: 1.4;
            }
            .meta-box strong {
              color: #0f172a;
            }
            .kpi-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
              gap: 8px;
              margin: 12px 0;
            }
            .kpi-card {
              border: 1px solid #cbd5e1;
              background-color: #f8fafc !important;
              border-radius: 6px;
              padding: 8px 12px;
            }
            .kpi-label {
              font-size: 10px;
              color: #64748b;
              margin-bottom: 2px;
            }
            .kpi-val {
              font-size: 14px;
              font-weight: 800;
              color: #0f172a;
            }
            .signatures-row {
              margin-top: 24px;
              display: flex;
              justify-content: space-between;
              padding-top: 16px;
              border-top: 1px dashed #cbd5e1;
              page-break-inside: avoid;
            }
            .signature-box {
              text-align: center;
              width: 30%;
            }
            .signature-title {
              font-size: 11px;
              font-weight: 700;
              color: #334155;
              margin-bottom: 40px;
            }
            .signature-line {
              border-top: 1px solid #94a3b8;
              font-size: 10px;
              color: #64748b;
              padding-top: 4px;
            }
            .official-footer {
              margin-top: 20px;
              text-align: center;
              font-size: 10px;
              color: #64748b;
              border-top: 1px solid #e2e8f0;
              padding-top: 8px;
            }
            .stamp-box {
              display: inline-block;
              border: 2px dashed #94a3b8;
              border-radius: 50%;
              width: 72px;
              height: 72px;
              line-height: 72px;
              text-align: center;
              font-size: 10px;
              color: #94a3b8;
              font-weight: bold;
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          ${bodyHtml}
        </body>
      </html>
    `);
    doc.close();

    const triggerPrint = () => {
      const isJsdom =
        typeof navigator !== 'undefined' &&
        (navigator.userAgent.includes('jsdom') || navigator.userAgent.includes('Node.js'));

      try {
        if (!isJsdom && iframe.contentWindow && typeof iframe.contentWindow.print === 'function') {
          try {
            iframe.contentWindow.focus();
          } catch {
            // ignore focus errors
          }
          iframe.contentWindow.print();
        } else {
          window.print();
        }
      } catch (err) {
        console.error('Print iframe error:', err);
        window.print();
      } finally {
        setTimeout(() => {
          iframe.remove();
          resolve();
        }, 1000);
      }
    };

    // If there are images (like the center logo), wait for them to load
    const images = doc.images;
    if (images && images.length > 0) {
      let loadedCount = 0;
      const totalImages = images.length;
      const onImgDone = () => {
        loadedCount++;
        if (loadedCount >= totalImages) {
          triggerPrint();
        }
      };

      for (let i = 0; i < totalImages; i++) {
        const img = images[i]!;
        if (img.complete) {
          onImgDone();
        } else {
          img.onload = onImgDone;
          img.onerror = onImgDone;
        }
      }

      // Safety timeout in case an image fails to fire events
      setTimeout(triggerPrint, 800);
    } else {
      setTimeout(triggerPrint, 150);
    }
  });
}

/**
 * Builds and executes an official A4 Payment Receipt print job.
 */
export async function printReceiptA4(options: {
  receipt: {
    receiptNumber: string;
    studentName: string;
    studentCode: string;
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
  };
  settings: Partial<CenterSettings>;
}): Promise<void> {
  const { receipt, settings } = options;
  const centerName = settings.centerName || 'سنتر النخبة التعليمي';
  const currencySymbol = settings.currencySymbol || 'ج.م';
  const formattedDate = formatDateAr(receipt.paymentDate);

  const allocationsRows =
    receipt.allocations && receipt.allocations.length > 0
      ? receipt.allocations
          .map(
            (a, idx) => `
        <tr>
          <td style="width: 35px; text-align: center;">${idx + 1}</td>
          <td><strong>${a.groupName}</strong></td>
          <td style="color: #64748b;">${a.groupCode || '—'}</td>
          <td style="font-weight: 800; text-align: left; color: #047857;">${formatCurrency(a.allocatedAmount, currencySymbol)}</td>
        </tr>
      `,
          )
          .join('')
      : `
        <tr>
          <td colspan="4" style="text-align: center; color: #64748b; padding: 12px;">تحصيل رسوم دراسية عامة</td>
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
          <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">
            إيصال استلام نقدية رسمي
          </div>
          <div>رقم الإيصال: <strong style="font-family: monospace; font-size: 13px;">${receipt.receiptNumber}</strong></div>
          <div>تاريخ الإصدار: <strong>${formattedDate}</strong></div>
          <div>شهر الاستحقاق: <strong>${receipt.yearMonth}</strong></div>
        </div>
      </div>

      <!-- Student & Payment Info Grid -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0;">
        <div style="border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 8px; padding: 10px 14px;">
          <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">بيانات الطالب</div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${receipt.studentName}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">كود الطالب: <strong style="font-family: monospace;">${receipt.studentCode}</strong></div>
          ${receipt.parentPhone ? `<div style="font-size: 11px; color: #475569;">هاتف ولي الأمر: ${receipt.parentPhone}</div>` : ''}
        </div>

        <div style="border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 8px; padding: 10px 14px;">
          <div style="font-size: 10px; color: #64748b; margin-bottom: 2px;">بيانات الدفع والتحصيل</div>
          <div style="font-size: 13px; font-weight: 700; color: #0f172a;">طريقة السداد: ${receipt.paymentMethod}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 2px;">المحصّل / الخزينة: <strong>${receipt.receivedByName || 'الخزينة الرئيسية'}</strong></div>
          <div style="font-size: 11px; color: #047857; font-weight: 600; margin-top: 2px;">الحالة: مسدد بالكامل ومعتمد محاسبياً</div>
        </div>
      </div>

      <!-- Allocations Table -->
      <div style="margin: 16px 0;">
        <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">بيان وتوزيع الرسوم المحصلة:</div>
        <table>
          <thead>
            <tr>
              <th style="width: 35px; text-align: center;">م</th>
              <th>المجموعة / البند الدراسي</th>
              <th>كود المجموعة</th>
              <th style="text-align: left;">المبلغ المسدد</th>
            </tr>
          </thead>
          <tbody>
            ${allocationsRows}
          </tbody>
        </table>
      </div>

      <!-- Total Box -->
      <div style="display: flex; justify-content: space-between; align-items: center; background: #ecfdf5; border: 1.5px solid #10b981; border-radius: 8px; padding: 12px 18px; margin: 16px 0;">
        <div style="font-size: 13px; font-weight: 700; color: #065f46;">
          إجمالي المبلغ المدفوع:
        </div>
        <div style="font-size: 20px; font-weight: 900; color: #047857;">
          ${formatCurrency(receipt.amount, currencySymbol)}
        </div>
      </div>

      ${
        receipt.notes
          ? `<div style="font-size: 11px; color: #475569; background: #f1f5f9; padding: 6px 12px; border-radius: 6px; margin: 10px 0;">
              <strong>ملاحظات:</strong> ${receipt.notes}
             </div>`
          : ''
      }

      <!-- Signatures & Stamp -->
      <div class="signatures-row">
        <div class="signature-box">
          <div class="signature-title">المستلم / أمين الخزينة</div>
          <div class="signature-line">${receipt.receivedByName || 'الخزينة المعتمدة'}</div>
        </div>
        <div class="signature-box" style="display: flex; align-items: center; justify-content: center;">
          <div class="stamp-box">خاتم السنتر</div>
        </div>
        <div class="signature-box">
          <div class="signature-title">توقيع الإدارة المالية</div>
          <div class="signature-line">إدارة ${centerName}</div>
        </div>
      </div>

      <!-- Official Footer -->
      <div class="official-footer">
        يعتبر هذا الإيصال سنداً رسمياً لإثبات سداد الرسوم • شكراً لتعاملكم مع ${centerName} وتمنياتنا لطلابنا الأعزاء بالتفوق والنجاح الباهر
      </div>
    </div>
  `;

  await printDocument({
    title: `إيصال_${receipt.receiptNumber}_${receipt.studentName}`,
    bodyHtml,
    orientation: 'portrait',
  });
}

/**
 * Builds and executes an official A4 Attendance Roster print job.
 */
export async function printAttendanceSheetA4(options: {
  session: {
    groupName: string;
    teacherName?: string | null;
    classroomName?: string | null;
    sessionDate: string | Date;
    startTime: string;
    endTime: string;
    topic?: string | null;
  };
  students: Array<{
    studentCode: string;
    studentName: string;
    phone?: string | null;
    parentPhone?: string | null;
    status?: string | null;
    notes?: string | null;
  }>;
  settings: Partial<CenterSettings>;
}): Promise<void> {
  const { session, students, settings } = options;
  const centerName = settings.centerName || 'سنتر النخبة التعليمي';
  const formattedDate = formatDateAr(session.sessionDate);

  const studentRows = students
    .map(
      (st, idx) => `
      <tr>
        <td style="width: 30px; text-align: center;">${idx + 1}</td>
        <td style="font-family: monospace; font-size: 11px; text-align: center;">${st.studentCode}</td>
        <td><strong>${st.studentName}</strong></td>
        <td style="font-size: 10px; color: #475569;">${st.phone || '—'}</td>
        <td style="font-size: 10px; color: #475569;">${st.parentPhone || '—'}</td>
        <td style="width: 75px; text-align: center; font-weight: bold;">
          ${
            st.status === 'PRESENT'
              ? '✓ حاضر'
              : st.status === 'ABSENT'
                ? '✗ غائب'
                : st.status === 'LATE'
                  ? 'متأخر'
                  : st.status === 'EXCUSED'
                    ? 'معذور'
                    : '[   ]'
          }
        </td>
        <td style="width: 60px; text-align: center;"></td>
        <td style="font-size: 10px; color: #64748b;">${st.notes || ''}</td>
      </tr>
    `,
    )
    .join('');

  const bodyHtml = `
    <div>
      <div class="header-banner">
        <div class="header-right">
          ${
            settings.logoUrl
              ? `<img src="${settings.logoUrl}" alt="${centerName}" class="center-logo" />`
              : ''
          }
          <div>
            <h1 class="center-title">${centerName}</h1>
            <p class="center-subtitle">كشف رصد الحضور والغياب والواجبات الميداني</p>
          </div>
        </div>

        <div class="meta-box">
          <div>المجموعة: <strong>${session.groupName}</strong></div>
          <div>المدرس: <strong>${session.teacherName || '—'}</strong></div>
          <div>القاعة: <strong>${session.classroomName || '—'}</strong></div>
          <div>التاريخ: <strong>${formattedDate} (${session.startTime} - ${session.endTime})</strong></div>
          ${session.topic ? `<div>موضوع الدرس: <strong>${session.topic}</strong></div>` : ''}
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-bottom: 8px;">
        <span>إجمالي الطلاب المسجلين بالكشف: <strong>${students.length} طالب</strong></span>
        <span>تاريخ وتوقيت الطباعة: ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">م</th>
            <th style="width: 65px; text-align: center;">الكود</th>
            <th>اسم الطالب بالكامل</th>
            <th style="width: 90px;">هاتف الطالب</th>
            <th style="width: 90px;">هاتف ولي الأمر</th>
            <th style="width: 75px; text-align: center;">الحضور</th>
            <th style="width: 60px; text-align: center;">الواجب</th>
            <th>ملاحظات وتوجيهات</th>
          </tr>
        </thead>
        <tbody>
          ${studentRows}
        </tbody>
      </table>

      <div class="signatures-row" style="margin-top: 28px;">
        <div class="signature-box">
          <div class="signature-title">توقيع مدرس المادة</div>
          <div class="signature-line">${session.teacherName || 'مدرس المادة'}</div>
        </div>
        <div class="signature-box">
          <div class="signature-title">توقيع المساعد / القائم بالرصد</div>
          <div class="signature-line">مسؤول الحضور</div>
        </div>
        <div class="signature-box">
          <div class="signature-title">اعتماد المشرف الإداري</div>
          <div class="signature-line">إدارة السنتر</div>
        </div>
      </div>
    </div>
  `;

  await printDocument({
    title: `كشف_حضور_${session.groupName}_${formattedDate}`,
    bodyHtml,
    orientation: 'portrait',
  });
}

/**
 * Builds and executes an official A4 Center Report print job.
 */
export async function printReportA4(options: {
  reportTitle: string;
  categoryLabel?: string;
  filterSummary?: string;
  summaryCards?: Array<{ label: string; value: string | number }>;
  columns: Array<{ header: string; accessorKey?: string; id?: string }>;
  rows: Array<Record<string, any>>;
  settings: Partial<CenterSettings>;
}): Promise<void> {
  const { reportTitle, categoryLabel, filterSummary, summaryCards, columns, rows, settings } =
    options;
  const centerName = settings.centerName || 'سنتر النخبة التعليمي';
  const orientation = columns.length > 6 ? 'landscape' : 'portrait';

  const kpisHtml =
    summaryCards && summaryCards.length > 0
      ? `
      <div class="kpi-grid">
        ${summaryCards
          .map(
            (c) => `
          <div class="kpi-card">
            <div class="kpi-label">${c.label}</div>
            <div class="kpi-val">${c.value}</div>
          </div>
        `,
          )
          .join('')}
      </div>
    `
      : '';

  const headersHtml = columns.map((col) => `<th>${col.header}</th>`).join('');

  const tableRowsHtml =
    rows.length > 0
      ? rows
          .map(
            (row, idx) => `
        <tr>
          ${columns
            .map((col) => {
              const key = col.accessorKey || col.id || '';
              const val = row[key];
              const displayVal =
                val === null || val === undefined
                  ? '—'
                  : typeof val === 'object'
                    ? JSON.stringify(val)
                    : String(val);
              return `<td>${displayVal}</td>`;
            })
            .join('')}
        </tr>
      `,
          )
          .join('')
      : `
        <tr>
          <td colspan="${columns.length}" style="text-align: center; color: #64748b; padding: 18px;">
            لا توجد بيانات مسجلة مطابقة لمعايير البحث
          </td>
        </tr>
      `;

  const bodyHtml = `
    <div>
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
              ${settings.centerSubtitle || 'نظام الإدارة المحاسبي والأكاديمي'}
              ${settings.academicYear ? ` • العام الدراسي: ${settings.academicYear}` : ''}
            </p>
          </div>
        </div>

        <div class="meta-box">
          <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${reportTitle}</div>
          ${categoryLabel ? `<div>التصنيف: <strong>${categoryLabel}</strong></div>` : ''}
          ${filterSummary ? `<div>الفلاتر: <strong>${filterSummary}</strong></div>` : ''}
          <div>تاريخ الطباعة: <strong>${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</strong></div>
        </div>
      </div>

      ${kpisHtml}

      <div style="margin: 12px 0;">
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: 6px;">
          <span>إجمالي السجلات: <strong>${rows.length}</strong></span>
          <span>صفحة مطبوعة رسمية ومطابقة لدفاتر السنتر</span>
        </div>

        <table>
          <thead>
            <tr>
              ${headersHtml}
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>

      <div class="signatures-row">
        <div class="signature-box">
          <div class="signature-title">المحاسب المسؤول</div>
          <div class="signature-line">إعداد ومطابقة الحسابات</div>
        </div>
        <div class="signature-box" style="display: flex; align-items: center; justify-content: center;">
          <div class="stamp-box">ختم الاعتماد</div>
        </div>
        <div class="signature-box">
          <div class="signature-title">اعتماد إدارة السنتر</div>
          <div class="signature-line">المدير المالي والتنفيذي</div>
        </div>
      </div>

      <div class="official-footer">
        تم استخراج هذا التقرير آلياً عبر نظام إدارة المراكز التعليمية (Nazzem Edu ERP) • جميع الأرقام مدققة ومطابقة لقيود السجلات
      </div>
    </div>
  `;

  await printDocument({
    title: `${reportTitle}_${new Date().toISOString().slice(0, 10)}`,
    bodyHtml,
    orientation,
  });
}
