import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '@edu-center/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { YEAR_MONTH_REGEX } from './settlement.dto';

export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class PaymentAllocationItemDto {
  @IsUUID('4', { message: 'معرف المجموعة في توزيع الدفعة غير صالح' })
  groupId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'قيمة التوزيع يجب أن تكون رقماً صالحاً' })
  @IsPositive({ message: 'قيمة التوزيع يجب أن تكون أكبر من صفر' })
  amount: number;
}

export class CreatePaymentDto {
  @IsUUID('4', { message: 'معرف الطالب غير صالح' })
  studentId: string;

  @Matches(YEAR_MONTH_REGEX, {
    message: 'صيغة الشهر يجب أن تكون YYYY-MM',
  })
  yearMonth: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'المبلغ يجب أن يكون رقماً صالحاً' })
  @IsPositive({ message: 'المبلغ المحصل يجب أن يكون أكبر من صفر' })
  amount: number;

  @IsOptional()
  @Matches(ISO_DATE_REGEX, { message: 'تاريخ السداد يجب أن يكون بصيغة YYYY-MM-DD' })
  paymentDate?: string;

  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'وسيلة الدفع غير مدعومة' })
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  receiptNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationItemDto)
  allocations?: PaymentAllocationItemDto[];
}

export class PaymentsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Matches(YEAR_MONTH_REGEX, { message: 'صيغة الشهر يجب أن تكون YYYY-MM' })
  yearMonth?: string;

  @IsOptional()
  @Matches(ISO_DATE_REGEX, { message: 'صيغة التاريخ يجب أن تكون YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'وسيلة الدفع غير مدعومة' })
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsUUID('4', { message: 'معرف الطالب غير صالح' })
  studentId?: string;
}

export class CreateTeacherPayoutDto {
  @IsUUID('4', { message: 'معرف المدرس غير صالح' })
  teacherId: string;

  @Matches(YEAR_MONTH_REGEX, { message: 'صيغة الشهر يجب أن تكون YYYY-MM' })
  yearMonth: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'المبلغ يجب أن يكون رقماً صالحاً' })
  @IsPositive({ message: 'مبلغ الصرف يجب أن يكون أكبر من صفر' })
  amount: number;

  @IsOptional()
  @Matches(ISO_DATE_REGEX, { message: 'تاريخ الصرف يجب أن يكون بصيغة YYYY-MM-DD' })
  payoutDate?: string;

  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'وسيلة الصرف غير مدعومة' })
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class TeacherPayoutsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Matches(YEAR_MONTH_REGEX, { message: 'صيغة الشهر يجب أن تكون YYYY-MM' })
  yearMonth?: string;

  @IsOptional()
  @Matches(ISO_DATE_REGEX, { message: 'صيغة التاريخ يجب أن تكون YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف المدرس غير صالح' })
  teacherId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}

export class CreateAssistantPayoutDto {
  @IsUUID('4', { message: 'معرف المساعد غير صالح' })
  assistantId: string;

  @Matches(YEAR_MONTH_REGEX, { message: 'صيغة الشهر يجب أن تكون YYYY-MM' })
  yearMonth: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'المبلغ يجب أن يكون رقماً صالحاً' })
  @IsPositive({ message: 'مبلغ الصرف يجب أن يكون أكبر من صفر' })
  amount: number;

  @IsOptional()
  @Matches(ISO_DATE_REGEX, { message: 'تاريخ الصرف يجب أن يكون بصيغة YYYY-MM-DD' })
  payoutDate?: string;

  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'وسيلة الصرف غير مدعومة' })
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  referenceNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class AssistantPayoutsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Matches(YEAR_MONTH_REGEX, { message: 'صيغة الشهر يجب أن تكون YYYY-MM' })
  yearMonth?: string;

  @IsOptional()
  @Matches(ISO_DATE_REGEX, { message: 'صيغة التاريخ يجب أن تكون YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف المساعد غير صالح' })
  assistantId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
