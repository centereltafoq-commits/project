import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { FinanceModule } from '../finance/finance.module';
import { CalendarController } from './calendar.controller';
import { CalendarQuickSessionService } from './calendar-quick-session.service';
import { CalendarRepository } from './calendar.repository';
import { CalendarService } from './calendar.service';

@Module({
  imports: [AttendanceModule, FinanceModule],
  controllers: [CalendarController],
  providers: [CalendarRepository, CalendarService, CalendarQuickSessionService],
  exports: [CalendarService, CalendarQuickSessionService],
})
export class CalendarModule {}
