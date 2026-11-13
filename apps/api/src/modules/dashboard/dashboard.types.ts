export interface DashboardTodaySessionItem {
  id: string;
  groupId: string;
  groupName: string;
  subject: string;
  gradeLevel: string;
  teacherName: string;
  classroomName: string | null;
  roomNumber: string | null;
  startTime: string;
  endTime: string;
  status: string;
}

export interface DashboardTodayAttendance {
  present: number;
  absent: number;
  excused: number;
}

export interface DashboardClassroomLiveItem {
  id: string;
  roomNumber: string;
  name: string;
  maxCapacity: number;
  liveState: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'INACTIVE';
  occupantTitle: string | null;
}

export interface DashboardClassroomsSummary {
  total: number;
  availableNow: number;
  occupiedNow: number;
  maintenance: number;
}

export interface DashboardMonthlySessionsStats {
  totalSessions: number;
  executedSessions: number;
  scheduledSessions: number;
  totalBillableSessions: number;
  totalPaidSessions: number;
  totalUnpaidSessions: number;
  collectionRateSessions: number;
}

export interface DashboardMonthlyPaymentStats {
  paidStudentsCount: number;
  unpaidStudentsCount: number;
  totalBilledStudentsCount: number;
  paidGroupsCount: number;
  unpaidGroupsCount: number;
  totalBilledGroupsCount: number;
}

export type SessionProgressStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'NEAR_LAST'
  | 'LAST_OR_DONE';

export interface DashboardSessionProgressStudentItem {
  enrollmentId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  studentPhone: string;
  groupId: string;
  groupName: string;
  groupCode: string;
  subject: string;
  attendedSessions: number;
  targetSessions: number;
  stepNumber: number;
  status: SessionProgressStatus;
  remainingBalance: number;
}

export interface DashboardSessionStepBucket {
  stepNumber: number;
  label: string;
  isNearLast: boolean;
  isLast: boolean;
  studentsCount: number;
}

export interface DashboardSessionTrackBreakdown {
  targetSessions: number;
  totalEnrollments: number;
  notStartedCount: number;
  inProgressCount: number;
  nearLastCount: number;
  lastOrCompletedCount: number;
  steps: DashboardSessionStepBucket[];
}

export interface DashboardSessionProgressSummary {
  totalTrackedEnrollments: number;
  nearLastTotalCount: number;
  lastOrCompletedTotalCount: number;
  inProgressTotalCount: number;
  notStartedTotalCount: number;
  tracks: DashboardSessionTrackBreakdown[];
  students: DashboardSessionProgressStudentItem[];
  isStudentsListTruncated?: boolean;
}

export interface DashboardSummaryResponse {
  yearMonth: string;
  todayDate: string;
  totalStudents: number;
  activeStudents: number;
  teachersCount: number;
  assistantsCount: number;
  groupsCount: number;
  scheduledGroupsCount?: number;
  todaySessionsCount: number;
  todaySessions: DashboardTodaySessionItem[];
  todayAttendance: DashboardTodayAttendance;
  monthlySessionsStats: DashboardMonthlySessionsStats;
  monthlyPaymentStats: DashboardMonthlyPaymentStats;
  monthlySessionProgress: DashboardSessionProgressSummary;
  totalRevenue: number;
  totalCollectedPayments: number;
  totalReceivables: number;
  totalTeacherDues: number;
  totalAssistantDues: number;
  totalExpenses: number;
  netCenterResult: number;
  netCashFlow?: number;
  totalTeacherPaidOut?: number;
  totalAssistantPaidOut?: number;
  classroomsSummary: DashboardClassroomsSummary;
  classroomsLive: DashboardClassroomLiveItem[];
}
