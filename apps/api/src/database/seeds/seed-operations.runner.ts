import { EnrollmentStatus, SessionStatus } from '@edu-center/shared';
import { DrizzleDatabase } from '../database.module';
import { enrollments, sessions } from '../schemas';
import { seedUuid } from './seed-identity.data';

export interface SeedGroupRef {
  id: string;
  groupCode: string;
  teacherId: string;
  classroomId: string | null;
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
  forcedPaidRatio?: number;
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

  const mathGroup = ctx.groupsList.find((g) => g.groupCode === 'GRP-4101')!;
  const physGroup = ctx.groupsList.find((g) => g.groupCode === 'GRP-4102')!;
  const chemGroup = ctx.groupsList.find((g) => g.groupCode === 'GRP-4103')!;
  const engGroup = ctx.groupsList.find((g) => g.groupCode === 'GRP-4104')!;
  const prepMathGroup = ctx.groupsList.find((g) => g.groupCode === 'GRP-4105')!;

  const enrollmentSpecs: EnrollmentSeedSpec[] = [];
  let eSeq = 1;

  // Students 0..9 in 3rd Secondary Math (GRP-4101)
  for (let i = 0; i <= 9; i++) {
    enrollmentSpecs.push({
      idx: eSeq++,
      studentIdx: i,
      group: mathGroup,
      startDate: monthStart,
      isFullAbsent: i === 9,
      forcedPaidRatio: i === 0 || i === 1 ? 1 : i === 2 ? 0 : undefined,
    });
  }

  // Students 0..4 also enrolled in 3rd Secondary Physics (GRP-4102) -> Multi-group examples!
  for (let i = 0; i <= 4; i++) {
    enrollmentSpecs.push({
      idx: eSeq++,
      studentIdx: i,
      group: physGroup,
      startDate: monthStart,
      // Student 0 paid both groups (PAID); Student 1 paid only math (PARTIAL); Student 2 unpaid (UNPAID)
      forcedPaidRatio: i === 0 ? 1 : i === 1 || i === 2 ? 0 : undefined,
    });
  }

  // Students 10..13 in 2nd Secondary Chemistry (GRP-4103)
  for (let i = 10; i <= 13; i++) {
    enrollmentSpecs.push({
      idx: eSeq++,
      studentIdx: i,
      group: chemGroup,
      startDate: i === 10 ? midMonthDate : monthStart,
      isMidMonth: i === 10,
    });
  }

  // Students 14..18 in 1st Prep English (GRP-4104)
  for (let i = 14; i <= 18; i++) {
    enrollmentSpecs.push({
      idx: eSeq++,
      studentIdx: i,
      group: engGroup,
      startDate: monthStart,
      forcedPaidRatio: i === 14 ? 1 : i === 15 ? 0.5 : undefined,
    });
  }

  // Students 14..16 also enrolled in unassigned Prep Math (GRP-4105)
  for (let i = 14; i <= 16; i++) {
    enrollmentSpecs.push({
      idx: eSeq++,
      studentIdx: i,
      group: prepMathGroup,
      startDate: monthStart,
      forcedPaidRatio: 0,
    });
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
        { date: ctx.todayDate, start: '16:00', end: '18:00', status: SessionStatus.SCHEDULED, topic: 'مراجعة شاملة وحصة اليوم' },
        { date: d(23), start: '16:00', end: '18:00', status: SessionStatus.SCHEDULED, topic: 'الهندسة الفراغية والمتجهات' },
      ],
    },
    {
      group: physGroup,
      dates: [
        { date: d(3), start: '17:00', end: '19:00', status: SessionStatus.COMPLETED, topic: 'قانون أوم للدائرة المغلقة' },
        { date: d(7), start: '17:00', end: '19:00', status: SessionStatus.COMPLETED, topic: 'قانونا كيرشوف وتطبيقاتهما' },
        { date: d(13), start: '17:00', end: '19:00', status: SessionStatus.COMPLETED, topic: 'التأثير المغناطيسي للتيار الكهربي' },
        { date: d(17), start: '17:00', end: '19:00', status: SessionStatus.COMPLETED, topic: 'أجهزة القياس الكهربي' },
        { date: ctx.todayDate, start: '18:30', end: '20:30', status: SessionStatus.SCHEDULED, topic: 'الحث الكهرومغناطيسي وقانون فاراداي' },
      ],
    },
    {
      group: chemGroup,
      dates: [
        { date: d(4), start: '19:00', end: '21:00', status: SessionStatus.COMPLETED, topic: 'أعداد الكم والتوزيع الإلكتروني' },
        { date: d(8), start: '19:00', end: '21:00', status: SessionStatus.COMPLETED, topic: 'الجدول الدوري وتدرج الخواص' },
        { date: d(15), start: '19:00', end: '21:00', status: SessionStatus.COMPLETED, topic: 'الروابط الكيميائية والتهجين' },
        { date: d(18), start: '19:00', end: '21:00', status: SessionStatus.COMPLETED, topic: 'مراجعة الباب الأول والثاني' },
      ],
    },
    {
      group: engGroup,
      dates: [
        { date: d(3), start: '15:00', end: '17:00', status: SessionStatus.COMPLETED, topic: 'Unit 1 Grammar & Vocabulary' },
        { date: d(10), start: '15:00', end: '17:00', status: SessionStatus.COMPLETED, topic: 'Past Tenses & Reading Skills' },
        { date: d(16), start: '15:00', end: '17:00', status: SessionStatus.COMPLETED, topic: 'Unit 2 Reading Comprehension' },
        { date: ctx.todayDate, start: '15:00', end: '17:00', status: SessionStatus.SCHEDULED, topic: 'Unit 2 Revision & Quiz' },
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
