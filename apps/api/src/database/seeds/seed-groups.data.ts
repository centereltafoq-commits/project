import { FullMonthAbsencePolicy, GroupRevenueSplitMethod } from '@edu-center/shared';
import { GroupScheduleSlot } from '../schemas/groups.schema';

export interface SeedGroupConfig {
  groupCode: string;
  name: string;
  subject: string;
  gradeLevel: string;
  teacherCode: string;
  roomNumber: string;
  assistantCode: string;
  monthlySessionsCount: number;
  monthlyPrice: string;
  calculatedSessionPrice: string;
  teacherSharePerStudent: string;
  centerSharePerStudent: string;
  revenueSplitMethod: GroupRevenueSplitMethod;
  fullMonthAbsencePolicy: FullMonthAbsencePolicy;
  maxStudents: number;
  scheduleSlots: GroupScheduleSlot[];
}

export const SEED_GROUPS: SeedGroupConfig[] = [
  {
    groupCode: 'GRP-MATH-3S',
    name: 'مجموعة الرياضيات - الصف الثالث الثانوي',
    subject: 'الرياضيات',
    gradeLevel: 'الصف الثالث الثانوي',
    teacherCode: 'TCH-001',
    roomNumber: 'R-101',
    assistantCode: 'AST-001',
    monthlySessionsCount: 10,
    monthlyPrice: '180.00',
    calculatedSessionPrice: '18.00',
    teacherSharePerStudent: '100.00',
    centerSharePerStudent: '80.00',
    revenueSplitMethod: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
    fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
    maxStudents: 75,
    scheduleSlots: [
      { dayOfWeek: 0, startTime: '16:00', endTime: '18:00' },
      { dayOfWeek: 3, startTime: '16:00', endTime: '18:00' },
    ],
  },
  {
    groupCode: 'GRP-PHYS-3S',
    name: 'مجموعة الفيزياء المتقدمة - الصف الثالث الثانوي',
    subject: 'الفيزياء',
    gradeLevel: 'الصف الثالث الثانوي',
    teacherCode: 'TCH-002',
    roomNumber: 'R-102',
    assistantCode: 'AST-002',
    monthlySessionsCount: 8,
    monthlyPrice: '200.00',
    calculatedSessionPrice: '25.00',
    teacherSharePerStudent: '120.00',
    centerSharePerStudent: '80.00',
    revenueSplitMethod: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
    fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
    maxStudents: 55,
    scheduleSlots: [
      { dayOfWeek: 1, startTime: '17:00', endTime: '19:00' },
      { dayOfWeek: 4, startTime: '17:00', endTime: '19:00' },
    ],
  },
  {
    groupCode: 'GRP-CHEM-2S',
    name: 'مجموعة الكيمياء - الصف الثاني الثانوي',
    subject: 'الكيمياء',
    gradeLevel: 'الصف الثاني الثانوي',
    teacherCode: 'TCH-003',
    roomNumber: 'R-102',
    assistantCode: 'AST-002',
    monthlySessionsCount: 8,
    monthlyPrice: '160.00',
    calculatedSessionPrice: '20.00',
    teacherSharePerStudent: '100.00',
    centerSharePerStudent: '60.00',
    revenueSplitMethod: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
    fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
    maxStudents: 50,
    scheduleSlots: [
      { dayOfWeek: 0, startTime: '19:00', endTime: '21:00' },
      { dayOfWeek: 3, startTime: '19:00', endTime: '21:00' },
    ],
  },
  {
    groupCode: 'GRP-ENG-1S',
    name: 'مجموعة اللغة الإنجليزية - الصف الأول الثانوي',
    subject: 'اللغة الإنجليزية',
    gradeLevel: 'الصف الأول الثانوي',
    teacherCode: 'TCH-004',
    roomNumber: 'R-103',
    assistantCode: 'AST-003',
    monthlySessionsCount: 8,
    monthlyPrice: '140.00',
    calculatedSessionPrice: '17.50',
    teacherSharePerStudent: '85.00',
    centerSharePerStudent: '55.00',
    revenueSplitMethod: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
    fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
    maxStudents: 45,
    scheduleSlots: [
      { dayOfWeek: 2, startTime: '18:00', endTime: '20:00' },
      { dayOfWeek: 5, startTime: '18:00', endTime: '20:00' },
    ],
  },
];
