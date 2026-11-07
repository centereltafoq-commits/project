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
  makeup: number;
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

export interface DashboardSummaryResponse {
  yearMonth: string;
  todayDate: string;
  totalStudents: number;
  activeStudents: number;
  teachersCount: number;
  assistantsCount: number;
  groupsCount: number;
  todaySessionsCount: number;
  todaySessions: DashboardTodaySessionItem[];
  todayAttendance: DashboardTodayAttendance;
  totalRevenue: number;
  totalCollectedPayments: number;
  totalReceivables: number;
  totalTeacherDues: number;
  totalAssistantDues: number;
  totalExpenses: number;
  netCenterResult: number;
  pendingBookingsCount: number;
  upcomingAppointments: DashboardUpcomingAppointment[];
  classroomsSummary: DashboardClassroomsSummary;
  classroomsLive: DashboardClassroomLiveItem[];
}
