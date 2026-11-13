import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TeacherEmploymentStatus } from '@edu-center/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class TeacherQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(TeacherEmploymentStatus, { message: 'حالة التعاقد غير صالحة' })
  employmentStatus?: TeacherEmploymentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  specialization?: string;
}

export class TeacherProfileQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'صيغة الشهر يجب أن تكون YYYY-MM',
  })
  yearMonth?: string;
}

export class CreateTeacherDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  teacherCode?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف حساب المستخدم غير صالح' })
  userId?: string | null;

  @IsString({ message: 'اسم المدرس مطلوب' })
  @MinLength(2)
  @MaxLength(160)
  fullName: string;

  @IsString({ message: 'رقم الهاتف مطلوب' })
  @MinLength(6)
  @MaxLength(30)
  phone: string;

  @IsString({ message: 'التخصص مطلوب' })
  @MinLength(2)
  @MaxLength(100)
  specialization: string;

  @IsOptional()
  @IsDateString({}, { message: 'تاريخ التعاقد غير صالح' })
  contractDate?: string;

  @IsOptional()
  @IsEnum(TeacherEmploymentStatus)
  employmentStatus?: TeacherEmploymentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateTeacherDto {
  @IsOptional()
  @IsUUID()
  userId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  specialization?: string;

  @IsOptional()
  @IsDateString()
  contractDate?: string;

  @IsOptional()
  @IsEnum(TeacherEmploymentStatus)
  employmentStatus?: TeacherEmploymentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class TeacherAvailabilitySlotDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'وقت البداية يجب أن يكون بصيغة HH:mm' })
  startTime: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'وقت النهاية يجب أن يكون بصيغة HH:mm' })
  endTime: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTeacherAvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TeacherAvailabilitySlotDto)
  slots: TeacherAvailabilitySlotDto[];
}
