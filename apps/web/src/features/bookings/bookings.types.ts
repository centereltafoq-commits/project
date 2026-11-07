import { BookingRequestType, BookingStatus } from '@edu-center/shared';

export interface BookingLookups {
  teachers: Array<{
    id: string;
    teacherCode: string;
    fullName: string;
    specialization: string;
    userId: string | null;
  }>;
  students: Array<{
    id: string;
    studentCode: string;
    fullName: string;
    gradeLevel: string;
  }>;
  classrooms: Array<{
    id: string;
    roomNumber: string;
    name: string;
    maxCapacity: number;
    status: string;
  }>;
}

export interface BookingRow {
  id: string;
  seriesId: string | null;
  seriesDayOfWeek: number | null;
  seriesEndDate: string | null;
  requestType: BookingRequestType | string;
  studentId: string | null;
  studentName: string | null;
  studentCode: string | null;
  teacherId: string;
  teacherName: string;
  purpose: string;
  requestedDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  requestedClassroomId: string | null;
  requestedClassroomName: string | null;
  requestedRoomNumber: string | null;
  assignedClassroomId: string | null;
  assignedClassroomName: string | null;
  assignedRoomNumber: string | null;
  expectedAttendees: number;
  status: BookingStatus | string;
  notes: string | null;
  createdAt: string;
}

export interface AvailableClassroomItem {
  id: string;
  roomNumber: string;
  name: string;
  maxCapacity: number;
  seatsCount: number;
  equipment: string[];
  status: string;
}

export interface AvailableClassroomsResponse {
  bookingId: string;
  date: string;
  startTime: string;
  endTime: string;
  expectedAttendees: number;
  participantConflicts: Array<{ rule: string; message: string }>;
  availableClassrooms: AvailableClassroomItem[];
  unavailableClassrooms: Array<AvailableClassroomItem & { reasons: string[] }>;
}

export const BOOKING_TYPE_LABELS: Record<string, string> = {
  [BookingRequestType.STUDENT_WITH_TEACHER]: 'طالب مع مدرس',
  [BookingRequestType.TEACHER_WITH_CENTER]: 'مدرس مع السنتر',
};

export const BOOKING_STATUS_META: Record<
  string,
  { label: string; variant: 'warning' | 'success' | 'danger' | 'neutral' | 'info' }
> = {
  [BookingStatus.PENDING]: { label: 'قيد المراجعة', variant: 'warning' },
  [BookingStatus.CONFIRMED]: { label: 'مؤكد', variant: 'success' },
  [BookingStatus.REJECTED]: { label: 'مرفوض', variant: 'danger' },
  [BookingStatus.CANCELLED]: { label: 'ملغي', variant: 'neutral' },
  [BookingStatus.COMPLETED]: { label: 'مكتمل', variant: 'info' },
};
