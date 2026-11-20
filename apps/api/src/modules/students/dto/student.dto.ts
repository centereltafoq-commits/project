import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { StudentStatus } from '@edu-center/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class StudentQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(StudentStatus, { message: 'حالة الطالب غير صالحة' })
  status?: StudentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  gradeLevel?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف المجموعة غير صالح' })
  groupId?: string;
}

export class StudentProfileQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'صيغة الشهر يجب أن تكون YYYY-MM',
  })
  yearMonth?: string;
}

export class CreateStudentDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  studentCode?: string;

  @IsString({ message: 'اسم الطالب مطلوب' })
  @MinLength(2, { message: 'اسم الطالب يجب ألا يقل عن حرفين' })
  @MaxLength(160)
  fullName: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @ValidateIf((o) => o.phone !== null && o.phone !== undefined)
  @IsString({ message: 'رقم هاتف الطالب غير صالح' })
  @MinLength(6, { message: 'رقم هاتف الطالب يجب ألا يقل عن 6 أرقام' })
  @MaxLength(30)
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @ValidateIf((o) => o.guardianPhone !== null && o.guardianPhone !== undefined)
  @IsString({ message: 'رقم هاتف ولي الأمر غير صالح' })
  @MinLength(6, { message: 'رقم هاتف ولي الأمر يجب ألا يقل عن 6 أرقام' })
  @MaxLength(30)
  guardianPhone?: string | null;

  @IsString({ message: 'الصف الدراسي مطلوب' })
  @MinLength(1)
  @MaxLength(80)
  gradeLevel: string;

  @IsOptional()
  @IsDateString({}, { message: 'تاريخ التسجيل غير صالح' })
  registrationDate?: string;

  @IsOptional()
  @IsEnum(StudentStatus, { message: 'حالة الطالب غير صالحة' })
  status?: StudentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class UpdateStudentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  fullName?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @ValidateIf((o) => o.phone !== null && o.phone !== undefined)
  @IsString({ message: 'رقم هاتف الطالب غير صالح' })
  @MinLength(6, { message: 'رقم هاتف الطالب يجب ألا يقل عن 6 أرقام' })
  @MaxLength(30)
  phone?: string | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() || null : value,
  )
  @ValidateIf((o) => o.guardianPhone !== null && o.guardianPhone !== undefined)
  @IsString({ message: 'رقم هاتف ولي الأمر غير صالح' })
  @MinLength(6, { message: 'رقم هاتف ولي الأمر يجب ألا يقل عن 6 أرقام' })
  @MaxLength(30)
  guardianPhone?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  gradeLevel?: string;

  @IsOptional()
  @IsDateString()
  registrationDate?: string;

  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
