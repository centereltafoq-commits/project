import { ClassroomStatus } from '@edu-center/shared';

export interface ClassroomRow {
  id: string;
  roomNumber: string;
  name: string;
  maxCapacity: number;
  seatsCount: number;
  equipment: string[];
  status: ClassroomStatus;
  notes: string | null;
  upcomingMaintenancesCount?: number;
  createdAt: string;
}

export interface ClassroomMaintenanceItem {
  id: string;
  classroomId: string;
  startAt: string;
  endAt: string;
  reason: string;
  createdAt: string;
}

export interface AllocatedGroupItem {
  id: string;
  groupCode: string;
  name: string;
  subject: string;
  gradeLevel: string;
  primaryTeacherId: string;
  teacherName: string;
  defaultClassroomId: string | null;
  scheduleSlots: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    classroomId?: string | null;
  }>;
  slotsForThisRoom?: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    classroomId?: string | null;
  }>;
  maxStudents: number;
  enrolledCount: number;
  isOverCapacity?: boolean;
}

export interface ClassroomScheduleData {
  classroom: ClassroomRow;
  from: string;
  to: string;
  sessions: Array<{
    id: string;
    sessionDate: string;
    startTime: string;
    endTime: string;
    status: string;
    topic: string | null;
    groupName: string;
    teacherName: string;
  }>;
  bookings: Array<{
    id: string;
    bookingDate: string;
    startTime: string;
    endTime: string;
    title: string;
    status: string;
  }>;
  maintenances: ClassroomMaintenanceItem[];
  allocatedGroups?: AllocatedGroupItem[];
}

export const CLASSROOM_STATUS_OPTIONS = [
  { value: ClassroomStatus.AVAILABLE, label: 'متاحة للعمل' },
  { value: ClassroomStatus.MAINTENANCE, label: 'تحت الصيانة' },
  { value: ClassroomStatus.INACTIVE, label: 'غير مفعلة' },
];

export const CLASSROOM_STATUS_META: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'neutral' }
> = {
  AVAILABLE: { label: 'متاحة', variant: 'success' },
  MAINTENANCE: { label: 'تحت الصيانة', variant: 'warning' },
  INACTIVE: { label: 'غير مفعلة', variant: 'neutral' },
};
