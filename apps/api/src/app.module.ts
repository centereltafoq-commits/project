import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateAndLoadEnv } from './config/env.config';
import { DatabaseModule } from './database/database.module';
import { AppCacheModule } from './common/cache/cache.module';
import { LoggerModule } from './common/logger/app-logger.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { Public } from './common/decorators/public.decorator';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { StudentsModule } from './modules/students/students.module';
import { TeachersModule } from './modules/teachers/teachers.module';
import { AssistantsModule } from './modules/assistants/assistants.module';
import { ClassroomsModule } from './modules/classrooms/classrooms.module';
import { GroupsModule } from './modules/groups/groups.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { FinanceModule } from './modules/finance/finance.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ReportsModule } from './modules/reports/reports.module';
import { GradeLevelsModule } from './modules/grade-levels/grade-levels.module';
import { BackupsModule } from './modules/backups/backups.module';

@Controller('health')
class HealthController {
  @Public()
  @Get()
  check() {
    return { status: 'ok', service: 'edu-center-erp-api', timestamp: new Date().toISOString() };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [() => validateAndLoadEnv(process.env)],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('rateLimitTtlMs') || 60000,
          limit: config.get<number>('rateLimitMax') || 180,
        },
      ],
    }),
    LoggerModule,
    DatabaseModule,
    AppCacheModule,
    AuditLogsModule,
    RolesModule,
    UsersModule,
    AuthModule,
    StudentsModule,
    TeachersModule,
    AssistantsModule,
    ClassroomsModule,
    GroupsModule,
    AttendanceModule,
    BookingsModule,
    CalendarModule,
    FinanceModule,
    DashboardModule,
    ReportsModule,
    GradeLevelsModule,
    BackupsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
