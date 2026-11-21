import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

export class UpdateCloudSyncConfigDto {
  @IsString({ message: 'رابط مشروع Supabase يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'رابط مشروع Supabase مطلوب' })
  @MaxLength(300, { message: 'رابط مشروع Supabase طويل جداً' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  supabaseUrl!: string;

  @IsOptional()
  @IsString({ message: 'مفتاح Supabase يجب أن يكون نصاً' })
  @MaxLength(1000, { message: 'مفتاح Supabase طويل جداً' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  supabaseKey?: string;

  @IsOptional()
  @IsString({ message: 'اسم الحاوية (Bucket) يجب أن يكون نصاً' })
  @Matches(/^[a-z0-9][a-z0-9-_]{1,61}[a-z0-9]$/, {
    message:
      'اسم الحاوية (Bucket) يجب أن يتكون من أحرف إنجليزية صغيرة أو أرقام أو شرطة (-) فقط',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  bucketName?: string;

  @IsString({ message: 'اسم الجهاز يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'اسم الجهاز مطلوب لتمييز مصدر التعديلات' })
  @MaxLength(100, { message: 'اسم الجهاز طويل جداً' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  deviceName!: string;

  @IsOptional()
  @IsBoolean({ message: 'حالة التفعيل يجب أن تكون قيمة منطقية' })
  @Transform(({ value }: { value: unknown }) => toOptionalBoolean(value))
  enabled?: boolean;
}

export class TestCloudSyncConnectionDto {
  @IsString({ message: 'رابط مشروع Supabase يجب أن يكون نصاً' })
  @IsNotEmpty({ message: 'رابط مشروع Supabase مطلوب' })
  @MaxLength(300, { message: 'رابط مشروع Supabase طويل جداً' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  supabaseUrl!: string;

  @IsOptional()
  @IsString({ message: 'مفتاح Supabase يجب أن يكون نصاً' })
  @MaxLength(1000, { message: 'مفتاح Supabase طويل جداً' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  supabaseKey?: string;

  @IsOptional()
  @IsString({ message: 'اسم الحاوية (Bucket) يجب أن يكون نصاً' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  bucketName?: string;
}

export class PushCloudSyncDto {
  @IsOptional()
  @IsString({ message: 'الملاحظة يجب أن تكون نصاً' })
  @MaxLength(300, { message: 'الملاحظة طويلة جداً (الحد الأقصى 300 حرف)' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  note?: string;

  @IsOptional()
  @IsBoolean({ message: 'قيمة التأكيد الإجباري يجب أن تكون قيمة منطقية' })
  @Transform(({ value }: { value: unknown }) => toOptionalBoolean(value))
  force?: boolean;
}

export class PullCloudSyncDto {
  @IsOptional()
  @IsInt({ message: 'رقم الإصدار يجب أن يكون رقماً صحيحاً' })
  @Min(1, { message: 'رقم الإصدار غير صالح' })
  @Transform(({ value }: { value: unknown }) =>
    value !== undefined && value !== null && value !== '' ? Number(value) : undefined,
  )
  targetVersion?: number;

  @IsOptional()
  @IsBoolean({ message: 'تأكيد الاستبدال يجب أن يكون قيمة منطقية' })
  @Transform(({ value }: { value: unknown }) => toOptionalBoolean(value))
  confirmOverwriteLocalChanges?: boolean;
}
