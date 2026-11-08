import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString({ message: 'اسم السنتر يجب أن يكون نصاً' })
  @MaxLength(200, { message: 'اسم السنتر لا يجب أن يتجاوز 200 حرف' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  centerName?: string;

  @IsOptional()
  @IsString({ message: 'الوصف الفرعي يجب أن يكون نصاً' })
  @MaxLength(255, { message: 'الوصف لا يجب أن يتجاوز 255 حرف' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  centerSubtitle?: string;

  @IsOptional()
  @IsString({ message: 'رابط الشعار يجب أن يكون نصاً' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  logoUrl?: string;

  @IsOptional()
  @IsString({ message: 'رقم الهاتف يجب أن يكون نصاً' })
  @MaxLength(50, { message: 'رقم الهاتف لا يجب أن يتجاوز 50 حرفاً' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  phone?: string;

  @IsOptional()
  @IsString({ message: 'العنوان يجب أن يكون نصاً' })
  @MaxLength(255, { message: 'العنوان لا يجب أن يتجاوز 255 حرفاً' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  address?: string;

  @IsOptional()
  @IsString({ message: 'العام الدراسي يجب أن يكون نصاً' })
  @MaxLength(50, { message: 'العام الدراسي لا يجب أن يتجاوز 50 حرفاً' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  academicYear?: string;

  @IsOptional()
  @IsString({ message: 'رمز العملة يجب أن يكون نصاً' })
  @MaxLength(20, { message: 'رمز العملة لا يجب أن يتجاوز 20 حرفاً' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  currencySymbol?: string;
}

export class ResetAcademicYearDto {
  @IsString({ message: 'رمز الأمان PIN يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'رمز الأمان PIN إجباري' })
  @Length(6, 6, { message: 'رمز الأمان يجب أن يتكون من 6 أرقام تماماً' })
  @Matches(/^\d{6}$/, { message: 'رمز الأمان يجب أن يتكون من 6 أرقام فقط' })
  pin: string;

  @IsOptional()
  @IsBoolean({ message: 'خيار مسح الطلاب يجب أن يكون قيمة منطقية' })
  @Transform(({ value }: { value: unknown }) =>
    value === true || value === 'true'
      ? true
      : value === false || value === 'false'
        ? false
        : undefined,
  )
  purgeStudents?: boolean = false;

  @IsOptional()
  @IsString({ message: 'العام الدراسي الجديد يجب أن يكون نصاً' })
  @MaxLength(50, { message: 'العام الدراسي الجديد لا يتجاوز 50 حرفاً' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  newAcademicYear?: string;

  @IsOptional()
  @IsString({ message: 'الملاحظات يجب أن تكون نصاً' })
  notes?: string;
}
