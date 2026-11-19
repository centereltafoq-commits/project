import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { EnrollmentStatus } from '@edu-center/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class EnrollmentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(EnrollmentStatus, { message: 'حالة الاشتراك غير صالحة' })
  status?: EnrollmentStatus;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'صيغة الشهر يجب أن تكون YYYY-MM' })
  yearMonth?: string;
}

export class CreateEnrollmentDto {
  @IsUUID('4', { message: 'اختيار الطالب مطلوب' })
  studentId: string;

  @IsOptional()
  @IsDateString({}, { message: 'تاريخ بدء الاشتراك غير صالح' })
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  agreedMonthlyPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  agreedSessionsCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  agreedSessionPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateEnrollmentDto {
  @IsEnum(EnrollmentStatus, { message: 'حالة الاشتراك غير صالحة' })
  status: EnrollmentStatus;

  @IsOptional()
  @IsDateString({}, { message: 'تاريخ الإيقاف أو الانتهاء غير صالح' })
  endDate?: string | null;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  agreedMonthlyPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
