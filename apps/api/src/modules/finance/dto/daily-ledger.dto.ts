import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ISO_DATE_REGEX } from './payments-payouts.dto';
import { YEAR_MONTH_REGEX } from './settlement.dto';

export const DAILY_LEDGER_ENTRY_TYPES = [
  'ALL',
  'PAYMENT',
  'TEACHER_PAYOUT',
  'ASSISTANT_PAYOUT',
  'EXPENSE',
] as const;

export type DailyLedgerEntryType = (typeof DAILY_LEDGER_ENTRY_TYPES)[number];

export class DailyLedgerQueryDto {
  @IsOptional()
  @Matches(YEAR_MONTH_REGEX, { message: 'صيغة الشهر يجب أن تكون YYYY-MM' })
  yearMonth?: string;

  @IsOptional()
  @Matches(ISO_DATE_REGEX, { message: 'صيغة التاريخ يجب أن تكون YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsIn(DAILY_LEDGER_ENTRY_TYPES, { message: 'نوع الحركة المالية غير صالح' })
  type?: DailyLedgerEntryType;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
