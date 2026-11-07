import { ReportType } from '../dto/report-query.dto';

export const REPORT_TITLES_AR: Record<ReportType, string> = {
  students: 'تقرير الطلاب والاشتراكات',
  attendance: 'تقرير الحضور والغياب حسب الشهر',
  'student-statement': 'كشف حساب الطالب التفصيلي',
  'groups-revenue': 'تقرير المجموعات وإيرادات كل مجموعة',
  'teacher-statement': 'كشف المدرس ومستحقاته الشهرية',
  'assistant-statement': 'كشف المساعد ومستحقاته الشهرية',
  collections: 'تقرير التحصيل وجميع المدفوعات',
  expenses: 'تقرير المصروفات التشغيلية حسب الشهر',
  bookings: 'تقرير حجوزات المواعيد والقاعات',
  classrooms: 'تقرير القاعات ومعدلات استخدامها',
  'financial-summary': 'التقرير المالي الشامل للسنتر',
};

export const STUDENT_STATUS_AR: Record<string, string> = {
  ACTIVE: 'نشط',
  SUSPENDED: 'موقوف مؤقتاً',
  ARCHIVED: 'مؤرشف',
};

export const ASSISTANT_METHOD_AR: Record<string, string> = {
  FIXED_PER_STUDENT: 'مبلغ ثابت لكل طالب',
  PER_ATTENDING_STUDENT: 'حسب الطلاب الحاضرين',
  FIXED_PER_SESSION: 'مبلغ ثابت للحصة',
  FIXED_MONTHLY: 'راتب شهري ثابت',
  SESSION_COMMISSION_PERCENT: 'نسبة مئوية من إيراد الحصة',
  HOURLY: 'أجر بالساعة',
  CUSTOM_AGREEMENT: 'اتفاق مخصص',
};

export const PAYMENT_METHOD_AR: Record<string, string> = {
  CASH: 'نقدي (خزينة)',
  VODAFONE_CASH: 'فودافون كاش',
  INSTAPAY: 'إنستا باي (InstaPay)',
  BANK_TRANSFER: 'تحويل بنكي',
  CARD: 'بطاقة بنكية',
};

export const EXPENSE_CATEGORY_AR: Record<string, string> = {
  RENT: 'إيجار المقر',
  ELECTRICITY_WATER: 'كهرباء ومياه ومرافق',
  INTERNET: 'إنترنت واتصالات',
  MAINTENANCE: 'صيانة وتجهيزات',
  SUPPLIES: 'مستلزمات مطبوعات وأدوات',
  ADMINISTRATIVE: 'مصروفات إدارية وتشغيلية',
  OTHER: 'مصروفات أخرى',
};

export const BOOKING_TYPE_AR: Record<string, string> = {
  STUDENT_WITH_TEACHER: 'طالب مع مدرس',
  TEACHER_WITH_CENTER: 'حجز قاعة لمدرس',
};

export const BOOKING_STATUS_AR: Record<string, string> = {
  PENDING: 'معلق',
  CONFIRMED: 'معتمد',
  REJECTED: 'مرفوض',
  CANCELLED: 'ملغى',
  COMPLETED: 'منفذ',
};

export const CLASSROOM_STATUS_AR: Record<string, string> = {
  AVAILABLE: 'متاحة للتشغيل',
  MAINTENANCE: 'تحت الصيانة',
  INACTIVE: 'غير نشطة',
};
