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
              margin-bottom: 4px;
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

    // If there are images (like center logo), wait for them to load
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

