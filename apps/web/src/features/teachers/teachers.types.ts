import { TeacherEmploymentStatus } from '@edu-center/shared';

export interface TeacherRow {
  id: string;
  teacherCode: string;
  userId: string | null;
  fullName: string;
  phone: string;
  specialization: string;
  contractDate: string;
  employmentStatus: TeacherEmploymentStatus;
  notes: string | null;
  assignedGroupsCount?: number;
  createdAt: string;
}

export interface TeacherAvailabilitySlot {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export type TeacherPayoutStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'NO_DUES';

export interface TeacherMonthOverviewItem {
  yearMonth: string;
  payoutStatus: TeacherPayoutStatus;
  groupsCount: number;
  executedSessionsCount: number;
  totalDues: number;
  totalPayouts: number;
  remainingBalance: number;
  payoutsCount: number;
  isClosed: boolean;
}

export interface TeacherMonthSessionItem {
  id: string;
  groupId: string;
  groupName: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: string;
  topic: string | null;
  presentCount: number;
}

export interface TeacherProfileData {
  teacher: TeacherRow;
  yearMonth: string;
  assignedGroups: Array<{
    id: string;
    groupCode: string;
    name: string;
    subject: string;
    gradeLevel: string;
    monthlySessionsCount: number;
    monthlyPrice: string;
    calculatedSessionPrice: string;
    maxStudents: number;
    isActive: boolean;
    classroomName: string | null;
    activeStudentsCount: number;
    revenueSplitMethod: string | null;
    teacherSharePerStudent: string | null;
    centerSharePerStudent: string | null;
    teacherPercentage: string | null;
  }>;
  scheduleSlots: Array<{
    groupId: string;
    groupName: string;
    classroomName: string | null;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
  availability: TeacherAvailabilitySlot[];
  monthlyBreakdown: {
    groups: Array<{
      groupId: string;
      groupName: string;
      executedSessionsCount: number;
      studentsCount: number;
      grossRevenue: number;
      teacherShare: number;
      centerShare: number;
      revenueSplitMethod: string;
      isLocked: boolean;
    }>;
    totals: {
      groupsCount: number;
      executedSessionsCount: number;
      totalDues: number;
      totalPayouts: number;
      remainingBalance: number;
      isClosed: boolean;
    };
  };
  monthsOverview?: TeacherMonthOverviewItem[];
  monthSessions?: TeacherMonthSessionItem[];
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

export const TEACHER_PAYOUT_STATUS_META: Record<
  TeacherPayoutStatus,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  PAID: { label: 'تم الصرف بالكامل', variant: 'success' },
  PARTIAL: { label: 'صرف جزئي', variant: 'warning' },
  UNPAID: { label: 'لم يُصرف', variant: 'danger' },
  NO_DUES: { label: 'لا توجد مستحقات', variant: 'neutral' },
};

export const TEACHER_SESSION_STATUS_META: Record<
  string,
  { label: string; variant: 'success' | 'info' | 'warning' | 'danger' }
> = {
  COMPLETED: { label: 'منفذة', variant: 'success' },
  SCHEDULED: { label: 'مجدولة', variant: 'info' },
  RESCHEDULED: { label: 'معاد جدولتها', variant: 'warning' },
  CANCELLED: { label: 'ملغاة', variant: 'danger' },
};

export const TEACHER_STATUS_OPTIONS = [
  { value: TeacherEmploymentStatus.ACTIVE, label: 'نشط' },
  { value: TeacherEmploymentStatus.ON_LEAVE, label: 'في إجازة' },
  { value: TeacherEmploymentStatus.INACTIVE, label: 'متوقف' },
];

export const TEACHER_STATUS_META: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'danger' }
> = {
  ACTIVE: { label: 'نشط', variant: 'success' },
  ON_LEAVE: { label: 'في إجازة', variant: 'warning' },
  INACTIVE: { label: 'متوقف', variant: 'danger' },
};

export const SPLIT_METHOD_LABELS: Record<string, string> = {
  FIXED_PER_STUDENT: 'مبلغ ثابت عن كل طالب',
  FIXED_PER_SESSION: 'مبلغ ثابت عن كل حصة',
  ACTUAL_ATTENDANCE_RATIO: 'حسب نسبة الحضور الفعلي',
  CUSTOM_PERCENTAGE: 'نسبة مئوية مخصصة',
};
