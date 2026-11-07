import { BookingRequestType, BookingStatus } from '@edu-center/shared';
import { DrizzleDatabase } from '../database.module';
import {
  bookingApprovals,
  bookingRequests,
  classroomBookings,
  classroomMaintenances,
  teacherAvailability,
} from '../schemas';
import { seedUuid } from './seed-identity.data';
import { SeededCatalogContext } from './seed-operations.runner';

export async function seedMaintenanceAndBookings(
  db: DrizzleDatabase,
  ctx: SeededCatalogContext,
): Promise<void> {
  const [yr, mo] = ctx.yearMonth.split('-');
  const d = (day: number) => `${yr}-${mo}-${String(day).padStart(2, '0')}`;

  const maintRoomId = ctx.classroomsByCode.get('R-105')!;
  const reviewRoomId = ctx.classroomsByCode.get('R-104')!;
  const t1 = ctx.teachersByCode.get('TCH-001')!;
  const t2 = ctx.teachersByCode.get('TCH-002')!;
  const t3 = ctx.teachersByCode.get('TCH-003')!;

  await db
    .insert(classroomMaintenances)
    .values({
      id: seedUuid('60', 1),
      classroomId: maintRoomId,
      startAt: new Date(Date.now() - 3600 * 1000 * 12),
      endAt: new Date(Date.now() + 3600 * 1000 * 72),
      reason: 'تحديث وحدات التكييف والإضاءة الصوتية',
    })
    .onConflictDoNothing({ target: classroomMaintenances.id });

  await db
    .insert(teacherAvailability)
    .values([
      { id: seedUuid('61', 1), teacherId: t1, dayOfWeek: 1, startTime: '14:00', endTime: '18:00' },
      { id: seedUuid('61', 2), teacherId: t2, dayOfWeek: 2, startTime: '15:00', endTime: '19:00' },
      { id: seedUuid('61', 3), teacherId: t3, dayOfWeek: 4, startTime: '13:00', endTime: '17:00' },
    ])
    .onConflictDoNothing({ target: teacherAvailability.id });

  const tomorrowObj = new Date();
  tomorrowObj.setDate(tomorrowObj.getDate() + 1);
  const tomorrowIso = `${tomorrowObj.getFullYear()}-${String(tomorrowObj.getMonth() + 1).padStart(2, '0')}-${String(tomorrowObj.getDate()).padStart(2, '0')}`;

  const bookingSpecs = [
    { idx: 1, type: BookingRequestType.STUDENT_WITH_TEACHER, studentId: ctx.studentIds[0], teacherId: t1, purpose: 'مراجعة فردية على مسائل التفاضل المتقدمة', date: ctx.todayDate, start: '21:00', end: '22:00', room: reviewRoomId, status: BookingStatus.CONFIRMED },
    { idx: 2, type: BookingRequestType.TEACHER_WITH_CENTER, studentId: null, teacherId: t2, purpose: 'حصة مراجعة إضافية لقوانين كيرشوف', date: tomorrowIso, start: '15:00', end: '17:00', room: ctx.classroomsByCode.get('R-102')!, status: BookingStatus.CONFIRMED },
    { idx: 3, type: BookingRequestType.STUDENT_WITH_TEACHER, studentId: ctx.studentIds[3], teacherId: t3, purpose: 'استفسار ومراجعة معادلات الكيمياء العضوية', date: tomorrowIso, start: '18:00', end: '19:00', room: reviewRoomId, status: BookingStatus.PENDING },
    { idx: 4, type: BookingRequestType.TEACHER_WITH_CENTER, studentId: null, teacherId: t1, purpose: 'اختبار تجريبي لمجموعة الرياضيات', date: d(26), start: '12:00', end: '14:00', room: ctx.classroomsByCode.get('R-101')!, status: BookingStatus.PENDING },
    { idx: 5, type: BookingRequestType.STUDENT_WITH_TEACHER, studentId: ctx.studentIds[5], teacherId: t2, purpose: 'شرح نقاط فائتة في التيار الكهربي', date: d(6), start: '14:00', end: '15:00', room: reviewRoomId, status: BookingStatus.COMPLETED },
    { idx: 6, type: BookingRequestType.STUDENT_WITH_TEACHER, studentId: ctx.studentIds[8], teacherId: t3, purpose: 'طلب موعد خارج أوقات التفرغ', date: d(9), start: '22:00', end: '23:00', room: reviewRoomId, status: BookingStatus.REJECTED },
  ];

  for (const b of bookingSpecs) {
    const reqId = seedUuid('70', b.idx);
    await db
      .insert(bookingRequests)
      .values({
        id: reqId,
        requestType: b.type,
        studentId: b.studentId,
        teacherId: b.teacherId,
        purpose: b.purpose,
        requestedDate: b.date,
        startTime: b.start,
        endTime: b.end,
        durationMinutes: 60,
        requestedClassroomId: b.room,
        assignedClassroomId:
          b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.COMPLETED
            ? b.room
            : null,
        expectedAttendees: b.type === BookingRequestType.TEACHER_WITH_CENTER ? 35 : 1,
        status: b.status,
        createdByUserId: ctx.actorUserId,
      })
      .onConflictDoUpdate({
        target: bookingRequests.id,
        set: { requestedDate: b.date, status: b.status },
      });

    if (b.status === BookingStatus.CONFIRMED) {
      await db
        .insert(bookingApprovals)
        .values({
          id: seedUuid('71', b.idx),
          bookingRequestId: reqId,
          actorUserId: ctx.actorUserId,
          decision: 'APPROVED',
          assignedClassroomId: b.room,
          comment: 'تمت الموافقة وتخصيص القاعة',
        })
        .onConflictDoNothing({ target: bookingApprovals.id });

      await db
        .insert(classroomBookings)
        .values({
          id: seedUuid('72', b.idx),
          classroomId: b.room,
          bookingRequestId: reqId,
          bookingDate: b.date,
          startTime: b.start,
          endTime: b.end,
          title: b.purpose,
          status: 'CONFIRMED',
          allocatedByUserId: ctx.actorUserId,
        })
        .onConflictDoUpdate({
          target: classroomBookings.id,
          set: { bookingDate: b.date, status: 'CONFIRMED' },
        });
    }
  }
}
