import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export const WHATSAPP_TEMPLATE_CATEGORIES = [
  'SUBSCRIPTION',
  'ABSENCE',
  'ATTENDANCE',
  'SCHEDULE',
  'GENERAL',
] as const;

export type WhatsappTemplateCategory = (typeof WHATSAPP_TEMPLATE_CATEGORIES)[number];

export class CreateWhatsappTemplateDto {
  @IsString({ message: 'عنوان القالب مطلوب' })
  @MinLength(2, { message: 'عنوان القالب يجب ألا يقل عن حرفين' })
  @MaxLength(80, { message: 'عنوان القالب يجب ألا يتجاوز 80 حرفاً' })
  title: string;

  @IsOptional()
  @IsIn(WHATSAPP_TEMPLATE_CATEGORIES, { message: 'تصنيف القالب غير صالح' })
  category?: WhatsappTemplateCategory;

  @IsString({ message: 'نص الرسالة مطلوب' })
  @MinLength(2, { message: 'نص الرسالة يجب ألا يقل عن حرفين' })
  @MaxLength(2000, { message: 'نص الرسالة يجب ألا يتجاوز 2000 حرف' })
  content: string;

  @IsOptional()
  @IsBoolean({ message: 'قيمة القالب الافتراضي غير صالحة' })
  isDefault?: boolean;
}

export class UpdateWhatsappTemplateDto {
  @IsOptional()
  @IsString({ message: 'عنوان القالب غير صالح' })
  @MinLength(2, { message: 'عنوان القالب يجب ألا يقل عن حرفين' })
  @MaxLength(80, { message: 'عنوان القالب يجب ألا يتجاوز 80 حرفاً' })
  title?: string;

  @IsOptional()
  @IsIn(WHATSAPP_TEMPLATE_CATEGORIES, { message: 'تصنيف القالب غير صالح' })
  category?: WhatsappTemplateCategory;

  @IsOptional()
  @IsString({ message: 'نص الرسالة غير صالح' })
  @MinLength(2, { message: 'نص الرسالة يجب ألا يقل عن حرفين' })
  @MaxLength(2000, { message: 'نص الرسالة يجب ألا يتجاوز 2000 حرف' })
  content?: string;

  @IsOptional()
  @IsBoolean({ message: 'قيمة القالب الافتراضي غير صالحة' })
  isDefault?: boolean;
}
