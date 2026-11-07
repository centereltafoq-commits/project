import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ExpenseCategory, PaymentMethod } from '@edu-center/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ISO_DATE_REGEX } from './payments-payouts.dto';
import { YEAR_MONTH_REGEX } from './settlement.dto';

export class ExpensesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Matches(YEAR_MONTH_REGEX, { message: 'صيغة الشهر يجب أن تكون YYYY-MM' })
  yearMonth?: string;

  @IsOptional()
  @IsEnum(ExpenseCategory, { message: 'بند المصروف غير صالح' })
  category?: ExpenseCategory;
}

export class CreateExpenseDto {
  @IsEnum(ExpenseCategory, { message: 'بند المصروف غير صالح' })
  category: ExpenseCategory;

  @IsString()
  @MinLength(2, { message: 'وصف/عنوان المصروف قصير جداً' })
  @MaxLength(180)
  title: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'المبلغ يجب أن يكون رقماً صالحاً' })
  @IsPositive({ message: 'قيمة المصروف يجب أن تكون أكبر من صفر' })
  amount: number;

  @Matches(ISO_DATE_REGEX, { message: 'تاريخ المصروف يجب أن يكون بصيغة YYYY-MM-DD' })
  expenseDate: string;

  @IsOptional()
  @Matches(YEAR_MONTH_REGEX, { message: 'صيغة الشهر يجب أن تكون YYYY-MM' })
  yearMonth?: string;

  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'وسيلة السداد غير مدعومة' })
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsEnum(ExpenseCategory, { message: 'بند المصروف غير صالح' })
  category?: ExpenseCategory;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @IsOptional()
  @Matches(ISO_DATE_REGEX)
  expenseDate?: string;

  @IsOptional()
  @Matches(YEAR_MONTH_REGEX)
  yearMonth?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
