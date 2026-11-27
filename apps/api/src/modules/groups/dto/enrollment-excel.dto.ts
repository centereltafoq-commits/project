import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { EnrollmentStatus } from '@edu-center/shared';
import type { DuplicateImportStrategy } from '../../../common/excel/excel-import.types';

export class EnrollmentExportQueryDto {
  @IsOptional()
  @IsEnum(EnrollmentStatus, { message: 'حالة الاشتراك غير صالحة' })
  status?: EnrollmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}

export class EnrollmentExcelImportOptionsDto {
  @IsOptional()
  @IsIn(['skip', 'error'])
  duplicateStrategy?: DuplicateImportStrategy = 'skip';

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsUUID('4', { message: 'معرّف المجموعة المنقول منها غير صالح' })
  sourceGroupId?: string;
}

export class EnrollmentExcelCommitDto extends EnrollmentExcelImportOptionsDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  skipInvalidRows?: boolean = false;
}
