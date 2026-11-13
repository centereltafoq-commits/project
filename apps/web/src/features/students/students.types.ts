import {
  AttendanceStatus,
  EnrollmentStatus,
  StudentStatus,
} from '@edu-center/shared';

export interface StudentRow {
  id: string;
  studentCode: string;
  fullName: string;
  phone: string | null;
  guardianPhone: string | null;
  gradeLevel: string;
  registrationDate: string;
  status: StudentStatus;
  notes: string | null;
  activeGroupsCount?: number;
  createdAt: string;
}

export interface StudentMonthlyBreakdownItem {
  groupId: string;
  groupName: string;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  excusedCount: number;
  sessionPrice: number;
  totalDue: number;
  totalPaid: number;
  remaining: number;
  isClosed: boolean;
}

export interface StudentProfileData {
  student: StudentRow;
  yearMonth: string;
  enrollments: Array<{
    id: string;
    groupId: string;
    groupCode: string;
    groupName: string;
    subject: string;
    gradeLevel: string;
    teacherName: string;
    startDate: string;
    endDate: string | null;
    agreedMonthlyPrice: string;
    agreedSessionsCount: number;
    agreedSessionPrice: string;
    status: EnrollmentStatus;
    notes: string | null;
  }>;
  attendanceRecords: Array<{
    id: string;
    sessionId: string;
    status: AttendanceStatus;
    sessionDate: string;
    startTime: string;
    endTime: string;
    topic: string | null;
    groupName: string;
    notes: string | null;
  }>;
  monthlyBreakdown: StudentMonthlyBreakdownItem[];
  monthTotals: {
    totalSessions: number;
    presentCount: number;
    absentCount: number;
    excusedCount: number;
    totalDue: number;
    totalPaid: number;
    remaining: number;
  };
  payments: Array<{
    id: string;
    receiptNumber: string;
    yearMonth: string;
    amount: string;
    paymentDate: string;
    paymentMethod: string;
    notes: string | null;
  }>;
}

export const GRADE_LEVEL_OPTIONS = [
  { value: 'الأول الإعدادي', label: 'الأول الإعدادي' },
  { value: 'الثاني الإعدادي', label: 'الثاني الإعدادي' },
  { value: 'الثالث الإعدادي', label: 'الثالث الإعدادي' },
  { value: 'الأول الثانوي', label: 'الأول الثانوي' },
  { value: 'الثاني الثانوي', label: 'الثاني الثانوي' },
  { value: 'الثالث الثانوي', label: 'الثالث الثانوي' },
];

export const STUDENT_STATUS_OPTIONS = [
  { value: StudentStatus.ACTIVE, label: 'نشط' },
  { value: StudentStatus.SUSPENDED, label: 'موقوف مؤقتاً' },
  { value: StudentStatus.ARCHIVED, label: 'مؤرشف' },
];

export const STUDENT_STATUS_META: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'neutral' }
> = {
  ACTIVE: { label: 'نشط', variant: 'success' },
  SUSPENDED: { label: 'موقوف مؤقتاً', variant: 'warning' },
  ARCHIVED: { label: 'مؤرشف', variant: 'neutral' },
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'نقدي',
  VODAFONE_CASH: 'فودافون كاش',
  INSTAPAY: 'إنستاباي',
  BANK_TRANSFER: 'تحويل بنكي',
  CARD: 'بطاقة بنكية',
};
