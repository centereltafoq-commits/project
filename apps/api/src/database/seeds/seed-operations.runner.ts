import { EnrollmentStatus, SessionStatus } from '@edu-center/shared';
import { DrizzleDatabase } from '../database.module';
import { enrollments, sessions } from '../schemas';
import { seedUuid } from './seed-identity.data';

export interface SeedGroupRef {
  id: string;
  groupCode: string;
  teacherId: string;
  classroomId: string;
  monthlySessionsCount: number;
  monthlyPrice: number;
  sessionPrice: number;
  teacherShare: number;
  centerShare: number;
}

export interface SeededCatalogContext {
  yearMonth: string;
  todayDate: string;
  actorUserId: string;
  accountantUserId: string;
  classroomsByCode: Map<string, string>;
  teachersByCode: Map<string, string>;
  assistantsByCode: Map<string, string>;
  studentIds: string[];
  groupsList: SeedGroupRef[];
}

export interface EnrollmentSeedSpec {
  idx: number;
  studentIdx: number;
  group: SeedGroupRef;
  startDate: string;
  isMidMonth?: boolean;
  isFullAbsent?: boolean;
}

export async function seedEnrollmentsAndSessions(
  db: DrizzleDatabase,
  ctx: SeededCatalogContext,
): Promise<{
  enrollmentSpecs: EnrollmentSeedSpec[];
  groupSessionsMap: Map<string, Array<{ id: string; date: string; status: string }>>;
}> {
  const [yr, mo] = ctx.yearMonth.split('-');
  const d = (day: number) => `${yr}-${mo}-${String(day).padStart(2, '0')}`;
  const monthStart = d(1);
  const midMonthDate = d(12);

  const mathGroup = ctx.groupsList.find((g) => g.groupCode === 'GRP-MATH-3S')!;
  const physGroup = ctx.groupsList.find((g) => g.groupCode === 'GRP-PHYS-3S')!;
  const chemGroup = ctx.groupsList.find((g) => g.groupCode === 'GRP-CHEM-2S')!;
  const engGroup = ctx.groupsList.find((g) => g.groupCode === 'GRP-ENG-1S')!;

  const enrollmentSpecs: EnrollmentSeedSpec[] = [];
  let eSeq = 1;
  for (let i = 0; i <= 13; i++) {
    enrollmentSpecs.push({
      idx: eSeq++,
      studentIdx: i,
      group: mathGroup,
      startDate: i === 11 ? midMonthDate : monthStart,
      isMidMonth: i === 11,
      isFullAbsent: i === 13,
    });
  }
  for (let i = 0; i <= 7; i++) {
    enrollmentSpecs.push({ idx: eSeq++, studentIdx: i, group: physGroup, startDate: monthStart });
  }
  for (let i = 14; i <= 21; i++) {
    enrollmentSpecs.push({ idx: eSeq++, studentIdx: i, group: chemGroup, startDate: monthStart });
  }
  for (let i = 22; i <= 29; i++) {
    enrollmentSpecs.push({ idx: eSeq++, studentIdx: i, group: engGroup, startDate: monthStart });
  }

  for (const spec of enrollmentSpecs) {
    await db
      .insert(enrollments)
      .values({
        id: seedUuid('10', spec.idx),
        studentId: ctx.studentIds[spec.studentIdx],
        groupId: spec.group.id,
        startDate: spec.startDate,
        agreedMonthlyPrice: spec.group.monthlyPrice.toFixed(2),
        agreedSessionsCount: spec.group.monthlySessionsCount,
        agreedSessionPrice: spec.group.sessionPrice.toFixed(2),
        status: EnrollmentStatus.ACTIVE,
        notes: spec.isMidMonth
          ? 'انضم بمنتصف الشهر - يُحاسب على الحصص اللاحقة لتاريخ التسجيل فقط'
          : null,
      })
      .onConflictDoUpdate({
        target: enrollments.id,
        set: { startDate: spec.startDate, status: EnrollmentStatus.ACTIVE },
      });
  }

  const sessionPlans = [
    {
      group: mathGroup,
      dates: [
        { date: d(2), start: '16:00', end: '18:00', status: SessionStatus.COMPLETED, topic: 'التفاضل والاشتقاق الضمني' },
        { date: d(5), start: '16:00', end: '18:00', status: SessionStatus.COMPLETED, topic: 'المعدلات الزمنية المرتبطة' },
        { date: d(9), start: '16:00', end: '18:00', status: SessionStatus.COMPLETED, topic: 'تطبيقات القيم العظمى والصغرى' },
        { date: d(14), start: '16:00', end: '18:00', status: SessionStatus.COMPLETED, topic: 'التكامل غير المحدد وطرق التعويض' },
        { date: ctx.todayDate, start: '13:00', end: '15:00', status: SessionStatus.COMPLETED, topic: 'مراجعة شاملة واختبار شهري' },
        { date: ctx.todayDate, start: '19:00', end: '21:00', status: SessionStatus.SCHEDULED, topic: 'الهندسة الفراغية والمتجهات' },
      ],
    },
    {
      group: physGroup,
      dates: [
        { date: d(3), start: '17:00', end: '19:00', status: SessionStatus.COMPLETED, topic: 'قانون أوم للدائرة المغلقة' },
        { date: d(7), start: '17:00', end: '19:00', status: SessionStatus.COMPLETED, topic: 'قانونا كيرشوف وتطبيقاتهما' },
        { date: d(13), start: '17:00', end: '19:00', status: SessionStatus.COMPLETED, topic: 'التأثير المغناطيسي للتيار الكهربي' },
        { date: d(18), start: '17:00', end: '19:00', status: SessionStatus.COMPLETED, topic: 'أجهزة القياس الكهربي' },
        { date: ctx.todayDate, start: '16:30', end: '18:30', status: SessionStatus.SCHEDULED, topic: 'الحث الكهرومغناطيسي وقانون فاراداي' },
      ],
    },
    {
      group: chemGroup,
      dates: [
        { date: d(4), start: '19:00', end: '21:00', status: SessionStatus.COMPLETED, topic: 'أعداد الكم والتوزيع الإلكتروني' },
        { date: d(8), start: '19:00', end: '21:00', status: SessionStatus.COMPLETED, topic: 'الجدول الدوري وتدرج الخواص' },
        { date: d(15), start: '19:00', end: '21:00', status: SessionStatus.COMPLETED, topic: 'الروابط الكيميائية والتهجين' },
        { date: d(20), start: '19:00', end: '21:00', status: SessionStatus.COMPLETED, topic: 'مراجعة الباب الأول والثاني' },
      ],
    },
    {
      group: engGroup,
      dates: [
        { date: d(3), start: '18:00', end: '20:00', status: SessionStatus.COMPLETED, topic: 'Unit 1 Grammar & Vocabulary' },
        { date: d(10), start: '18:00', end: '20:00', status: SessionStatus.COMPLETED, topic: 'Past Tenses & Reading Skills' },
        { date: d(16), start: '18:00', end: '20:00', status: SessionStatus.COMPLETED, topic: 'Unit 2 Essay Writing Workshop' },
        { date: d(21), start: '18:00', end: '20:00', status: SessionStatus.COMPLETED, topic: 'Monthly Assessment & Translation' },
      ],
    },
  ];

  const groupSessionsMap = new Map<string, Array<{ id: string; date: string; status: string }>>();
  let sSeq = 1;
  for (const plan of sessionPlans) {
    const createdList: Array<{ id: string; date: string; status: string }> = [];
    for (const item of plan.dates) {
      const sessionId = seedUuid('20', sSeq++);
      await db
        .insert(sessions)
        .values({
          id: sessionId,
          groupId: plan.group.id,
          teacherId: plan.group.teacherId,
          classroomId: plan.group.classroomId,
          sessionDate: item.date,
          yearMonth: ctx.yearMonth,
          startTime: item.start,
          endTime: item.end,
          status: item.status,
          topic: item.topic,
        })
        .onConflictDoUpdate({
          target: sessions.id,
          set: { sessionDate: item.date, yearMonth: ctx.yearMonth, status: item.status },
        });
      createdList.push({ id: sessionId, date: item.date, status: item.status });
    }
    groupSessionsMap.set(plan.group.id, createdList);
  }

  return { enrollmentSpecs, groupSessionsMap };
}
