import { IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class LoginDto {
  @ValidateIf((o) => !o.email)
  @IsString({ message: 'يرجى إدخال رقم الهاتف' })
  @MinLength(3, { message: 'رقم الهاتف غير صالح' })
  @MaxLength(160, { message: 'رقم الهاتف طويل جداً' })
  phone?: string;

  @IsOptional()
  @IsString({ message: 'البريد الإلكتروني غير صالح' })
  @MaxLength(160, { message: 'البريد الإلكتروني طويل جداً' })
  email?: string;

  @IsString({ message: 'كلمة المرور مطلوبة' })
  @MinLength(1, { message: 'يرجى إدخال كلمة المرور' })
  @MaxLength(100, { message: 'كلمة المرور طويلة جداً' })
  password: string;
}

