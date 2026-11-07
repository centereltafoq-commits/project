import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
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

  @IsString({ message: 'رقم هاتف الطالب مطلوب' })
  @MinLength(6)
  @MaxLength(30)
  phone: string;

  @IsString({ message: 'رقم هاتف ولي الأمر مطلوب' })
  @MinLength(6)
  @MaxLength(30)
  guardianPhone: string;

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
  @IsString()
  @MinLength(6)
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(30)
  guardianPhone?: string;

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
