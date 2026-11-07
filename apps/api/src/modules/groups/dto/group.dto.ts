import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  FinancialPolicyInputDto,
  GroupAssistantAssignmentDto,
  GroupScheduleSlotDto,
} from './group-policy.dto';

export { FinancialPolicyInputDto, GroupAssistantAssignmentDto, GroupScheduleSlotDto };

export class GroupQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  primaryTeacherId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  gradeLevel?: string;

  @IsOptional()
  @IsString()
  isActive?: string;
}

export class CreateGroupDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  groupCode?: string;

  @IsString({ message: 'اسم المجموعة مطلوب' })
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @IsString({ message: 'المادة الدراسية مطلوبة' })
  @MinLength(1)
  @MaxLength(100)
  subject: string;

  @IsString({ message: 'الصف الدراسي مطلوب' })
  @MinLength(1)
  @MaxLength(80)
  gradeLevel: string;

  @IsUUID('4', { message: 'المدرس الأساسي مطلوب' })
  primaryTeacherId: string;

  @IsOptional()
  @IsUUID()
  defaultClassroomId?: string | null;

  @Type(() => Number)
  @IsInt({ message: 'عدد الحصص الشهرية يجب أن يكون رقماً صحيحاً' })
  @Min(1)
  monthlySessionsCount: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'قيمة الاشتراك الشهري يجب أن تكون رقماً' })
  @Min(0)
  monthlyPrice: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupScheduleSlotDto)
  scheduleSlots?: GroupScheduleSlotDto[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxStudents?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ValidateNested()
  @Type(() => FinancialPolicyInputDto)
  financialPolicy: FinancialPolicyInputDto;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  coTeacherIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupAssistantAssignmentDto)
  assistants?: GroupAssistantAssignmentDto[];
}

export class UpdateGroupDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  subject?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  gradeLevel?: string;

  @IsOptional()
  @IsUUID()
  primaryTeacherId?: string;

  @IsOptional()
  @IsUUID()
  defaultClassroomId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  monthlySessionsCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyPrice?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupScheduleSlotDto)
  scheduleSlots?: GroupScheduleSlotDto[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxStudents?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => FinancialPolicyInputDto)
  financialPolicy?: FinancialPolicyInputDto;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  coTeacherIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupAssistantAssignmentDto)
  assistants?: GroupAssistantAssignmentDto[];
}
