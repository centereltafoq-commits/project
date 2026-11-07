import { IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { SessionStatus } from '@edu-center/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class SessionQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'معرف المجموعة غير صالح' })
  groupId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف المدرس غير صالح' })
  teacherId?: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'صيغة الشهر يجب أن تكون YYYY-MM' })
  yearMonth?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'صيغة التاريخ يجب أن تكون YYYY-MM-DD' })
  sessionDate?: string;

  @IsOptional()
  @IsEnum(SessionStatus, { message: 'حالة الحصة غير صالحة' })
  status?: SessionStatus;
}

export class CreateSessionDto {
  @IsUUID('4', { message: 'معرف المجموعة مطلوب' })
  groupId: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف المدرس غير صالح' })
  teacherId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف القاعة غير صالح' })
  classroomId?: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'تاريخ الحصة يجب أن يكون بصيغة YYYY-MM-DD' })
  sessionDate: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'وقت البداية يجب أن يكون بصيغة HH:mm' })
  startTime: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: 'وقت النهاية يجب أن يكون بصيغة HH:mm' })
  endTime: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class GenerateMonthSessionsDto {
  @IsUUID('4', { message: 'معرف المجموعة مطلوب' })
  groupId: string;

  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'صيغة الشهر يجب أن تكون YYYY-MM' })
  yearMonth: string;
}
