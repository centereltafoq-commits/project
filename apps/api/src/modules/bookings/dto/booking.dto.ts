import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BookingRequestType, BookingStatus } from '@edu-center/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class BookingQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(BookingStatus, { message: 'حالة الحجز غير صالحة' })
  status?: BookingStatus;

  @IsOptional()
  @IsEnum(BookingRequestType, { message: 'نوع طلب الحجز غير صالح' })
  requestType?: BookingRequestType;

  @IsOptional()
  @IsUUID('4', { message: 'معرف المدرس غير صالح' })
  teacherId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف الطالب غير صالح' })
  studentId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'تاريخ البداية يجب أن يكون YYYY-MM-DD' })
  fromDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'تاريخ النهاية يجب أن يكون YYYY-MM-DD' })
  toDate?: string;
}

export class CreateBookingDto {
  @IsEnum(BookingRequestType, { message: 'نوع طلب الحجز غير صالح' })
  requestType: BookingRequestType;

  @IsUUID('4', { message: 'معرف المدرس مطلوب' })
  teacherId: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف الطالب غير صالح' })
  studentId?: string;

  @IsString()
  @MinLength(2, { message: 'سبب أو عنوان الحجز مطلوب' })
  @MaxLength(200)
  purpose: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'تاريخ الحجز يجب أن يكون بصيغة YYYY-MM-DD' })
  requestedDate: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'وقت البداية يجب أن يكون HH:mm' })
  startTime: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'وقت النهاية يجب أن يكون HH:mm' })
  endTime: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف القاعة المطلوبة غير صالح' })
  requestedClassroomId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  expectedAttendees?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CreateBookingSeriesDto {
  @IsEnum(BookingRequestType, { message: 'نوع طلب الحجز غير صالح' })
  requestType: BookingRequestType;

  @IsUUID('4', { message: 'معرف المدرس مطلوب' })
  teacherId: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف الطالب غير صالح' })
  studentId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'تاريخ بداية التكرار يجب أن يكون YYYY-MM-DD' })
  startDate: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'تاريخ نهاية التكرار يجب أن يكون YYYY-MM-DD' })
  endDate: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'وقت البداية يجب أن يكون HH:mm' })
  startTime: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'وقت النهاية يجب أن يكون HH:mm' })
  endTime: string;

  @IsString()
  @MinLength(2, { message: 'سبب أو عنوان الحجز مطلوب' })
  @MaxLength(200)
  purpose: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف القاعة المطلوبة غير صالح' })
  requestedClassroomId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  expectedAttendees?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class AvailableClassroomsQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  endTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedAttendees?: number;
}

export class ReviewBookingDto {
  @IsIn([BookingStatus.CONFIRMED, BookingStatus.REJECTED], {
    message: 'قرار المراجعة يجب أن يكون CONFIRMED أو REJECTED',
  })
  status: BookingStatus.CONFIRMED | BookingStatus.REJECTED;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  requestedDate?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  startTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)
  endTime?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف القاعة المخصصة غير صالح' })
  assignedClassroomId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  expectedAttendees?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}
