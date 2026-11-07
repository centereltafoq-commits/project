import { IsOptional, IsUUID, Matches } from 'class-validator';

export class CalendarEventsQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'تاريخ البداية يجب أن يكون بصيغة YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'تاريخ النهاية يجب أن يكون بصيغة YYYY-MM-DD' })
  to?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف المدرس غير صالح' })
  teacherId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'معرف القاعة غير صالح' })
  classroomId?: string;
}
