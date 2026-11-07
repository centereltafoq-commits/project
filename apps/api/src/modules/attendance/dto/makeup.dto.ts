import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { MakeupStatus } from '@edu-center/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class MakeupQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'معرف الطالب غير صالح' })
  studentId?: string;

  @IsOptional()
  @IsEnum(MakeupStatus, { message: 'حالة الحصة التعويضية غير صالحة' })
  status?: MakeupStatus;
}

export class CreateMakeupDto {
  @IsUUID('4', { message: 'معرف الطالب مطلوب' })
  studentId: string;

  @IsUUID('4', { message: 'معرف الحصة الأصلية مطلوب' })
  originalSessionId: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'تاريخ الغياب يجب أن يكون بصيغة YYYY-MM-DD' })
  absenceDate?: string;

  @IsOptional()
  @IsISO8601({}, { message: 'موعد الحصة التعويضية غير صالح' })
  scheduledAt?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف القاعة غير صالح' })
  classroomId?: string;

  @IsBoolean({ message: 'يرجى تحديد ما إذا كانت الحصة التعويضية مجانية' })
  isFree: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'قيمة الرسوم الإضافية غير صالحة' })
  @Min(0)
  extraFee?: number;

  @IsOptional()
  @IsEnum(MakeupStatus, { message: 'حالة الحصة التعويضية غير صالحة' })
  status?: MakeupStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdateMakeupDto {
  @IsOptional()
  @IsEnum(MakeupStatus, { message: 'حالة الحصة التعويضية غير صالحة' })
  status?: MakeupStatus;

  @IsOptional()
  @IsISO8601({}, { message: 'موعد الحصة التعويضية غير صالح' })
  scheduledAt?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف القاعة غير صالح' })
  classroomId?: string;

  @IsOptional()
  @IsBoolean()
  isFree?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  extraFee?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
