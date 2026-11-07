export interface DashboardTodaySession {
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

export interface DashboardUpcomingAppointment {
  id: string;
  requestType: string;
  purpose: string;
  requestedDate: string;
  startTime: string;
  endTime: string;
  teacherName: string;
  studentName: string | null;
  classroomName: string | null;
  roomNumber: string | null;
}

export interface DashboardClassroomLive {
  id: string;
  roomNumber: string;
  name: string;
  maxCapacity: number;
  liveState: 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'INACTIVE';
  occupantTitle: string | null;
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

export interface DashboardSummaryData {
  yearMonth: string;
  todayDate: string;
  totalStudents: number;
  activeStudents: number;
  teachersCount: number;
  assistantsCount: number;
  groupsCount: number;
  todaySessionsCount: number;
  todaySessions: DashboardTodaySession[];
  todayAttendance: {
    present: number;
    absent: number;
    excused: number;
    makeup: number;
  };
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
  pendingBookingsCount: number;
  upcomingAppointments: DashboardUpcomingAppointment[];
  classroomsSummary: {
    total: number;
    availableNow: number;
    occupiedNow: number;
    maintenance: number;
  };
  classroomsLive: DashboardClassroomLive[];
}
