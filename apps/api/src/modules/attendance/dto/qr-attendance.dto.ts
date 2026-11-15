import { IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class QrLookupQueryDto {
  @IsString()
  @MaxLength(120)
  code: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'صيغة تاريخ الجلسة غير صالحة (YYYY-MM-DD)',
  })
  sessionDate?: string;
}

export class QrCheckInDto {
  @IsUUID('4', { message: 'معرف الطالب غير صالح' })
  studentId: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف الحصة غير صالح' })
  sessionId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف المجموعة غير صالح' })
  groupId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'صيغة تاريخ الجلسة غير صالحة (YYYY-MM-DD)',
  })
  sessionDate?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'صيغة وقت البداية غير صالحة (HH:mm)',
  })
  startTime?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'صيغة وقت النهاية غير صالحة (HH:mm)',
  })
  endTime?: string;
}
