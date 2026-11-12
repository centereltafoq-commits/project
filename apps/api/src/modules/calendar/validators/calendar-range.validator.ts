import { BadRequestException } from '@nestjs/common';

export function resolveAndValidateCalendarRange(from?: string, to?: string): {
  fromDate: string;
  toDate: string;
  rangeStartUtc: Date;
  rangeEndUtc: Date;
} {
  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);

  const fromDate = from || defaultStart;
  const toDate = to || defaultEnd;

  const rangeStartUtc = new Date(`${fromDate}T00:00:00.000Z`);
  const rangeEndUtc = new Date(`${toDate}T23:59:59.999Z`);

  if (Number.isNaN(rangeStartUtc.getTime()) || Number.isNaN(rangeEndUtc.getTime())) {
    throw new BadRequestException('نطاق التاريخ المحدد للتقويم غير صالح');
  }

  if (rangeEndUtc < rangeStartUtc) {
    throw new BadRequestException('تاريخ النهاية يجب أن يكون بعد أو يساوي تاريخ البداية');
  }

  const daysSpan = Math.round((rangeEndUtc.getTime() - rangeStartUtc.getTime()) / 86_400_000);
  if (daysSpan > 120) {
    throw new BadRequestException('الحد الأقصى لعرض التقويم في الطلب الواحد هو 120 يوماً');
  }

  return { fromDate, toDate, rangeStartUtc, rangeEndUtc };
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatLocalTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function expandMaintenanceDays(params: {
  startAt: Date;
  endAt: Date;
  fromDate: string;
  toDate: string;
}): Array<{ date: string; startTime: string; endTime: string }> {
  const result: Array<{ date: string; startTime: string; endTime: string }> = [];
  const startDay = formatLocalDate(params.startAt);
  const endDay = formatLocalDate(params.endAt);

  const firstDay = startDay > params.fromDate ? startDay : params.fromDate;
  const lastDay = endDay < params.toDate ? endDay : params.toDate;

  const [fy, fm, fd] = firstDay.split('-').map(Number);
  const [ly, lm, ld] = lastDay.split('-').map(Number);
  const cursor = new Date(fy!, fm! - 1, fd!);
  const endCursor = new Date(ly!, lm! - 1, ld!);

  while (cursor <= endCursor) {
    const dayStr = formatLocalDate(cursor);
    const startTime =
      dayStr === startDay ? formatLocalTime(params.startAt) : '00:00';
    const endTime =
      dayStr === endDay ? formatLocalTime(params.endAt) : '23:59';

    result.push({ date: dayStr, startTime, endTime });
    cursor.setDate(cursor.getDate() + 1);
  }

  return result;
}
