import { Injectable } from '@nestjs/common';
import { PERMISSIONS, SystemRole } from '@edu-center/shared';
import { CacheService } from '../../common/cache/cache.module';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { DashboardRepository } from './dashboard.repository';
import { DashboardSummaryResponse } from './dashboard.types';

const DASHBOARD_CACHE_TTL_SECONDS = 30;

@Injectable()
export class DashboardService {
  constructor(
    private readonly dashboardRepo: DashboardRepository,
    private readonly cache: CacheService,
  ) {}

  async getSummary(yearMonth?: string, actor?: AuthenticatedUser): Promise<DashboardSummaryResponse> {
    const now = new Date();
    const effectiveMonth = yearMonth || this.formatYearMonth(now);
    const todayDate = this.formatIsoDate(now);
    const currentTime = this.formatTimeHHmm(now);
    const timeMinuteBucket = currentTime; // cached for 30s per month

    const cacheKey = `dashboard:summary:${effectiveMonth}:${todayDate}:${timeMinuteBucket.slice(0, 4)}`;
    let summary = await this.cache.get<DashboardSummaryResponse>(cacheKey);
    if (!summary) {
      summary = await this.dashboardRepo.fetchExecutiveSummary(
        effectiveMonth,
        todayDate,
        currentTime,
      );
      await this.cache.set(cacheKey, summary, DASHBOARD_CACHE_TTL_SECONDS);
    }

    const isOwner = !actor || actor.roleCode === SystemRole.OWNER;
    const perms = actor?.permissions ?? [];
    const canViewFullFinance = isOwner || perms.includes(PERMISSIONS.FINANCE_VIEW);
    const canViewCollections =
      canViewFullFinance || perms.includes(PERMISSIONS.FINANCE_COLLECT_PAYMENT);
    const canViewClassrooms = isOwner || perms.includes(PERMISSIONS.CLASSROOMS_VIEW);
    const canViewAttendance =
      isOwner ||
      perms.includes(PERMISSIONS.ATTENDANCE_VIEW) ||
      perms.includes(PERMISSIONS.SESSIONS_VIEW);
    const canViewSessionProgress =
      canViewAttendance ||
      perms.includes(PERMISSIONS.STUDENTS_VIEW) ||
      perms.includes(PERMISSIONS.GROUPS_VIEW);

    if (canViewFullFinance && canViewClassrooms && canViewAttendance && canViewSessionProgress) {
      return summary;
    }

    const emptySessionProgress = {
      totalTrackedEnrollments: 0,
      nearLastTotalCount: 0,
      lastOrCompletedTotalCount: 0,
      inProgressTotalCount: 0,
      notStartedTotalCount: 0,
      tracks: [],
      students: [],
    };

    const sanitizedSessionProgress = !canViewSessionProgress
      ? emptySessionProgress
      : canViewCollections
        ? summary.monthlySessionProgress
        : {
            ...summary.monthlySessionProgress,
            students: summary.monthlySessionProgress.students.map((item) => ({
              ...item,
              remainingBalance: 0,
            })),
          };

    return {
      ...summary,
      monthlySessionProgress: sanitizedSessionProgress,
      ...(canViewAttendance ? {} : { todaySessions: [] }),
      ...(canViewClassrooms
        ? {}
        : {
            classroomsSummary: {
              total: 0,
              availableNow: 0,
              occupiedNow: 0,
              maintenance: 0,
            },
            classroomsLive: [],
          }),
      ...(canViewCollections
        ? {}
        : {
            monthlySessionsStats: {
              ...summary.monthlySessionsStats,
              totalBillableSessions: 0,
              totalPaidSessions: 0,
              totalUnpaidSessions: 0,
              collectionRateSessions: 0,
            },
            monthlyPaymentStats: {
              paidStudentsCount: 0,
              unpaidStudentsCount: 0,
              totalBilledStudentsCount: 0,
              paidGroupsCount: 0,
              unpaidGroupsCount: 0,
              totalBilledGroupsCount: 0,
            },
            totalRevenue: 0,
            totalCollectedPayments: 0,
            todayCollectedPayments: 0,
            todayPaymentsCount: 0,
            totalReceivables: 0,
          }),
      ...(canViewFullFinance
        ? {}
        : {
            totalTeacherDues: 0,
            totalAssistantDues: 0,
            totalTeacherPaidOut: 0,
            totalAssistantPaidOut: 0,
            totalExpenses: 0,
            netCenterResult: 0,
            netCashFlow: 0,
          }),
    };
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
