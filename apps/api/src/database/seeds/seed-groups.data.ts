import { FullMonthAbsencePolicy, GroupRevenueSplitMethod } from '@edu-center/shared';
import { GroupScheduleSlot } from '../schemas/groups.schema';

export interface SeedGroupConfig {
  groupCode: string;
  name: string;
  subject: string;
  gradeLevel: string;
  teacherCode: string;
  roomNumber: string | null;
  assistantCode: string | null;
  monthlySessionsCount: number;
  monthlyPrice: string;
  calculatedSessionPrice: string;
  teacherSharePerStudent: string;
  centerSharePerStudent: string;
  revenueSplitMethod: GroupRevenueSplitMethod;
  fullMonthAbsencePolicy: FullMonthAbsencePolicy;
  maxStudents: number;
  isActive: boolean;
  notes?: string;
  scheduleSlots: GroupScheduleSlot[];
}

export const SEED_GROUPS: SeedGroupConfig[] = [
  {
    groupCode: 'GRP-4101',
    name: 'رياضيات تالتة ثانوي - المجموعة الأولى',
    subject: 'الرياضيات',
    gradeLevel: 'تالتة ثانوي',
    teacherCode: 'TCH-2026',
    roomNumber: 'R-101',
    assistantCode: 'AST-3101',
    monthlySessionsCount: 8,
    monthlyPrice: '200.00',
    calculatedSessionPrice: '25.00',
    teacherSharePerStudent: '120.00',
    centerSharePerStudent: '80.00',
    revenueSplitMethod: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
    fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
    maxStudents: 60,
    isActive: true,
    scheduleSlots: [
      { dayOfWeek: 0, startTime: '16:00', endTime: '18:00' },
      { dayOfWeek: 3, startTime: '16:00', endTime: '18:00' },
    ],
  },
  {
    groupCode: 'GRP-4102',
    name: 'فيزياء تالتة ثانوي - المجموعة المتقدمة',
    subject: 'الفيزياء',
    gradeLevel: 'تالتة ثانوي',
    teacherCode: 'TCH-2041',
    roomNumber: 'R-102',
    assistantCode: 'AST-3102',
    monthlySessionsCount: 8,
    monthlyPrice: '240.00',
    calculatedSessionPrice: '30.00',
    teacherSharePerStudent: '150.00',
    centerSharePerStudent: '90.00',
    revenueSplitMethod: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
    fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
    maxStudents: 45,
    isActive: true,
    scheduleSlots: [
      { dayOfWeek: 1, startTime: '17:00', endTime: '19:00' },
      { dayOfWeek: 4, startTime: '17:00', endTime: '19:00' },
    ],
  },
  {
    groupCode: 'GRP-4103',
    name: 'كيمياء تانية ثانوي',
    subject: 'الكيمياء',
    gradeLevel: 'تانية ثانوي',
    teacherCode: 'TCH-2058',
    roomNumber: 'R-102',
    assistantCode: 'AST-3102',
    monthlySessionsCount: 8,
    monthlyPrice: '180.00',
    calculatedSessionPrice: '22.50',
    teacherSharePerStudent: '110.00',
    centerSharePerStudent: '70.00',
    revenueSplitMethod: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
    fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
    maxStudents: 45,
    isActive: true,
    scheduleSlots: [
      { dayOfWeek: 0, startTime: '19:00', endTime: '21:00' },
      { dayOfWeek: 3, startTime: '19:00', endTime: '21:00' },
    ],
  },
  {
    groupCode: 'GRP-4104',
    name: 'لغة إنجليزية - أولى إعدادي',
    subject: 'اللغة الإنجليزية',
    gradeLevel: 'أولى إعدادي',
    teacherCode: 'TCH-2074',
    roomNumber: 'R-103',
    assistantCode: 'AST-3103',
    monthlySessionsCount: 8,
    monthlyPrice: '160.00',
    calculatedSessionPrice: '20.00',
    teacherSharePerStudent: '100.00',
    centerSharePerStudent: '60.00',
    revenueSplitMethod: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
    fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
    maxStudents: 35,
    isActive: true,
    scheduleSlots: [
      { dayOfWeek: 6, startTime: '15:00', endTime: '17:00' },
      { dayOfWeek: 2, startTime: '15:00', endTime: '17:00' },
    ],
  },
  {
    groupCode: 'GRP-4105',
    name: 'جبر وهندسة - أولى إعدادي (جاهزة للتسكين)',
    subject: 'الرياضيات',
    gradeLevel: 'أولى إعدادي',
    teacherCode: 'TCH-2026',
    roomNumber: null,
    assistantCode: null,
    monthlySessionsCount: 8,
    monthlyPrice: '160.00',
    calculatedSessionPrice: '20.00',
    teacherSharePerStudent: '100.00',
    centerSharePerStudent: '60.00',
    revenueSplitMethod: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
    fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
    maxStudents: 30,
    isActive: true,
    notes: 'مجموعة بمواعيد أسبوعية مقترحة — جاهزة للتسكين في قاعة الفارابي من شاشة إدارة القاعات',
    scheduleSlots: [
      { dayOfWeek: 2, startTime: '14:00', endTime: '16:00', classroomId: null },
      { dayOfWeek: 4, startTime: '14:00', endTime: '16:00', classroomId: null },
    ],
  },
  {
    groupCode: 'GRP-4106',
    name: 'مراجعة علوم - تانية إعدادي (متوقفة)',
    subject: 'العلوم',
    gradeLevel: 'تانية إعدادي',
    teacherCode: 'TCH-2089',
    roomNumber: null,
    assistantCode: null,
    monthlySessionsCount: 4,
    monthlyPrice: '120.00',
    calculatedSessionPrice: '30.00',
    teacherSharePerStudent: '80.00',
    centerSharePerStudent: '40.00',
    revenueSplitMethod: GroupRevenueSplitMethod.ACTUAL_ATTENDANCE_RATIO,
    fullMonthAbsencePolicy: FullMonthAbsencePolicy.EXEMPT_FULL_ABSENCE,
    maxStudents: 30,
    isActive: false,
    notes: 'مجموعة موقوفة مؤقتاً بسبب إجازة المدرس',
    scheduleSlots: [],
  },
];
