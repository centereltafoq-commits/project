import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export const REPORT_TYPES = [
  'students',
  'attendance',
  'student-statement',
  'groups-revenue',
  'teacher-statement',
  'assistant-statement',
  'collections',
  'expenses',
  'bookings',
  'classrooms',
  'financial-summary',
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export class ReportQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'صيغة الشهر يجب أن تكون YYYY-MM',
  })
  yearMonth?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرّف المجموعة غير صالح' })
  groupId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرّف المدرس غير صالح' })
  teacherId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرّف الطالب غير صالح' })
  studentId?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  exportAll?: 'true' | 'false';

  @IsOptional()
  @IsString()
  @MaxLength(40)
  status?: string;
}
