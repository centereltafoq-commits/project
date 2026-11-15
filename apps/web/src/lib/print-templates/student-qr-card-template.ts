import { CenterSettings } from '@/features/settings/settings.types';
import { printDocument } from '../print-service-core';
import { buildStudentQrPayload, generateQrSvgString } from '../qr-code.util';

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
  const centerName = settings.centerName || 'سنتر النخبة التعليمي';
  const payload = buildStudentQrPayload(student.studentCode);
  const qrSvg = await generateQrSvgString(payload);

  const groupsHtml =
    student.groupNames && student.groupNames.length > 0
      ? `<div style="margin-top: 8px; font-size: 11px; color: #334155;">
          <strong>المجموعات:</strong> ${student.groupNames.map(escapeHtml).join(' • ')}
        </div>`
      : '';

  const bodyHtml = `
    <div style="display: flex; justify-content: center; padding: 24px; font-family: 'IBM Plex Sans Arabic', -apple-system, sans-serif; direction: rtl;">
      <div style="width: 380px; border: 2px solid #0f172a; border-radius: 14px; overflow: hidden; background: #fff; box-shadow: 0 2px 10px rgba(15,23,42,0.08);">
        <div style="background: #0f172a; color: #fff; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 15px; font-weight: 800;">${escapeHtml(centerName)}</div>
            <div style="font-size: 11px; opacity: 0.85; margin-top: 2px;">بطاقة حضور الطالب الذكية (QR Pass)</div>
          </div>
          <span style="font-family: monospace; font-size: 12px; background: rgba(255,255,255,0.16); padding: 4px 8px; border-radius: 6px; font-weight: 700;">
            ${escapeHtml(student.studentCode)}
          </span>
        </div>

        <div style="padding: 18px; display: flex; gap: 16px; align-items: center;">
          <div style="flex: 1; text-align: right; line-height: 1.7;">
            <div style="font-size: 17px; font-weight: 900; color: #0f172a; margin-bottom: 4px;">
              ${escapeHtml(student.fullName)}
            </div>
            <div style="font-size: 12px; color: #475569;">
              الصف الدراسي: <strong style="color: #0f172a;">${escapeHtml(student.gradeLevel)}</strong>
            </div>
            ${
              student.guardianPhone
                ? `<div style="font-size: 12px; color: #475569;">هاتف ولي الأمر: <strong dir="ltr">${escapeHtml(student.guardianPhone)}</strong></div>`
                : ''
            }
            ${groupsHtml}
          </div>

          <div style="width: 138px; flex-shrink: 0; border: 1px solid #cbd5e1; border-radius: 10px; padding: 6px; background: #fff; text-align: center;">
            <div style="width: 124px; height: 124px; margin: 0 auto;">
              ${qrSvg.replace(/width="[^"]*"/, 'width="124"').replace(/height="[^"]*"/, 'height="124"')}
            </div>
            <div style="font-family: monospace; font-size: 10px; color: #475569; margin-top: 4px;">
              ${escapeHtml(student.studentCode)}
            </div>
          </div>
        </div>

        <div style="background: #f8fafc; border-top: 1px dashed #cbd5e1; padding: 8px 14px; text-align: center; font-size: 11px; color: #475569;">
          يرجى إبراز الكارت أمام جهاز المسح في الريسبشن عند دخول الحصة
        </div>
      </div>
    </div>
  `;

  await printDocument({
    title: `كارت QR - ${student.fullName}`,
    bodyHtml,
    orientation: 'portrait',
  });
}
