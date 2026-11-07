import { AttendanceStatus, MakeupStatus, SessionStatus } from '@edu-center/shared';

export interface AttendanceLookups {
  groups: Array<{
    id: string;
    groupCode: string;
    name: string;
    subject: string;
    gradeLevel: string;
    primaryTeacherId: string;
    defaultClassroomId: string | null;
  }>;
  teachers: Array<{
    id: string;
    fullName: string;
    teacherCode: string;
  }>;
  classrooms: Array<{
    id: string;
    roomNumber: string;
    name: string;
    maxCapacity: number;
  }>;
  students: Array<{
    id: string;
    studentCode: string;
    fullName: string;
    gradeLevel: string;
  }>;
}

export interface SessionRow {
  id: string;
  groupId: string;
  groupName: string;
  groupCode: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  classroomId: string | null;
  classroomName: string | null;
  roomNumber: string | null;
  sessionDate: string;
  yearMonth: string;
  startTime: string;
  endTime: string;
  status: SessionStatus | string;
  topic: string | null;
  notes: string | null;
  presentCount: number;
  recordedCount: number;
}

export interface SheetStudentRow {
  enrollmentId: string;
  enrollmentStartDate: string;
  enrollmentEndDate: string | null;
  studentId: string;
  studentCode: string;
  studentName: string;
  studentPhone: string;
  guardianPhone: string;
  attendanceId: string | null;
  status: AttendanceStatus | null;
  notes: string | null;
  recordedAt: string | null;
  updatedAt: string | null;
  recordedByUserId: string | null;
  recordedByName: string | null;
  updatedByUserId: string | null;
  updatedByName: string | null;
}

export interface SessionSheetResponse {
  session: Omit<SessionRow, 'presentCount' | 'recordedCount'> & { gradeLevel: string };
  summary: {
    totalStudents: number;
    presentCount: number;
    absentCount: number;
    excusedCount: number;
    makeupCount: number;
    unrecordedCount: number;
  };
  students: SheetStudentRow[];
}

export interface MakeupSessionRow {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  originalSessionId: string;
  groupId: string;
  groupName: string;
  groupCode: string;
  absenceDate: string;
  scheduledAt: string | null;
  classroomId: string | null;
  classroomName: string | null;
  roomNumber: string | null;
  status: MakeupStatus | string;
  isFree: boolean;
  extraFee: string;
  approvedByName: string | null;
  notes: string | null;
  createdAt: string;
}

export const SESSION_STATUS_META: Record<
  string,
  { label: string; variant: 'info' | 'success' | 'danger' | 'neutral' }
> = {
  [SessionStatus.SCHEDULED]: { label: 'مجدولة', variant: 'info' },
  [SessionStatus.COMPLETED]: { label: 'مكتملة', variant: 'success' },
  [SessionStatus.CANCELLED]: { label: 'ملغاة', variant: 'danger' },
};

export const MAKEUP_STATUS_META: Record<
  string,
  { label: string; variant: 'warning' | 'info' | 'success' | 'danger' | 'neutral' }
> = {
  [MakeupStatus.PENDING]: { label: 'قيد الانتظار', variant: 'warning' },
  [MakeupStatus.SCHEDULED]: { label: 'مجدولة', variant: 'info' },
  [MakeupStatus.COMPLETED]: { label: 'تم الحضور', variant: 'success' },
  [MakeupStatus.CANCELLED]: { label: 'ملغاة', variant: 'danger' },
};
