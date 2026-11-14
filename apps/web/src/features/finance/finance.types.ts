import {
  AssistantCalculationMethod,
  ExpenseCategory,
  PaymentMethod,
} from '@edu-center/shared';

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  [PaymentMethod.CASH]: 'نقدي (كاش)',
  [PaymentMethod.VODAFONE_CASH]: 'فودافون كاش',
  [PaymentMethod.INSTAPAY]: 'إنستاباي (InstaPay)',
  [PaymentMethod.BANK_TRANSFER]: 'تحويل بنكي',
  [PaymentMethod.CARD]: 'بطاقة بنكية',
};

export const PAYMENT_METHOD_OPTIONS = Object.entries(PAYMENT_METHOD_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  [ExpenseCategory.RENT]: 'الإيجار',
  [ExpenseCategory.ELECTRICITY_WATER]: 'الكهرباء والمياه',
  [ExpenseCategory.INTERNET]: 'الإنترنت',
  [ExpenseCategory.MAINTENANCE]: 'الصيانة',
  [ExpenseCategory.SUPPLIES]: 'الأدوات والمستلزمات',
  [ExpenseCategory.ADMINISTRATIVE]: 'المصروفات الإدارية',
  [ExpenseCategory.OTHER]: 'أخرى',
};

export const EXPENSE_CATEGORY_OPTIONS = Object.entries(EXPENSE_CATEGORY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export const ASSISTANT_METHOD_LABELS: Record<string, string> = {
  [AssistantCalculationMethod.SESSION_COMMISSION_PERCENT]: 'عمولة % من إيراد الحصص',
  [AssistantCalculationMethod.FIXED_PER_SESSION]: 'مبلغ ثابت لكل حصة',
  [AssistantCalculationMethod.HOURLY]: 'سعر بالساعة',
  [AssistantCalculationMethod.FIXED_PER_STUDENT]: 'مبلغ ثابت لكل طالب مقيد',
  [AssistantCalculationMethod.PER_ATTENDING_STUDENT]: 'مبلغ عن كل حضور طالب',
  [AssistantCalculationMethod.FIXED_MONTHLY]: 'راتب شهري ثابت',
  [AssistantCalculationMethod.CUSTOM_AGREEMENT]: 'اتفاق مالي مخصص',
};

export interface FinanceLookups {
  students: Array<{
    id: string;
    code: string;
    fullName: string;
    phone: string;
    gradeLevel: string;
  }>;
  groups: Array<{
    id: string;
    code: string;
    name: string;
    subject: string;
    gradeLevel: string;
    monthlyPrice: string;
  }>;
  teachers: Array<{
    id: string;
    code: string;
    fullName: string;
    specialization: string;
  }>;
  assistants: Array<{
    id: string;
    code: string;
    fullName: string;
    calculationMethod: string;
    rateValue: string;
  }>;
}

export interface MonthExecutiveSummary {
  yearMonth: string;
  isMonthClosed: boolean;
  students: {
    totalDue: number;
    totalPaid: number;
    remainingBalance: number;
  };
  teachers: {
    totalDues: number;
    totalPaidOut: number;
    remainingBalance: number;
  };
  assistants: {
    totalDues: number;
    totalPaidOut: number;
    remainingBalance: number;
  };
  expenses: {
    totalAmount: number;
  };
  netCenterProfit?: number;
  netCashFlow?: number;
}

export interface StudentMonthlyRecordRow {
  id: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  studentPhone: string | null;
  guardianPhone: string | null;
  groupId: string;
  groupCode: string;
  groupName: string;
  yearMonth: string;
  totalGroupSessions: number;
  eligibleSessions: number;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  sessionPriceSnapshot: number;
  totalDue: number;
  totalPaid: number;
  remainingBalance: number;
  isClosed: boolean;
}

export interface PaymentAllocationView {
  id?: string;
  groupId: string;
  groupName: string;
  groupCode?: string;
  allocatedAmount: number;
}

export interface PaymentRow {
  id: string;
  receiptNumber: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  studentPhone: string | null;
  guardianPhone?: string | null;
  yearMonth: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  receivedByName: string | null;
  notes: string | null;
  createdAt: string;
  allocations: PaymentAllocationView[];
}

export interface TeacherMonthlyRecordRow {
  id: string;
  teacherId: string;
  teacherCode: string;
  teacherName: string;
  teacherPhone: string;
  specialization: string;
  yearMonth: string;
  groupsCount: number;
  executedSessionsCount: number;
  totalDues: number;
  totalPaidOut: number;
  remainingBalance: number;
  isClosed: boolean;
  groupBreakdown: Array<{
    groupId: string;
    groupName: string;
    groupCode: string;
    executedSessionsCount: number;
    studentsCount: number;
    grossGroupRevenue: number;
    teacherAmount: number;
    centerAmount: number;
    calculationBreakdown: string | null;
  }>;
}

export interface TeacherPayoutRow {
  id: string;
  referenceNumber: string;
  teacherId: string;
  teacherCode: string;
  teacherName: string;
  yearMonth: string;
  amount: number;
  payoutDate: string;
  paymentMethod: string;
  paidByName: string | null;
  notes: string | null;
}

export interface AssistantMonthlyRecordRow {
  id: string;
  assistantId: string;
  assistantCode: string;
  assistantName: string;
  assistantPhone: string;
  yearMonth: string;
  calculationMethodSnapshot: string;
  totalDues: number;
  totalPaidOut: number;
  remainingBalance: number;
  detailsNote: string | null;
  isClosed: boolean;
}

export interface AssistantPayoutRow {
  id: string;
  referenceNumber: string;
  assistantId: string;
  assistantCode: string;
  assistantName: string;
  yearMonth: string;
  amount: number;
  payoutDate: string;
  paymentMethod: string;
  paidByName: string | null;
  notes: string | null;
}

export interface ExpenseRow {
  id: string;
  category: string;
  title: string;
  amount: number;
  expenseDate: string;
  yearMonth: string;
  paymentMethod: string;
  recordedByName: string | null;
  notes: string | null;
}

export type DailyLedgerEntryType =
  | 'ALL'
  | 'PAYMENT'
  | 'TEACHER_PAYOUT'
  | 'ASSISTANT_PAYOUT'
  | 'EXPENSE';

export interface DailyLedgerEntry {
  id: string;
  type: 'PAYMENT' | 'TEACHER_PAYOUT' | 'ASSISTANT_PAYOUT' | 'EXPENSE';
  direction: 'INFLOW' | 'OUTFLOW';
  date: string;
  yearMonth: string;
  referenceNumber: string;
  partyName: string;
  partyCode: string | null;
  categoryLabel: string;
  amount: number;
  paymentMethod: string;
  recordedByName: string | null;
  notes: string | null;
  createdAt: string;
}

export interface DailyLedgerDaySummary {
  date: string;
  paymentsCount: number;
  paymentsTotal: number;
  teacherPayoutsCount: number;
  teacherPayoutsTotal: number;
  assistantPayoutsCount: number;
  assistantPayoutsTotal: number;
  expensesCount: number;
  expensesTotal: number;
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  totalTransactionsCount: number;
}

export interface DailyLedgerSummary {
  paymentsCount: number;
  paymentsTotal: number;
  teacherPayoutsCount: number;
  teacherPayoutsTotal: number;
  assistantPayoutsCount: number;
  assistantPayoutsTotal: number;
  expensesCount: number;
  expensesTotal: number;
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
}

export interface DailyLedgerResponse {
  yearMonth: string;
  selectedDate: string | null;
  daysSummary: DailyLedgerDaySummary[];
  summary: DailyLedgerSummary;
  entries: DailyLedgerEntry[];
}

