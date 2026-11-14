import { AssistantCalculationMethod } from '@edu-center/shared';

export interface AssistantRow {
  id: string;
  assistantCode: string;
  fullName: string;
  phone: string;
  calculationMethod: AssistantCalculationMethod;
  rateValue: string;
  customFormulaNote: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  linkedGroupsCount?: number;
  createdAt: string;
}

export type AssistantPayoutStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'NO_DUES';

export interface AssistantMonthOverviewItem {
  yearMonth: string;
  payoutStatus: AssistantPayoutStatus;
  groupsCount: number;
  executedSessionsCount: number;
  totalDues: number;
  totalPayouts: number;
  remainingBalance: number;
  payoutsCount: number;
  isClosed: boolean;
}

export const ASSISTANT_PAYOUT_STATUS_META: Record<
  AssistantPayoutStatus,
  {
    label: string;
    badgeVariant: 'success' | 'warning' | 'danger' | 'neutral';
    cardBorderClass: string;
    activeRingClass: string;
  }
> = {
  PAID: {
    label: 'تم الصرف بالكامل',
    badgeVariant: 'success',
    cardBorderClass: 'border-emerald-500/35 hover:border-emerald-500/70',
    activeRingClass: 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-500/5',
  },
  PARTIAL: {
    label: 'صرف جزئي',
    badgeVariant: 'warning',
    cardBorderClass: 'border-amber-500/40 hover:border-amber-500/80',
    activeRingClass: 'ring-2 ring-amber-500 border-amber-500 bg-amber-500/5',
  },
  UNPAID: {
    label: 'لم يُصرف',
    badgeVariant: 'danger',
    cardBorderClass: 'border-rose-500/40 hover:border-rose-500/80',
    activeRingClass: 'ring-2 ring-rose-500 border-rose-500 bg-rose-500/5',
  },
  NO_DUES: {
    label: 'لا توجد مستحقات',
    badgeVariant: 'neutral',
    cardBorderClass: 'border-border hover:border-primary/40',
    activeRingClass: 'ring-2 ring-primary border-primary bg-primary/5',
  },
};

export interface AssistantProfileData {
  assistant: AssistantRow;
  yearMonth: string;
  linkedGroups: Array<{
    linkId: string;
    groupId: string;
    groupCode: string;
    groupName: string;
    subject: string;
    gradeLevel: string;
    teacherName: string;
    monthlySessionsCount: number;
    monthlyPrice: string;
    isActive: boolean;
    overrideCalculationMethod: AssistantCalculationMethod | null;
    overrideRateValue: string | null;
    activeStudentsCount: number;
  }>;
  monthsOverview?: AssistantMonthOverviewItem[];
  monthlyBreakdown: {
    groupDues: Array<{
      groupId: string;
      groupName: string;
      calculationMethod: string;
      rateValue: number;
      sessionsCount: number;
      studentsCount: number;
      amount: number;
      isLocked: boolean;
    }>;
    baseGlobalDue: number;
    totalDues: number;
    totalPayouts: number;
    remainingBalance: number;
    isClosed: boolean;
  };
  payouts: Array<{
    id: string;
    referenceNumber: string;
    yearMonth: string;
    amount: string;
    payoutDate: string;
    paymentMethod: string;
    notes: string | null;
  }>;
}

export const ASSISTANT_CALC_METHOD_LABELS: Record<AssistantCalculationMethod, string> = {
  [AssistantCalculationMethod.FIXED_PER_STUDENT]: 'مبلغ ثابت عن كل طالب مشترك',
  [AssistantCalculationMethod.PER_ATTENDING_STUDENT]: 'مبلغ عن كل طالب حاضر بالحصة',
  [AssistantCalculationMethod.FIXED_PER_SESSION]: 'مبلغ ثابت عن كل حصة منفذة',
  [AssistantCalculationMethod.HOURLY]: 'أجر بالساعة التدريسية',
  [AssistantCalculationMethod.FIXED_MONTHLY]: 'راتب / مبلغ شهري ثابت',
  [AssistantCalculationMethod.SESSION_COMMISSION_PERCENT]: 'نسبة مئوية من إيراد الحصص (%)',
  [AssistantCalculationMethod.CUSTOM_AGREEMENT]: 'اتفاق مخصص (صيغة خاصة)',
};

export const ASSISTANT_CALC_METHOD_OPTIONS = Object.entries(ASSISTANT_CALC_METHOD_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export const ASSISTANT_STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'نشط' },
  { value: 'INACTIVE', label: 'متوقف' },
];
