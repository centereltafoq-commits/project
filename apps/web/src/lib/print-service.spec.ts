import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  printDocument,
  printReceiptA4,
  printAttendanceSheetA4,
  printReportA4,
} from './print-service';

describe('Print Service (A4 Isolated Print Engine)', () => {
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

  it('generates an official A4 report with summary KPI cards and columns', async () => {
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');

    await printReportA4({
      reportTitle: 'تقرير إيرادات المجموعات',
      categoryLabel: 'المالية والمحاسبة',
      summaryCards: [
        { label: 'إجمالي الإيرادات', value: '50,000 ج.م' },
        { label: 'عدد الطلاب', value: 120 },
      ],
      columns: [
        { header: 'المجموعة', accessorKey: 'groupName' },
        { header: 'المبلغ', accessorKey: 'amount' },
      ],
      rows: [
        { groupName: 'مجموعة أ', amount: '25,000 ج.م' },
        { groupName: 'مجموعة ب', amount: '25,000 ج.م' },
      ],
      settings: {
        centerName: 'سنتر النخبة التعليمي',
      },
    });

    expect(appendChildSpy).toHaveBeenCalled();
    expect(window.print).toHaveBeenCalled();
  });
});
