import { CenterSettings } from '@/features/settings/settings.types';
import { printDocument } from '../print-service-core';
import { buildStudentQrPayload, generateQrDataUrl } from '../qr-code.util';

export interface StudentQrCardPrintData {
  studentCode: string;
  fullName: string;
  gradeLevel: string;
  phone?: string | null;
  guardianPhone?: string | null;
  groupNames?: string[];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function printStudentQrCard(options: {
  student: StudentQrCardPrintData;
  settings?: Partial<CenterSettings>;
}): Promise<void> {
  const { student, settings = {} } = options;
  const payload = buildStudentQrPayload(student.studentCode);
  const qrDataUrl = await generateQrDataUrl(payload);

  const bodyHtml = `
    <div style="display: flex; justify-content: center; padding: 24px; font-family: 'Segoe UI', Tahoma, Arial, sans-serif; direction: ltr;">
      <div style="width: 240px; border: 1.5px dashed #94a3b8; border-radius: 10px; padding: 14px 12px; background: #fff; text-align: center;">
        <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 8px; line-height: 1.35;">
          ${escapeHtml(student.fullName)}
        </div>
        <img src="${qrDataUrl}" alt="${escapeHtml(student.studentCode)}" style="width: 150px; height: 150px; display: block; margin: 0 auto;" />
        <div style="font-family: monospace; font-size: 12px; font-weight: 700; color: #334155; margin-top: 8px; letter-spacing: 0.5px;">
          ${escapeHtml(student.studentCode)}
        </div>
        <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
          ${escapeHtml(settings.centerName ? `${student.gradeLevel}` : student.gradeLevel)}
        </div>
      </div>
    </div>
  `;

  await printDocument({
    title: `QR Pass - ${student.studentCode}`,
    bodyHtml,
    orientation: 'portrait',
  });
}
