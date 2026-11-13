import { ReportType } from '../dto/report-query.dto';

interface CsvColumnDef {
  key: string;
  header: string;
}

const REPORT_CSV_COLUMNS: Record<ReportType, CsvColumnDef[]> = {
  students: [
    { key: 'studentCode', header: 'كود الطالب' },
    { key: 'fullName', header: 'اسم الطالب' },
    { key: 'phone', header: 'رقم الهاتف' },
    { key: 'guardianPhone', header: 'هاتف ولي الأمر' },
    { key: 'gradeLevel', header: 'المرحلة الدراسية' },
    { key: 'statusAr', header: 'الحالة' },
    { key: 'activeGroupsCount', header: 'عدد المجموعات النشطة' },
  ],
  attendance: [
    { key: 'studentCode', header: 'كود الطالب' },
    { key: 'studentName', header: 'اسم الطالب' },
    { key: 'groupName', header: 'المجموعة' },
    { key: 'presentCount', header: 'حضور' },
    { key: 'absentCount', header: 'غياب' },
    { key: 'excusedCount', header: 'بعذر' },
    { key: 'attendanceRate', header: 'نسبة الحضور %' },
  ],
  'student-statement': [
    { key: 'studentCode', header: 'كود الطالب' },
    { key: 'studentName', header: 'اسم الطالب' },
    { key: 'groupName', header: 'المجموعة' },
    { key: 'yearMonth', header: 'الشهر' },
    { key: 'totalDue', header: 'إجمالي المستحق (ج.م)' },
    { key: 'totalPaid', header: 'المدفوع (ج.م)' },
    { key: 'remainingBalance', header: 'المتبقي (ج.م)' },
  ],
  'groups-revenue': [
    { key: 'groupCode', header: 'كود المجموعة' },
    { key: 'groupName', header: 'اسم المجموعة' },
    { key: 'teacherName', header: 'المدرس' },
    { key: 'studentsCount', header: 'عدد الطلاب' },
    { key: 'grossRevenue', header: 'إجمالي المستحق (ج.م)' },
    { key: 'teacherShare', header: 'نصيب المدرس (ج.م)' },
    { key: 'centerShare', header: 'نصيب السنتر (ج.م)' },
  ],
  'teacher-statement': [
    { key: 'teacherCode', header: 'كود المدرس' },
    { key: 'teacherName', header: 'اسم المدرس' },
    { key: 'yearMonth', header: 'الشهر' },
    { key: 'groupsCount', header: 'المجموعات' },
    { key: 'executedSessionsCount', header: 'الحصص المنفذة' },
    { key: 'totalDues', header: 'إجمالي المستحق (ج.م)' },
    { key: 'totalPaidOut', header: 'المنصرف (ج.م)' },
    { key: 'remainingBalance', header: 'المتبقي (ج.م)' },
  ],
  'assistant-statement': [
    { key: 'assistantCode', header: 'كود المساعد' },
    { key: 'assistantName', header: 'اسم المساعد' },
    { key: 'yearMonth', header: 'الشهر' },
    { key: 'calculationMethodAr', header: 'طريقة الحساب' },
    { key: 'totalDues', header: 'المستحق (ج.م)' },
    { key: 'totalPaidOut', header: 'المنصرف (ج.م)' },
    { key: 'remainingBalance', header: 'المتبقي (ج.م)' },
  ],
  collections: [
    { key: 'receiptNumber', header: 'رقم الإيصال' },
    { key: 'paymentDate', header: 'التاريخ' },
    { key: 'studentName', header: 'الطالب' },
    { key: 'yearMonth', header: 'شهر الاستحقاق' },
    { key: 'amount', header: 'المبلغ (ج.م)' },
    { key: 'paymentMethodAr', header: 'طريقة الدفع' },
    { key: 'collectorName', header: 'المحصّل' },
  ],
  expenses: [
    { key: 'expenseDate', header: 'التاريخ' },
    { key: 'categoryAr', header: 'البند / الفئة' },
    { key: 'title', header: 'الوصف' },
    { key: 'amount', header: 'المبلغ (ج.م)' },
    { key: 'paymentMethodAr', header: 'طريقة الدفع' },
    { key: 'recordedByName', header: 'المسجّل' },
  ],
  classrooms: [
    { key: 'roomNumber', header: 'رقم القاعة' },
    { key: 'name', header: 'اسم القاعة' },
    { key: 'maxCapacity', header: 'السعة القصوى' },
    { key: 'statusAr', header: 'الحالة' },
    { key: 'sessionsCount', header: 'عدد الحصص' },
  ],
  'financial-summary': [
    { key: 'sectionAr', header: 'القسم المالي' },
    { key: 'lineItemAr', header: 'البند' },
    { key: 'amount', header: 'القيمة (ج.م)' },
    { key: 'notes', header: 'ملاحظات وإيضاحات' },
  ],
};

function escapeCsvValue(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  let text = String(raw);
  // Prevent CSV formula injection in spreadsheet software
  if (/^[=+\-@]/.test(text) && Number.isNaN(Number(text))) {
    text = `'${text}`;
  }
  if (text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildUtf8BomCsv(
  reportType: ReportType,
  rows: Array<Record<string, unknown>>,
): string {
  const columns = REPORT_CSV_COLUMNS[reportType];
  const headerLine = columns.map((c) => escapeCsvValue(c.header)).join(',');
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCsvValue(row[c.key])).join(','),
  );
  // Prepend UTF-8 BOM (\uFEFF) so Microsoft Excel opens Arabic characters cleanly
  return `\uFEFF${[headerLine, ...dataLines].join('\r\n')}`;
}
