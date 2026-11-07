import { BadRequestException } from '@nestjs/common';
import { BookingRequestType } from '@edu-center/shared';

export function parseTimeToMinutes(hhmm: string): number {
  const parts = hhmm.trim().split(':');
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    throw new BadRequestException(`صيغة الوقت غير صالحة: ${hhmm}`);
  }
  return h * 60 + m;
}

export function computeDurationMinutes(startTime: string, endTime: string): number {
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (end <= start) {
    throw new BadRequestException('وقت النهاية يجب أن يكون بعد وقت البداية');
  }
  return end - start;
}

export function isTimeOverlapping(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const sA = parseTimeToMinutes(startA);
  const eA = parseTimeToMinutes(endA);
  const sB = parseTimeToMinutes(startB);
  const eB = parseTimeToMinutes(endB);
  return sA < eB && eA > sB;
}

export function assertValidBookingParticipant(
  requestType: BookingRequestType,
  studentId?: string | null,
): void {
  if (requestType === BookingRequestType.STUDENT_WITH_TEACHER && !studentId) {
    throw new BadRequestException('يجب اختيار الطالب عند إنشاء حجز طالب مع مدرس');
  }
}

export function generateSeriesOccurrenceDates(
  startDate: string,
  endDate: string,
  dayOfWeek: number,
): string[] {
  const startUtc = new Date(`${startDate}T00:00:00Z`);
  const endUtc = new Date(`${endDate}T00:00:00Z`);

  if (Number.isNaN(startUtc.getTime()) || Number.isNaN(endUtc.getTime())) {
    throw new BadRequestException('تواريخ بداية ونهاية التكرار غير صالحة');
  }
  if (endUtc < startUtc) {
    throw new BadRequestException('تاريخ نهاية السلسلة يجب أن يكون بعد أو يساوي تاريخ البداية');
  }

  const diffDays = Math.round((endUtc.getTime() - startUtc.getTime()) / 86_400_000);
  if (diffDays > 366) {
    throw new BadRequestException('الحد الأقصى لفترة الحجز المتكرر هو سنة واحدة (366 يوماً)');
  }

  const dates: string[] = [];
  const cursor = new Date(startUtc);
  while (cursor <= endUtc) {
    if (cursor.getUTCDay() === dayOfWeek) {
      dates.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (dates.length === 0) {
    throw new BadRequestException(
      'لا يوجد أي يوم مطابق لليوم المختار ضمن الفترة الزمنية المحددة',
    );
  }

  return dates;
}
