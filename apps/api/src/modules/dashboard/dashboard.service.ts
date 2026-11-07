import { Injectable } from '@nestjs/common';
import { CacheService } from '../../common/cache/cache.module';
import { DashboardRepository } from './dashboard.repository';
import { DashboardSummaryResponse } from './dashboard.types';

const DASHBOARD_CACHE_TTL_SECONDS = 30;

@Injectable()
export class DashboardService {
  constructor(
    private readonly dashboardRepo: DashboardRepository,
    private readonly cache: CacheService,
  ) {}

  async getSummary(yearMonth?: string): Promise<DashboardSummaryResponse> {
    const now = new Date();
    const effectiveMonth = yearMonth || this.formatYearMonth(now);
    const todayDate = this.formatIsoDate(now);
    const currentTime = this.formatTimeHHmm(now);
    const timeMinuteBucket = currentTime; // cached for 30s per month

    const cacheKey = `dashboard:summary:${effectiveMonth}:${todayDate}:${timeMinuteBucket.slice(0, 4)}`;
    const cached = await this.cache.get<DashboardSummaryResponse>(cacheKey);
    if (cached) {
      return cached;
    }

    const summary = await this.dashboardRepo.fetchExecutiveSummary(
      effectiveMonth,
      todayDate,
      currentTime,
    );

    await this.cache.set(cacheKey, summary, DASHBOARD_CACHE_TTL_SECONDS);
    return summary;
  }

  private formatYearMonth(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  private formatIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private formatTimeHHmm(date: Date): string {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}
