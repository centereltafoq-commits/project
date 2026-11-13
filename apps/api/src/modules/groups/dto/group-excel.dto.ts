import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { DuplicateImportStrategy } from '../../../common/excel/excel-import.types';

export class GroupExcelImportOptionsDto {
  @IsOptional()
  @IsIn(['skip', 'error'])
  duplicateStrategy?: DuplicateImportStrategy = 'skip';
}

export class GroupExcelCommitDto extends GroupExcelImportOptionsDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  skipInvalidRows?: boolean = false;
}

export class GroupExportQueryDto {
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

  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;
}

