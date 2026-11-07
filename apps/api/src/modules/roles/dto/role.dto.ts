import { IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  code: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nameAr: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsArray()
  @IsString({ each: true })
  permissionCodes: string[];
}

export class UpdateRolePermissionsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nameAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsArray()
  @IsString({ each: true })
  permissionCodes: string[];
}

