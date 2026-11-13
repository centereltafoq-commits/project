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
