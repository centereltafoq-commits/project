import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  @MaxLength(160, { message: 'البريد الإلكتروني طويل جداً' })
  email: string;

  @IsString({ message: 'كلمة المرور مطلوبة' })
  @MinLength(1, { message: 'يرجى إدخال كلمة المرور' })
  @MaxLength(100, { message: 'كلمة المرور طويلة جداً' })
  password: string;
}

