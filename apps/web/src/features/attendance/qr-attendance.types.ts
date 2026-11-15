import { StudentMonthOverviewItem } from '../students/students.types';

export interface QrTodaySessionCandidate {
  sessionId: string | null;
  groupId: string;
  groupCode: string;
  groupName: string;
  subject: string;
  teacherName: string;
  classroomId: string | null;
  classroomName: string | null;
  roomNumber: string | null;
  sessionDate: string;
  startTime: string;
  endTime: string;
  sessionStatus: string;
  attendanceStatus: string | null;
  isVirtualSlot: boolean;
  isScheduledToday: boolean;
}

export interface QrPaymentGateSummary {
  isBlocked: boolean;
  totalRemaining: number;
  unpaidMonthsCount: number;
  unpaidMonths: Array<{
    yearMonth: string;
    paymentStatus: StudentMonthOverviewItem['paymentStatus'];
    totalDue: number;
    totalPaid: number;
    remaining: number;
  }>;
}

export interface QrLookupResponse {
  todayDate: string;
  canSeeAmounts: boolean;
  student: {
    id: string;
    studentCode: string;
    fullName: string;
    phone: string | null;
    guardianPhone: string | null;
    gradeLevel: string;
    status: string;
    registrationDate: string;
  };
  paymentGate: QrPaymentGateSummary;
  monthsOverview: StudentMonthOverviewItem[];
  enrollments: Array<{
    id: string;
    groupId: string;
    groupName: string;
    groupCode: string;
    subject: string;
    status: string;
  }>;
  todaySessions: QrTodaySessionCandidate[];
}

export interface QrCheckInResponse {
  success: boolean;
  alreadyCheckedIn: boolean;
  sessionId: string;
  groupId: string;
  groupName: string;
  sessionDate: string;
  attendanceStatus: string;
  studentName: string;
}
