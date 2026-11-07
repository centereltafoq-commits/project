import { IsOptional, Matches } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, {
    message: 'صيغة الشهر يجب أن تكون YYYY-MM (مثال: 2026-11)',
  })
  yearMonth?: string;
}
