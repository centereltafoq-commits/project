import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  registerDecorator,
  ValidateIf,
  ValidationOptions,
} from 'class-validator';

const ACADEMIC_YEAR_REGEX = /^(\d{4})\s*[\/\-]\s*(\d{4})$/;

function normalizeAcademicYearValue(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  const match = ACADEMIC_YEAR_REGEX.exec(trimmed);
  return match ? `${match[1]} / ${match[2]}` : trimmed;
}

function IsSequentialAcademicYear(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isSequentialAcademicYear',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return false;
          const match = ACADEMIC_YEAR_REGEX.exec(value.trim());
          if (!match) return false;
          const startYear = Number(match[1]);
          const endYear = Number(match[2]);
          return (
            startYear >= 2000 &&
            startYear <= 2099 &&
            endYear === startYear + 1
          );
        },
      },
    });
  };
}

export class UpdateSettingsDto {
  @IsOptional()
  @IsNotEmpty({ message: 'اسم السنتر لا يمكن أن يكون فارغاً' })
  @IsString({ message: 'اسم السنتر يجب أن يكون نصاً' })
  @MaxLength(200, { message: 'اسم السنتر لا يجب أن يتجاوز 200 حرف' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  centerName?: string;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsString({ message: 'الوصف الفرعي يجب أن يكون نصاً' })
  @MaxLength(255, { message: 'الوصف لا يجب أن يتجاوز 255 حرف' })
  @Transform(({ value }: { value: unknown }) =>
    value === '' || value === null
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  centerSubtitle?: string | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsString({ message: 'رابط الشعار يجب أن يكون نصاً' })
  @MaxLength(500, { message: 'رابط الشعار لا يجب أن يتجاوز 500 حرف' })
  @Matches(/^(https?:\/\/[^\s]+|\/api\/settings\/logo\/[^\s]+)$/i, {
    message: 'رابط الشعار غير صالح، يجب أن يبدأ بـ http:// أو https:// أو مسار شعار النظام',
  })
  @Transform(({ value }: { value: unknown }) =>
    value === '' || value === null
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  logoUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsString({ message: 'رقم الهاتف يجب أن يكون نصاً' })
  @MaxLength(50, { message: 'رقم الهاتف لا يجب أن يتجاوز 50 حرفاً' })
  @Matches(/^(?=(?:.*\d){7,15})[+\d\s\-()]{7,20}$/, {
    message: 'رقم الهاتف غير صالح، يجب أن يحتوي على أرقام صالحة (7 إلى 15 رقماً)',
  })
  @Transform(({ value }: { value: unknown }) =>
    value === '' || value === null
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  phone?: string | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null && val !== undefined)
  @IsString({ message: 'العنوان يجب أن يكون نصاً' })
  @MaxLength(255, { message: 'العنوان لا يجب أن يتجاوز 255 حرفاً' })
  @Transform(({ value }: { value: unknown }) =>
    value === '' || value === null
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  address?: string | null;

  @IsOptional()
  @IsNotEmpty({ message: 'العام الدراسي لا يمكن أن يكون فارغاً' })
  @IsString({ message: 'العام الدراسي يجب أن يكون نصاً' })
  @MaxLength(50, { message: 'العام الدراسي لا يجب أن يتجاوز 50 حرفاً' })
  @IsSequentialAcademicYear({
    message: 'صيغة العام الدراسي غير صالحة، يجب أن تكون عامين متتاليين مثل: 2026 / 2027',
  })
  @Transform(({ value }: { value: unknown }) => normalizeAcademicYearValue(value))
  academicYear?: string;

  @IsOptional()
  @IsNotEmpty({ message: 'رمز العملة لا يمكن أن يكون فارغاً' })
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
  @ValidateIf((_, val) => val !== undefined && val !== '')
  @IsString({ message: 'العام الدراسي الجديد يجب أن يكون نصاً' })
  @MaxLength(50, { message: 'العام الدراسي الجديد لا يتجاوز 50 حرفاً' })
  @IsSequentialAcademicYear({
    message: 'صيغة العام الدراسي الجديد غير صالحة، يجب أن تكون مثل: 2027 / 2028',
  })
  @Transform(({ value }: { value: unknown }) =>
    value === '' ? undefined : normalizeAcademicYearValue(value),
  )
  newAcademicYear?: string;

  @IsOptional()
  @IsString({ message: 'الملاحظات يجب أن تكون نصاً' })
  notes?: string;
}
