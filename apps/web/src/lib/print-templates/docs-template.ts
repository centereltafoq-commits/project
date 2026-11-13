import { DocSection } from '@/features/docs/docs-data';
import { printDocument } from '../print-service';

export async function printDocGuideA4(section: DocSection): Promise<void> {
  const bodyHtml = `
    <div>
      <div class="header-banner">
        <div>
          <h1 class="center-title">دليل تشغيل واستخدام النظام • Nazzem Edu</h1>
          <p class="center-subtitle">مرجع التشغيل والتحقق المحاسبي والأكاديمي لإدارة السناتر والمراكز التعليمية</p>
        </div>
        <div class="meta-box">
          <div>القسم / الشاشة: <strong>${section.title}</strong></div>
          <div>التصنيف: <strong>${section.category}</strong></div>
          <div>تاريخ الطباعة: <strong>${new Date().toLocaleDateString('ar-EG')}</strong></div>
        </div>
      </div>

      <div style="border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 8px; padding: 14px; margin-bottom: 16px;">
        <div style="font-size: 13px; font-weight: 800; margin-bottom: 4px; color: #0f172a;">نبذة تعريفية بالصفحة ودورها:</div>
        <p style="margin: 0; font-size: 11px; color: #334155; line-height: 1.6;">${section.summary}</p>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-size: 13px; font-weight: 800; margin-bottom: 6px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; color: #0f172a;">
          الأهداف والمهام الرئيسية:
        </div>
        <ul style="padding-right: 20px; font-size: 11px; color: #334155; line-height: 1.7; margin: 6px 0;">
          ${section.purpose.map((p) => `<li>${p}</li>`).join('')}
        </ul>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-size: 13px; font-weight: 800; margin-bottom: 6px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; color: #0f172a;">
          أهم المزايا والقدرات التفاعلية:
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px;">
          ${section.keyFeatures
            .map(
              (f) => `
            <div style="border: 1px solid #e2e8f0; background: #fafafa; border-radius: 6px; padding: 8px 10px;">
              <div style="font-size: 11px; font-weight: bold; color: #1e3a8a;">${f.title}</div>
              <div style="font-size: 10px; color: #475569; margin-top: 2px;">${f.description}</div>
            </div>
          `,
            )
            .join('')}
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <div style="font-size: 13px; font-weight: 800; margin-bottom: 6px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; color: #0f172a;">
          خطوات التشغيل خطوة بخطوة (Workflow):
        </div>
        <div style="margin-top: 8px;">
          ${section.workflowSteps
            .map(
              (step) => `
            <div style="margin-bottom: 8px; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 6px; background: #ffffff;">
              <strong style="color: #0f172a; font-size: 12px;">${step.stepNumber}. ${step.title}:</strong>
              <div style="font-size: 11px; color: #475569; margin-top: 3px; line-height: 1.5;">${step.description}</div>
            </div>
          `,
            )
            .join('')}
        </div>
      </div>

      <div style="margin-bottom: 16px; border: 1.5px solid #f59e0b; background: #fffbeb; border-radius: 8px; padding: 14px;">
        <div style="font-size: 13px; font-weight: 800; color: #92400e; margin-bottom: 6px;">
          قواعد العمل والتنبيهات المحاسبية والأكاديمية الهامة:
        </div>
        <ul style="padding-right: 20px; font-size: 11px; color: #78350f; line-height: 1.7; margin: 0;">
          ${section.businessRules.map((r) => `<li>${r}</li>`).join('')}
        </ul>
      </div>

      <div style="font-size: 11px; color: #64748b; margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
        الصلاحيات والأدوار المطلوبة لهذه الصفحة: <strong>${section.permissions.join(' • ')}</strong>
      </div>

      <div class="official-footer">
        دليل التشغيل والاستخدام الرسمي • Nazzem Edu ERP • مرجع العمليات والرقابة الداخلية
      </div>
    </div>
  `;

  await printDocument({
    title: `دليل_${section.title}`,
    bodyHtml,
    orientation: 'portrait',
  });
}

