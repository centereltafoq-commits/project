import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class UpdateBackupSettingsDto {
  @IsOptional()
  @IsBoolean({ message: 'حالة النسخ التلقائي يجب أن تكون قيمة منطقية' })
  @Transform(({ value }: { value: unknown }) =>
    value === true || value === 'true'
      ? true
      : value === false || value === 'false'
        ? false
        : undefined,
  )
  autoBackupEnabled?: boolean;

  @IsOptional()
  @IsString({ message: 'توقيت النسخ يجب أن يكون نصاً' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'توقيت النسخ يجب أن يكون بصيغة HH:mm (مثال: 02:00)',
  })
  scheduleTime?: string;

  @IsOptional()
  @IsInt({ message: 'عدد النسخ المحتفظ بها يجب أن يكون رقماً صحيحاً' })
  @Min(1, { message: 'أقل عدد نسخ هو 1' })
  @Max(365, { message: 'أقصى عدد نسخ هو 365' })
  @Transform(({ value }: { value: unknown }) =>
    value !== undefined && value !== null && value !== '' ? Number(value) : undefined,
  )
  retentionCount?: number;

  @IsOptional()
  @IsString({ message: 'المسار المحلي يجب أن يكون نصاً' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : undefined,
  )
  localPath?: string;

  @IsOptional()
  @IsBoolean({ message: 'حالة تفعيل Google Drive يجب أن تكون قيمة منطقية' })
  @Transform(({ value }: { value: unknown }) =>
    value === true || value === 'true'
      ? true
      : value === false || value === 'false'
        ? false
        : undefined,
  )
  googleDriveEnabled?: boolean;
}

export class RestoreBackupDto {
  @IsString({ message: 'كلمة المرور يجب أن تكون نصاً' })
  @IsNotEmpty({ message: 'كلمة مرور المشرف مطلوبة لتأكيد استعادة البيانات' })
  password: string;
}

export class BackupQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value !== undefined && value !== null && value !== '' ? Math.max(1, Number(value)) : 1,
  )
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value !== undefined && value !== null && value !== '' ? Math.max(1, Number(value)) : 25,
  )
  limit?: number = 25;

  @IsOptional()
  @IsString()
  status?: string;
}

