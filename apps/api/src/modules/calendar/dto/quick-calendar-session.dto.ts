import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export class QuickCalendarSessionDto {
  @IsOptional()
  @IsUUID('4', { message: 'معرف الحصة غير صالح' })
  sessionId?: string | null;

  @IsUUID('4', { message: 'معرف المجموعة مطلوب وغير صالح' })
  groupId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'تاريخ الحصة يجب أن يكون بصيغة YYYY-MM-DD',
  })
  sessionDate!: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'وقت البداية يجب أن يكون بصيغة HH:mm',
  })
  startTime!: string;

  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'وقت النهاية يجب أن يكون بصيغة HH:mm',
  })
  endTime!: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف القاعة غير صالح' })
  classroomId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  topic?: string | null;

  @IsOptional()
  @IsBoolean()
  pinToGroupSchedule?: boolean;

  @IsOptional()
  @IsBoolean()
  completeGroupAttendance?: boolean;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'وقت البداية الأصلي غير صالح',
  })
  originalSlotStartTime?: string | null;
}
