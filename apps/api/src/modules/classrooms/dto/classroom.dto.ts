import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ClassroomStatus } from '@edu-center/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ClassroomQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ClassroomStatus, { message: 'حالة القاعة غير صالحة' })
  status?: ClassroomStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minCapacity?: number;
}

export class AvailableClassroomsQueryDto {
  @IsDateString({}, { message: 'التاريخ مطلوب بصيغة YYYY-MM-DD' })
  date: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'وقت البداية يجب أن يكون بصيغة HH:mm' })
  startTime: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'وقت النهاية يجب أن يكون بصيغة HH:mm' })
  endTime: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minCapacity: number = 1;
}

export class ClassroomScheduleQueryDto {
  @IsDateString({}, { message: 'تاريخ البداية مطلوب بصيغة YYYY-MM-DD' })
  from: string;

  @IsDateString({}, { message: 'تاريخ النهاية مطلوب بصيغة YYYY-MM-DD' })
  to: string;
}

export class CreateClassroomDto {
  @IsString({ message: 'رقم القاعة مطلوب' })
  @MinLength(1)
  @MaxLength(32)
  roomNumber: string;

  @IsString({ message: 'اسم القاعة مطلوب' })
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @Type(() => Number)
  @IsInt({ message: 'السعة القصوى يجب أن تكون رقماً صحيحاً' })
  @Min(1)
  maxCapacity: number;

  @Type(() => Number)
  @IsInt({ message: 'عدد المقاعد يجب أن يكون رقماً صحيحاً' })
  @Min(1)
  seatsCount: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipment?: string[];

  @IsOptional()
  @IsEnum(ClassroomStatus)
  status?: ClassroomStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateClassroomDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  roomNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxCapacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  seatsCount?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipment?: string[];

  @IsOptional()
  @IsEnum(ClassroomStatus)
  status?: ClassroomStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateMaintenanceDto {
  @IsDateString({}, { message: 'وقت بدء الصيانة غير صالح' })
  startAt: string;

  @IsDateString({}, { message: 'وقت انتهاء الصيانة غير صالح' })
  endAt: string;

  @IsString({ message: 'سبب الصيانة مطلوب' })
  @MinLength(2)
  @MaxLength(255)
  reason: string;
}
