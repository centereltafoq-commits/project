import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  printDocument,
  printReceiptA4,
  printAttendanceSheetA4,
  printReportA4,
  printReportBySlug,
  printDocGuideA4,
  buildThermalReceiptHtml,
  ReportTypeSlug,
} from './print-service';

describe('Print Service (Modular Enterprise A4 & POS Print Engine)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.print = vi.fn();
  });

  it('prints document inside an isolated iframe and calls print', async () => {
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');

    await printDocument({
      title: 'مستند تجريبي',
      bodyHtml: '<div>محتوى تجريبي للطباعة</div>',
      orientation: 'portrait',
    });

    expect(appendChildSpy).toHaveBeenCalled();
    expect(window.print).toHaveBeenCalled();
  });

  it('generates an official A4 receipt with student details and allocations', async () => {
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');

    await printReceiptA4({
      receipt: {
        receiptNumber: 'REC-2026-0001',
        studentName: 'أحمد محمود',
        studentCode: 'STD-101',
        parentPhone: '01012345678',
        paymentDate: '2026-11-13',
        yearMonth: '2026-11',
        paymentMethod: 'CASH',
        amount: 250,
        receivedByName: 'أمين الخزينة',
        allocations: [
          { groupName: 'فيزياء ثانوية عامة', groupCode: 'GRP-PHY-01', allocatedAmount: 250 },
        ],
      },
      settings: {
        centerName: 'سنتر النخبة التعليمي',
        currencySymbol: 'ج.م',
      },
    });

    expect(appendChildSpy).toHaveBeenCalled();
    expect(window.print).toHaveBeenCalled();
  });

  it('generates a POS 80mm thermal receipt html', () => {
    const html = buildThermalReceiptHtml(
      {
        receiptNumber: 'REC-2026-0002',
        studentName: 'سارة طارق',
        studentCode: 'STD-202',
        paymentDate: '2026-11-13',
        yearMonth: '2026-11',
        paymentMethod: 'VODAFONE_CASH',
        amount: 300,
      },
      { centerName: 'سنتر النخبة التعليمي' },
    );

    expect(html).toContain('REC-2026-0002');
    expect(html).toContain('سارة طارق');
    expect(html).toContain('سنتر النخبة التعليمي');
  });

  it('generates an official A4 attendance roster with students and session details', async () => {
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');

    await printAttendanceSheetA4({
      session: {
        groupName: 'كيمياء الصف الأول الثانوي',
        teacherName: 'أ/ محمد إبراهيم',
        classroomName: 'قاعة 101',
        sessionDate: '2026-11-13',
        startTime: '10:00',
        endTime: '12:00',
        topic: 'مراجعة الباب الثاني',
      },
      students: [
        {
          studentCode: 'STD-001',
          studentName: 'محمود سامي',
          phone: '01000000001',
          parentPhone: '01000000002',
          status: 'PRESENT',
        },
        {
          studentCode: 'STD-002',
          studentName: 'سارة خالد',
          phone: '01000000003',
          parentPhone: '01000000004',
          status: 'ABSENT',
        },
      ],
      settings: {
        centerName: 'سنتر النخبة التعليمي',
      },
    });

    expect(appendChildSpy).toHaveBeenCalled();
    expect(window.print).toHaveBeenCalled();
  });

  it('prints documentation guide A4', async () => {
    await printDocGuideA4({
      id: 'dashboard',
      title: 'لوحة التحكم والمؤشرات',
      category: 'التشغيل اليومي',
      iconName: 'LayoutDashboard',
      summary: 'شاشة المؤشرات الرئيسية للسنتر',
      purpose: ['متابعة الحضور', 'متابعة الإيرادات'],
      keyFeatures: [{ title: 'مؤشرات فورية', description: 'تحديث حي' }],
      workflowSteps: [{ stepNumber: 1, title: 'تسجيل الدخول', description: 'عرض الإحصائيات' }],
      businessRules: ['تحديث البيانات كل 60 ثانية'],
      pageRoute: '/',
      permissions: ['DASHBOARD_VIEW'],
    });

    expect(window.print).toHaveBeenCalled();
  });

  const ALL_REPORT_SLUGS: ReportTypeSlug[] = [
    'students',
    'attendance',
    'student-statement',
    'groups-revenue',
    'teacher-statement',
    'assistant-statement',
    'collections',
    'expenses',
    'bookings',
    'classrooms',
    'financial-summary',
  ];

  it.each(ALL_REPORT_SLUGS)(
    'prints dedicated specialized report for slug: %s',
    async (slug) => {
      await printReportBySlug({
        slug,
        title: `تقرير تجريبي - ${slug}`,
        yearMonth: '2026-11',
        filterSummary: 'مرشح تجريبي',
        summary: [
          { key: 'total', label: 'الإجمالي', value: 1000, format: 'currency' },
          { key: 'count', label: 'العدد', value: 25, format: 'number' },
        ],
        rows: [
          {
            studentCode: 'STD-001',
            fullName: 'طالب تجريبي',
            studentName: 'طالب تجريبي',
            groupCode: 'GRP-01',
            groupName: 'مجموعة تجريبية',
            teacherCode: 'TCH-01',
            teacherName: 'مدرس تجريبي',
            assistantCode: 'AST-01',
            assistantName: 'مساعد تجريبي',
            receiptNumber: 'REC-001',
            expenseDate: '2026-11-13',
            amount: 500,
            roomNumber: '101',
            name: 'قاعة 101',
            sectionAr: 'الإيرادات',
            lineItemAr: 'إيراد المجموعات',
          },
        ],
        settings: {
          centerName: 'سنتر النخبة التعليمي',
          currencySymbol: 'ج.م',
        },
      });

      expect(window.print).toHaveBeenCalled();
    },
  );

  it('supports legacy printReportA4 backward compatibility', async () => {
    await printReportA4({
      reportTitle: 'تقرير عام',
      columns: [{ header: 'الاسم', accessorKey: 'name' }],
      rows: [{ name: 'تجربة' }],
      settings: { centerName: 'السنتر' },
    });

    expect(window.print).toHaveBeenCalled();
  });
});
