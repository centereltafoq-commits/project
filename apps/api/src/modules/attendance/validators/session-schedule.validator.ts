import { BadRequestException } from '@nestjs/common';
import { GroupScheduleSlot } from '../../../database/schemas/groups.schema';
import {
  AttendanceRecordItemDto,
  RecordSessionAttendanceDto,
} from '../dto/attendance-record.dto';

export function parseHHmmToMinutes(time: string): number {
  const parts = time.trim().split(':');
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new BadRequestException(`صيغة الوقت غير صالحة: ${time}`);
  }
  return hours * 60 + minutes;
}

export function assertValidTimeRange(startTime: string, endTime: string): number {
  const startMin = parseHHmmToMinutes(startTime);
  const endMin = parseHHmmToMinutes(endTime);
  if (endMin <= startMin) {
    throw new BadRequestException('وقت نهاية الحصة يجب أن يكون بعد وقت البداية');
  }
  return endMin - startMin;
}

export interface GeneratedSlotDate {
  sessionDate: string;
  yearMonth: string;
  startTime: string;
  endTime: string;
  classroomId?: string | null;
}

export function buildMonthSessionDates(
  yearMonth: string,
  slots: GroupScheduleSlot[],
): GeneratedSlotDate[] {
  if (!slots || slots.length === 0) {
    throw new BadRequestException(
      'لا توجد مواعيد أسبوعية مسجلة لهذه المجموعة لتوليد الحصص تلقائياً',
    );
  }

  const [yearStr, monthStr] = yearMonth.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (Number.isNaN(year) || Number.isNaN(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new BadRequestException('صيغة الشهر غير صالحة (YYYY-MM)');
  }

  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const generated: GeneratedSlotDate[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const utcDate = new Date(Date.UTC(year, monthIndex, day));
    const dayOfWeek = utcDate.getUTCDay();
    const dateIso = `${yearStr}-${monthStr}-${String(day).padStart(2, '0')}`;

    for (const slot of slots) {
      if (Number(slot.dayOfWeek) === dayOfWeek) {
        assertValidTimeRange(slot.startTime, slot.endTime);
        generated.push({
          sessionDate: dateIso,
          yearMonth,
          startTime: slot.startTime,
          endTime: slot.endTime,
          classroomId: slot.classroomId ?? null,
        });
      }
    }
  }

  return generated;
}

export function normalizeAttendanceItems(
  dto: RecordSessionAttendanceDto,
): AttendanceRecordItemDto[] {
  const rawItems: AttendanceRecordItemDto[] = [];

  if (Array.isArray(dto.records) && dto.records.length > 0) {
    rawItems.push(...dto.records);
  } else if (dto.studentId && dto.status) {
    rawItems.push({
      studentId: dto.studentId,
      status: dto.status,
      notes: dto.notes,
    });
  }

  if (rawItems.length === 0) {
    throw new BadRequestException('يجب إرسال سجل حضور طالب واحد على الأقل');
  }

  const deduped = new Map<string, AttendanceRecordItemDto>();
  for (const item of rawItems) {
    deduped.set(item.studentId, item);
  }
  return Array.from(deduped.values());
}
