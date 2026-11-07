import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AttendanceStatus } from '@edu-center/shared';

export class AttendanceRecordItemDto {
  @IsUUID('4', { message: 'معرف الطالب غير صالح' })
  studentId: string;

  @IsEnum(AttendanceStatus, { message: 'حالة الحضور غير صالحة' })
  status: AttendanceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RecordSessionAttendanceDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceRecordItemDto)
  records?: AttendanceRecordItemDto[];

  @IsOptional()
  @IsUUID('4', { message: 'معرف الطالب غير صالح' })
  studentId?: string;

  @IsOptional()
  @IsEnum(AttendanceStatus, { message: 'حالة الحضور غير صالحة' })
  status?: AttendanceStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string;
}
