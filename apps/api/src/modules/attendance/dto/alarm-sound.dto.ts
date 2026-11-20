import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadAlarmSoundDto {
  @IsOptional()
  @IsString({ message: 'اسم الصوت يجب أن يكون نصاً صالحاً' })
  @MaxLength(80, { message: 'اسم الصوت يجب ألا يتجاوز 80 حرفاً' })
  label?: string;
}
