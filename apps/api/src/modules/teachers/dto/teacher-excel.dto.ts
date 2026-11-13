import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { TeacherEmploymentStatus } from '@edu-center/shared';
import type { DuplicateImportStrategy } from '../../../common/excel/excel-import.types';

export class TeacherExcelImportOptionsDto {
  @IsOptional()
  @IsIn(['skip', 'error'])
  duplicateStrategy?: DuplicateImportStrategy = 'skip';
}

export class TeacherExcelCommitDto extends TeacherExcelImportOptionsDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  skipInvalidRows?: boolean = false;
}

export class TeacherExportQueryDto {
  @IsOptional()
  @IsEnum(TeacherEmploymentStatus)
  employmentStatus?: TeacherEmploymentStatus;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

