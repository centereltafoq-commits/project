import { jsPDF } from 'jspdf';
import { buildStudentQrPayload, generateQrDataUrl } from '../qr-code.util';

export interface StudentQrPdfItem {
  id: string;
  studentCode: string;
  fullName: string;
  gradeLevel?: string | null;
}

export type QrPdfGridPreset = 'compact-20' | 'eco-24' | 'medium-12';

export interface QrPdfGridConfig {
  cols: number;
  rows: number;
  label: string;
}

export const QR_PDF_GRID_PRESETS: Record<QrPdfGridPreset, QrPdfGridConfig> = {
  'compact-20': { cols: 4, rows: 5, label: '20 cards / A4 page (4 x 5)' },
  'eco-24': { cols: 4, rows: 6, label: '24 cards / A4 page (4 x 6)' },
  'medium-12': { cols: 3, rows: 4, label: '12 cards / A4 page (3 x 4)' },
};

export interface GenerateStudentQrPdfOptions {
  students: StudentQrPdfItem[];
  preset?: QrPdfGridPreset;
  title?: string;
  subtitle?: string;
  autoDownload?: boolean;
  filename?: string;
}

/**
 * Renders the student's display name (supports both Arabic and English cleanly
 * with full ligature shaping via browser Canvas 2D) into a crisp high-DPI PNG data URL.
 * Returns null when Canvas 2D is unavailable (e.g. headless jsdom tests).
 */
function renderStudentNameLabelPng(
  fullName: string,
  widthMm: number,
  heightMm: number,
): string | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  const pxPerMm = 12; // ~300 DPI for sharp printing
  canvas.width = Math.max(120, Math.round(widthMm * pxPerMm));
  canvas.height = Math.max(40, Math.round(heightMm * pxPerMm));

  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    return null;
  }
  if (!ctx) {
    return null;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const text = fullName.trim() || 'Student';
  const maxWidth = canvas.width - 16;

  // Shrink font smoothly for longer names so every name fits neatly inside the card
  let fontSize = Math.round(canvas.height * 0.46);
  const fontFamily = '"Cairo", "IBM Plex Sans Arabic", "Segoe UI", Tahoma, Arial, sans-serif';
  while (fontSize > 20) {
    ctx.font = `700 ${fontSize}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth) {
      break;
    }
    fontSize -= 2;
  }

  ctx.font = `700 ${fontSize}px ${fontFamily}`;

  // Truncate cleanly with ellipsis only if an unusually long name still overflows at minimum size
  let display = text;
  if (ctx.measureText(display).width > maxWidth) {
    while (display.length > 4 && ctx.measureText(`${display}...`).width > maxWidth) {
      display = display.slice(0, -1);
    }
    display = `${display.trim()}...`;
  }

  ctx.fillText(display, canvas.width / 2, canvas.height / 2);
  return canvas.toDataURL('image/png');
}

function toAsciiFallbackText(input: string, fallbackCode: string): string {
  const ascii = input.replace(/[^\x20-\x7E]/g, '').trim();
  return ascii || fallbackCode;
}

/**
 * Generates an eco-friendly, neatly aligned English-labeled A4 PDF containing
 * compact student QR cards with each student's name positioned directly above their QR code.
 */
export async function generateStudentsQrPdf(
  options: GenerateStudentQrPdfOptions,
): Promise<{ doc: jsPDF; totalPages: number; fileName: string }> {
  const {
    students,
    preset = 'compact-20',
    title = 'STUDENT QR PASS CARDS',
    subtitle,
    autoDownload = true,
    filename,
  } = options;

  if (!students || students.length === 0) {
    throw new Error('No students selected for QR PDF generation');
  }

  const grid = QR_PDF_GRID_PRESETS[preset] ?? QR_PDF_GRID_PRESETS['compact-20'];
  const perPage = grid.cols * grid.rows;
  const totalPages = Math.max(1, Math.ceil(students.length / perPage));

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 10;
  const marginTop = 10;
  const marginBottom = 10;
  const headerHeight = 12;
  const gridStartY = marginTop + headerHeight;
  const usableWidth = pageWidth - marginX * 2;
  const usableHeight = pageHeight - gridStartY - marginBottom;

  const gapX = 3;
  const gapY = 3;
  const cellW = (usableWidth - gapX * (grid.cols - 1)) / grid.cols;
  const cellH = (usableHeight - gapY * (grid.rows - 1)) / grid.rows;

  const nameBandH = 8.5;
  const codeBandH = 5.5;
  const paddingY = 2;
  const qrSize = Math.max(
    18,
    Math.min(cellW - 8, cellH - nameBandH - codeBandH - paddingY * 2),
  );

  const todayIso = new Date().toISOString().slice(0, 10);

  // Pre-generate QR data URLs cleanly in batches
  const qrImages = await Promise.all(
    students.map((student) =>
      generateQrDataUrl(buildStudentQrPayload(student.studentCode)),
    ),
  );

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (pageIdx > 0) {
      doc.addPage('a4', 'portrait');
    }

    // Minimal English Header Bar
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(title, marginX, marginTop + 4);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    const metaRight = `Total: ${students.length}  |  ${grid.cols}x${grid.rows} A4  |  Page ${pageIdx + 1} of ${totalPages}  |  ${todayIso}`;
    doc.text(metaRight, pageWidth - marginX, marginTop + 4, { align: 'right' });

    if (subtitle) {
      doc.setFontSize(8);
      doc.text(toAsciiFallbackText(subtitle, 'Students Export'), marginX, marginTop + 8.5);
    }

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.line(marginX, marginTop + 10, pageWidth - marginX, marginTop + 10);

    const startIdx = pageIdx * perPage;
    const endIdx = Math.min(students.length, startIdx + perPage);

    for (let i = startIdx; i < endIdx; i++) {
      const localIdx = i - startIdx;
      const col = localIdx % grid.cols;
      const row = Math.floor(localIdx / grid.cols);

      const x = marginX + col * (cellW + gapX);
      const y = gridStartY + row * (cellH + gapY);

      const student = students[i]!;
      const qrDataUrl = qrImages[i]!;

      // Light ink-saving cut guide box
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.25);
      if (typeof (doc as any).setLineDashPattern === 'function') {
        (doc as any).setLineDashPattern([1.2, 1.2], 0);
      }
      doc.roundedRect(x, y, cellW, cellH, 1.8, 1.8, 'S');
      if (typeof (doc as any).setLineDashPattern === 'function') {
        (doc as any).setLineDashPattern([], 0);
      }

      // 1. Student Name directly ABOVE the QR Code
      const nameImg = renderStudentNameLabelPng(student.fullName, cellW - 4, nameBandH);
      if (nameImg) {
        doc.addImage(nameImg, 'PNG', x + 2, y + paddingY, cellW - 4, nameBandH);
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text(
          toAsciiFallbackText(student.fullName, student.studentCode),
          x + cellW / 2,
          y + paddingY + 5,
          { align: 'center', maxWidth: cellW - 4 },
        );
      }

      // 2. Centered QR Code image
      const qrX = x + (cellW - qrSize) / 2;
      const qrY = y + paddingY + nameBandH + 0.5;
      doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

      // 3. Monospace English Student Code directly BELOW the QR Code
      doc.setFont('courier', 'bold');
      doc.setFontSize(grid.cols >= 4 ? 7.5 : 8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(
        student.studentCode,
        x + cellW / 2,
        qrY + qrSize + 3.5,
        { align: 'center' },
      );
    }
  }

  const fileName = filename || `student-qr-codes-${todayIso}.pdf`;
  if (autoDownload) {
    doc.save(fileName);
  }

  return { doc, totalPages, fileName };
}
