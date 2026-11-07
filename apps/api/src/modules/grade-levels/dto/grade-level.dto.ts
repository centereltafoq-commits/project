import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGradeLevelDto {
  @IsString({ message: 'اسم الصف الدراسي يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'اسم الصف الدراسي مطلوب' })
  @MaxLength(120, { message: 'اسم الصف لا يمكن أن يتجاوز 120 حرفاً' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @IsOptional()
  @IsString({ message: 'كود الصف يجب أن يكون نصاً' })
  @MaxLength(64, { message: 'كود الصف لا يمكن أن يتجاوز 64 حرفاً' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  code?: string;

  @IsOptional()
  @IsInt({ message: 'ترتيب العرض يجب أن يكون رقماً صحيحاً' })
  @Min(0, { message: 'ترتيب العرض لا يمكن أن يقل عن 0' })
  @Transform(({ value }: { value: unknown }) =>
    value !== undefined && value !== null && value !== '' ? Number(value) : 0,
  )
  orderIndex?: number;

  @IsOptional()
  @IsBoolean({ message: 'حالة التفعيل يجب أن تكون قيمة منطقية' })
  @Transform(({ value }: { value: unknown }) =>
    value === true || value === 'true'
      ? true
      : value === false || value === 'false'
        ? false
        : undefined,
  )
  isActive?: boolean;
}

export class UpdateGradeLevelDto {
  @IsOptional()
  @IsString({ message: 'اسم الصف الدراسي يجب أن يكون نصاً' })
  @MaxLength(120, { message: 'اسم الصف لا يمكن أن يتجاوز 120 حرفاً' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @IsOptional()
  @IsString({ message: 'كود الصف يجب أن يكون نصاً' })
  @MaxLength(64, { message: 'كود الصف لا يمكن أن يتجاوز 64 حرفاً' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  code?: string;

  @IsOptional()
  @IsInt({ message: 'ترتيب العرض يجب أن يكون رقماً صحيحاً' })
  @Min(0, { message: 'ترتيب العرض لا يمكن أن يقل عن 0' })
  @Transform(({ value }: { value: unknown }) =>
    value !== undefined && value !== null && value !== '' ? Number(value) : undefined,
  )
  orderIndex?: number;

  @IsOptional()
  @IsBoolean({ message: 'حالة التفعيل يجب أن تكون قيمة منطقية' })
  @Transform(({ value }: { value: unknown }) =>
    value === true || value === 'true'
      ? true
      : value === false || value === 'false'
        ? false
        : undefined,
  )
  isActive?: boolean;
}

export class GradeLevelQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => value === true || value === 'true')
  activeOnly?: boolean;
}

