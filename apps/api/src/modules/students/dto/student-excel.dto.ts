import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { StudentStatus } from '@edu-center/shared';
import type { DuplicateImportStrategy } from '../../../common/excel/excel-import.types';

export class StudentExcelImportOptionsDto {
  @IsOptional()
  @IsIn(['skip', 'error'])
  duplicateStrategy?: DuplicateImportStrategy = 'skip';
}

export class StudentExcelCommitDto extends StudentExcelImportOptionsDto {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  skipInvalidRows?: boolean = false;
}

export class StudentExportQueryDto {
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsString()
  gradeLevel?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

