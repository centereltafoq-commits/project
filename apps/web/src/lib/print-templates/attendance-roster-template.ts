import { CenterSettings } from '@/features/settings/settings.types';
import { formatDateAr } from '@/lib/formatters';
import { printDocument } from '../print-service';

export interface AttendanceSheetPrintOptions {
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
}

export async function printAttendanceSheetA4(options: AttendanceSheetPrintOptions): Promise<void> {
  const { session, students, settings } = options;
  const centerName = settings.centerName || 'سنتر النخبة التعليمي';
  const formattedDate = formatDateAr(session.sessionDate);

  const studentRows = students
    .map(
      (st, idx) => `
      <tr>
        <td style="width: 30px; text-align: center;">${idx + 1}</td>
        <td style="font-family: monospace; font-size: 11px; text-align: center; font-weight: bold; color: #1e3a8a;">${st.studentCode}</td>
        <td style="font-weight: 700; color: #0f172a;">${st.studentName}</td>
        <td style="font-size: 10px; color: #475569; font-family: monospace;">${st.phone || '—'}</td>
        <td style="font-size: 10px; color: #475569; font-family: monospace;">${st.parentPhone || '—'}</td>
        <td style="width: 80px; text-align: center; font-weight: bold;">
          ${
            st.status === 'PRESENT'
              ? '<span style="color: #166534; background: #dcfce7; padding: 2px 6px; border-radius: 4px; font-size: 10px;">✓ حاضر</span>'
              : st.status === 'ABSENT'
                ? '<span style="color: #991b1b; background: #fee2e2; padding: 2px 6px; border-radius: 4px; font-size: 10px;">✗ غائب</span>'
                : st.status === 'LATE'
                  ? '<span style="color: #854d0e; background: #fef9c3; padding: 2px 6px; border-radius: 4px; font-size: 10px;">متأخر</span>'
                  : st.status === 'EXCUSED'
                    ? '<span style="color: #1e40af; background: #eff6ff; padding: 2px 6px; border-radius: 4px; font-size: 10px;">معذور</span>'
                    : '<span style="color: #94a3b8;">[   ]</span>'
          }
        </td>
        <td style="width: 65px; text-align: center; font-size: 10px; color: #64748b;">[ &nbsp; ]</td>
        <td style="font-size: 10px; color: #475569;">${st.notes || ''}</td>
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
            <p class="center-subtitle">كشف رصد الحضور والغياب والواجبات الميداني • المتابعة الأكاديمية</p>
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
        <span>إجمالي الطلاب المقيدين بالكشف: <strong>${students.length} طالب</strong></span>
        <span>تاريخ وتوقيت الطباعة: ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 30px; text-align: center;">م</th>
            <th style="width: 75px; text-align: center;">الكود</th>
            <th>اسم الطالب بالكامل</th>
            <th style="width: 95px;">هاتف الطالب</th>
            <th style="width: 95px;">هاتف ولي الأمر</th>
            <th style="width: 80px; text-align: center;">حالة الحضور</th>
            <th style="width: 65px; text-align: center;">الواجب</th>
            <th>ملاحظات وتوجيهات المعلم</th>
          </tr>
        </thead>
        <tbody>
          ${studentRows}
        </tbody>
      </table>

      <div class="signatures-row" style="margin-top: 26px;">
        <div class="signature-box">
          <div class="signature-title">توقيع مدرس المادة</div>
          <div style="font-size: 10px; color: #475569; margin-bottom: 25px;">${session.teacherName || 'مدرس المادة'}</div>
          <div class="signature-line">التوقيع والاعتماد</div>
        </div>
        <div class="signature-box" style="display: flex; align-items: center; justify-content: center;">
          <div class="stamp-box">ختم الحضور</div>
        </div>
        <div class="signature-box">
          <div class="signature-title">مسؤول الرصد والمتابعة</div>
          <div style="font-size: 10px; color: #475569; margin-bottom: 25px;">إدارة شؤون الطلاب</div>
          <div class="signature-line">اعتماد رصد الحصة</div>
        </div>
      </div>

      <div class="official-footer">
        كشف رصد حضور وغياب رسمي معتمد للحصص الدراسية • يُسلّم للإدارة فور انتهاء الحصة
      </div>
    </div>
  `;

  await printDocument({
    title: `كشف_حضور_${session.groupName}_${formattedDate}`,
    bodyHtml,
    orientation: 'portrait',
  });
}

