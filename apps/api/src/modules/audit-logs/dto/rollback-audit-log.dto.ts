import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RollbackAuditLogDto {
  @IsOptional()
  @IsString({ message: 'سبب التراجع يجب أن يكون نصاً صالحاً' })
  @MaxLength(300, { message: 'سبب التراجع يجب ألا يتجاوز 300 حرف' })
  reason?: string;
}
