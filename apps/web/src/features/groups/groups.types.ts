import {
  AssistantCalculationMethod,
  EnrollmentStatus,
  FullMonthAbsencePolicy,
  GroupRevenueSplitMethod,
} from '@edu-center/shared';

export interface GroupScheduleSlotItem {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classroomId?: string | null;
}

export interface GroupRow {
  id: string;
  groupCode: string;
  name: string;
  subject: string;
  gradeLevel: string;
  primaryTeacherId: string;
  primaryTeacherName: string;
  defaultClassroomId: string | null;
  defaultClassroomName: string | null;
  monthlySessionsCount: number;
  monthlyPrice: string;
  calculatedSessionPrice: string;
  scheduleSlots: GroupScheduleSlotItem[];
  maxStudents: number;
  isActive: boolean;
  notes: string | null;
  activeStudentsCount: number;
  revenueSplitMethod: GroupRevenueSplitMethod | null;
  teacherSharePerStudent: string | null;
  centerSharePerStudent: string | null;
  teacherPercentage: string | null;
  fullMonthAbsencePolicy: FullMonthAbsencePolicy | null;
  chargeExcusedAbsence: boolean | null;
}

export interface GroupDetailData extends GroupRow {
  financialPolicy: {
    revenueSplitMethod: GroupRevenueSplitMethod;
    teacherSharePerStudent: string;
    centerSharePerStudent: string;
    teacherPercentage: string;
    fullMonthAbsencePolicy: FullMonthAbsencePolicy;
    fullAbsenceFixedFee: string;
    chargeExcusedAbsence: boolean;
  } | null;
  teachers: Array<{
    teacherId: string;
    fullName: string;
    specialization: string;
    isPrimary: boolean;
  }>;
  assistants: Array<{
    linkId: string;
    assistantId: string;
    fullName: string;
    assistantCode: string;
    defaultMethod: AssistantCalculationMethod;
    defaultRate: string;
    overrideCalculationMethod: AssistantCalculationMethod | null;
    overrideRateValue: string | null;
  }>;
}

export interface EnrollmentRow {
  id: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  studentPhone: string;
  guardianPhone: string;
  gradeLevel: string;
  groupId: string;
  startDate: string;
  endDate: string | null;
  agreedMonthlyPrice: string;
  agreedSessionsCount: number;
  agreedSessionPrice: string;
  status: EnrollmentStatus;
  notes: string | null;
}

export const REVENUE_SPLIT_OPTIONS = [
  {
    value: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
    label: 'حسب نسبة الحضور الفعلي للحصص',
  },
  {
    value: GroupRevenueSplitMethod.FIXED_PER_STUDENT,
    label: 'حصة ثابتة عن كل طالب مشترك',
  },
  {
    value: GroupRevenueSplitMethod.FIXED_PER_SESSION,
    label: 'مبلغ ثابت للمدرس عن كل حصة منفذة',
  },
  {
    value: GroupRevenueSplitMethod.CUSTOM_PERCENTAGE,
    label: 'نسبة مئوية للمدرس من الإيراد (%)',
  },
];

export const FULL_ABSENCE_POLICY_OPTIONS = [
  {
    value: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
    label: 'إعفاء كامل عند الغياب طوال الشهر',
  },
  {
    value: FullMonthAbsencePolicy.CHARGE_FIXED_RESERVATION_FEE,
    label: 'تحصيل رسوم حجز مقعد ثابتة',
  },
  {
    value: FullMonthAbsencePolicy.CHARGE_FULL_SUBSCRIPTION,
    label: 'تحصيل الاشتراك الشهري كاملاً',
  },
];

export const FULL_ABSENCE_POLICY_LABELS: Record<string, string> = {
  EXEMPT_FULL_ABSENCE: 'إعفاء كامل عند غياب الشهر',
  CHARGE_FIXED_RESERVATION_FEE: 'رسوم حجز مقعد ثابتة',
  CHARGE_FULL_SUBSCRIPTION: 'تحصيل الاشتراك كاملاً',
};

export const ENROLLMENT_STATUS_OPTIONS = [
  { value: EnrollmentStatus.ACTIVE, label: 'نشط' },
  { value: EnrollmentStatus.PAUSED, label: 'موقوف مؤقتاً' },
  { value: EnrollmentStatus.CANCELLED, label: 'متوقف / ملغي' },
  { value: EnrollmentStatus.COMPLETED, label: 'مكتمل' },
];
