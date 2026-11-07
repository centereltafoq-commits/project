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

export function expandMaintenanceDays(params: {
  startAt: Date;
  endAt: Date;
  fromDate: string;
  toDate: string;
}): Array<{ date: string; startTime: string; endTime: string }> {
  const result: Array<{ date: string; startTime: string; endTime: string }> = [];
  const startIsoDay = params.startAt.toISOString().slice(0, 10);
  const endIsoDay = params.endAt.toISOString().slice(0, 10);

  const firstDay = startIsoDay > params.fromDate ? startIsoDay : params.fromDate;
  const lastDay = endIsoDay < params.toDate ? endIsoDay : params.toDate;

  const cursor = new Date(`${firstDay}T00:00:00.000Z`);
  const endCursor = new Date(`${lastDay}T00:00:00.000Z`);

  while (cursor <= endCursor) {
    const dayStr = cursor.toISOString().slice(0, 10);
    const startTime =
      dayStr === startIsoDay ? params.startAt.toISOString().slice(11, 16) : '00:00';
    const endTime =
      dayStr === endIsoDay ? params.endAt.toISOString().slice(11, 16) : '23:59';

    result.push({ date: dayStr, startTime, endTime });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}
