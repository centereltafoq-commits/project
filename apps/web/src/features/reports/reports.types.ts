import {
  Banknote,
  BarChart3,
  BookOpen,
  Building2,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  LucideIcon,
  Receipt,
  UserCheck,
  Users,
} from 'lucide-react';
import { PaginatedResult, PERMISSIONS, PermissionCode } from '@edu-center/shared';

export type ReportTypeSlug =
  | 'students'
  | 'attendance'
  | 'student-statement'
  | 'groups-revenue'
  | 'teacher-statement'
  | 'assistant-statement'
  | 'collections'
  | 'expenses'
  | 'classrooms'
  | 'financial-summary';

export interface ReportSummaryKpiItem {
  key: string;
  label: string;
  value: number | string;
  format?: 'currency' | 'number' | 'percent' | 'text';
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'purple';
}

export interface ReportApiResponse<T = Record<string, unknown>> extends PaginatedResult<T> {
  reportType: ReportTypeSlug;
  titleAr: string;
  yearMonth: string;
  generatedAt: string;
  summary: ReportSummaryKpiItem[];
}

export interface ReportFilterOptionItem {
  id: string;
  code: string;
  label: string;
}

export interface ReportFilterOptionsData {
  groups: ReportFilterOptionItem[];
  teachers: ReportFilterOptionItem[];
  students: ReportFilterOptionItem[];
}

export interface ReportDefinition {
  slug: ReportTypeSlug;
  shortTitle: string;
  fullTitle: string;
  icon: LucideIcon;
  usesMonth: boolean;
  usesDate?: boolean;
  usesGroup: boolean;
  usesTeacher: boolean;
  usesStudent: boolean;
  requiredPermission?: PermissionCode | string;
}

export const ALL_REPORTS_DEFINITIONS: ReportDefinition[] = [
  {
    slug: 'students',
    shortTitle: '1. الطلاب والاشتراكات',
    fullTitle: 'تقرير الطلاب والاشتراكات النشطة',
    icon: GraduationCap,
    usesMonth: false,
    usesDate: false,
    usesGroup: true,
    usesTeacher: true,
    usesStudent: true,
    requiredPermission: PERMISSIONS.STUDENTS_VIEW,
  },
  {
    slug: 'attendance',
    shortTitle: '2. الحضور والغياب',
    fullTitle: 'تقرير الحضور والغياب حسب الشهر أو اليوم',
    icon: ClipboardCheck,
    usesMonth: true,
    usesDate: true,
    usesGroup: true,
    usesTeacher: true,
    usesStudent: true,
    requiredPermission: PERMISSIONS.ATTENDANCE_VIEW,
  },
  {
    slug: 'student-statement',
    shortTitle: '3. كشف حساب الطالب',
    fullTitle: 'كشف حساب الطالب والمستحقات الشهرية',
    icon: FileSpreadsheet,
    usesMonth: true,
    usesDate: true,
    usesGroup: true,
    usesTeacher: true,
    usesStudent: true,
    requiredPermission: PERMISSIONS.FINANCE_VIEW,
  },
  {
    slug: 'groups-revenue',
    shortTitle: '4. إيرادات المجموعات',
    fullTitle: 'تقرير المجموعات وإيرادات كل مجموعة وتوزيع الأنصبة',
    icon: BookOpen,
    usesMonth: true,
    usesDate: true,
    usesGroup: true,
    usesTeacher: true,
    usesStudent: false,
    requiredPermission: PERMISSIONS.FINANCE_VIEW,
  },
  {
    slug: 'teacher-statement',
    shortTitle: '5. كشف المدرس',
    fullTitle: 'كشف المدرس ومستحقاته والمنصرف الشهري',
    icon: UserCheck,
    usesMonth: true,
    usesDate: true,
    usesGroup: true,
    usesTeacher: true,
    usesStudent: false,
    requiredPermission: PERMISSIONS.FINANCE_VIEW,
  },
  {
    slug: 'assistant-statement',
    shortTitle: '6. كشف المساعد',
    fullTitle: 'كشف المساعد وطريقة الحساب والمستحقات',
    icon: Users,
    usesMonth: true,
    usesDate: true,
    usesGroup: false,
    usesTeacher: false,
    usesStudent: false,
    requiredPermission: PERMISSIONS.FINANCE_VIEW,
  },
  {
    slug: 'collections',
    shortTitle: '7. التحصيل والمدفوعات',
    fullTitle: 'تقرير التحصيل وجميع إيصالات المدفوعات (شهري / يومي)',
    icon: Banknote,
    usesMonth: true,
    usesDate: true,
    usesGroup: true,
    usesTeacher: true,
    usesStudent: true,
    requiredPermission: PERMISSIONS.FINANCE_VIEW,
  },
  {
    slug: 'expenses',
    shortTitle: '8. المصروفات التشغيلية',
    fullTitle: 'تقرير المصروفات التشغيلية حسب الشهر أو اليوم',
    icon: Receipt,
    usesMonth: true,
    usesDate: true,
    usesGroup: false,
    usesTeacher: false,
    usesStudent: false,
    requiredPermission: PERMISSIONS.FINANCE_VIEW,
  },
  {
    slug: 'classrooms',
    shortTitle: '9. استخدام القاعات',
    fullTitle: 'تقرير القاعات والسعة ومعدلات الاستخدام',
    icon: Building2,
    usesMonth: true,
    usesDate: true,
    usesGroup: false,
    usesTeacher: false,
    usesStudent: false,
    requiredPermission: PERMISSIONS.CLASSROOMS_VIEW,
  },
  {
    slug: 'financial-summary',
    shortTitle: '10. التقرير المالي الشامل',
    fullTitle: 'التقرير المالي الشامل للسنتر وصافي النتيجة (شهري / يومي)',
    icon: BarChart3,
    usesMonth: true,
    usesDate: true,
    usesGroup: false,
    usesTeacher: false,
    usesStudent: false,
    requiredPermission: PERMISSIONS.FINANCE_VIEW,
  },
];
