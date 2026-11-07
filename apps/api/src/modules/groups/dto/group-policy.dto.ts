import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  AssistantCalculationMethod,
  FullMonthAbsencePolicy,
  GroupRevenueSplitMethod,
} from '@edu-center/shared';

export class GroupScheduleSlotDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'وقت البداية يجب أن يكون بصيغة HH:mm' })
  startTime: string;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'وقت النهاية يجب أن يكون بصيغة HH:mm' })
  endTime: string;
}

export class FinancialPolicyInputDto {
  @IsEnum(GroupRevenueSplitMethod, { message: 'طريقة تقسيم العائد غير صالحة' })
  revenueSplitMethod: GroupRevenueSplitMethod;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  teacherSharePerStudent: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  centerSharePerStudent: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  teacherPercentage?: number;

  @IsOptional()
  @IsEnum(FullMonthAbsencePolicy)
  fullMonthAbsencePolicy?: FullMonthAbsencePolicy;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fullAbsenceFixedFee?: number;

  @IsOptional()
  @IsBoolean()
  chargeExcusedAbsence?: boolean;
}

export class GroupAssistantAssignmentDto {
  @IsUUID()
  assistantId: string;

  @IsOptional()
  @IsEnum(AssistantCalculationMethod)
  overrideCalculationMethod?: AssistantCalculationMethod;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  overrideRateValue?: number;
}
