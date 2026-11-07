import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const YEAR_MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export class YearMonthBodyDto {
  @Matches(YEAR_MONTH_REGEX, {
    message: 'صيغة الشهر يجب أن تكون YYYY-MM (مثال: 2026-10)',
  })
  yearMonth: string;
}

export class YearMonthQueryDto {
  @Matches(YEAR_MONTH_REGEX, {
    message: 'صيغة الشهر يجب أن تكون YYYY-MM (مثال: 2026-10)',
  })
  yearMonth: string;
}

export class StudentRecordsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Matches(YEAR_MONTH_REGEX, {
    message: 'صيغة الشهر يجب أن تكون YYYY-MM',
  })
  yearMonth?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف المجموعة غير صالح' })
  groupId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف الطالب غير صالح' })
  studentId?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return value === true || value === 'true' || value === '1';
  })
  @IsBoolean()
  onlyUnpaid?: boolean;
}

export class TeacherRecordsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Matches(YEAR_MONTH_REGEX, {
    message: 'صيغة الشهر يجب أن تكون YYYY-MM',
  })
  yearMonth?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف المدرس غير صالح' })
  teacherId?: string;
}

export class AssistantRecordsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Matches(YEAR_MONTH_REGEX, {
    message: 'صيغة الشهر يجب أن تكون YYYY-MM',
  })
  yearMonth?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف المساعد غير صالح' })
  assistantId?: string;
}
