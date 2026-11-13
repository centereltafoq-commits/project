import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { AssistantCalculationMethod } from '@edu-center/shared';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class AssistantQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'], { message: 'الحالة غير صالحة' })
  status?: 'ACTIVE' | 'INACTIVE';

  @IsOptional()
  @IsEnum(AssistantCalculationMethod, { message: 'طريقة الاحتساب غير صالحة' })
  calculationMethod?: AssistantCalculationMethod;
}

export class AssistantProfileQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'صيغة الشهر يجب أن تكون YYYY-MM',
  })
  yearMonth?: string;
}

export class CreateAssistantDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  assistantCode?: string;

  @IsString({ message: 'اسم المساعد مطلوب' })
  @MinLength(2)
  @MaxLength(160)
  fullName: string;

  @IsString({ message: 'رقم الهاتف مطلوب' })
  @MinLength(6)
  @MaxLength(30)
  phone: string;

  @IsEnum(AssistantCalculationMethod, { message: 'طريقة احتساب المستحقات مطلوبة' })
  calculationMethod: AssistantCalculationMethod;

  @Type(() => Number)
  @IsNumber({}, { message: 'قيمة النسبة أو المبلغ يجب أن تكون رقماً' })
  @Min(0, { message: 'القيمة المالية أو النسبة لا يمكن أن تكون سالبة' })
  @ValidateIf((o) => o.calculationMethod === AssistantCalculationMethod.SESSION_COMMISSION_PERCENT)
  @Max(100, { message: 'نسبة عمولة المساعد لا يمكن أن تتجاوز 100%' })
  rateValue: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customFormulaNote?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}

export class UpdateAssistantDto {
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
  @IsEnum(AssistantCalculationMethod)
  calculationMethod?: AssistantCalculationMethod;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rateValue?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customFormulaNote?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}
