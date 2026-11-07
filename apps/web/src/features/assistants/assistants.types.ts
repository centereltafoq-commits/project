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
