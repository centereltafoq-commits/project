import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class UserQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsString()
  isActive?: string;
}

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName: string;

  @IsString({ message: 'رقم الهاتف مطلوب' })
  @MinLength(8, { message: 'رقم الهاتف يجب ألا يقل عن 8 أرقام' })
  @MaxLength(30, { message: 'رقم الهاتف طويل جداً' })
  phone: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value?.trim(),
  )
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  @MaxLength(160)
  email?: string;

  @IsString()
  @MinLength(8, { message: 'كلمة المرور يجب ألا تقل عن 8 أحرف' })
  @MaxLength(100)
  password: string;

  @IsUUID()
  roleId: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName?: string;

  @IsOptional()
  @IsString({ message: 'رقم الهاتف غير صالح' })
  @MinLength(8, { message: 'رقم الهاتف يجب ألا يقل عن 8 أرقام' })
  @MaxLength(30, { message: 'رقم الهاتف طويل جداً' })
  phone?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? null : value?.trim(),
  )
  @IsEmail({}, { message: 'البريد الإلكتروني غير صالح' })
  @MaxLength(160)
  email?: string | null;

  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsString()
  @MinLength(8, { message: 'كلمة المرور يجب ألا تقل عن 8 أحرف' })
  @MaxLength(100)
  password?: string;
}

export class UserPermissionOverrideItemDto {
  @IsString()
  permissionCode: string;

  @IsBoolean()
  isGranted: boolean;
}

export class UpdateUserPermissionOverridesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserPermissionOverrideItemDto)
  overrides: UserPermissionOverrideItemDto[];
}

