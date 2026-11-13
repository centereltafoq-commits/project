import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceRepository } from './attendance.repository';
import { AttendanceService } from './attendance.service';
import { SessionSheetRepository } from './session-sheet.repository';

@Module({
  imports: [FinanceModule],
  controllers: [AttendanceController],
  providers: [
    AttendanceRepository,
    SessionSheetRepository,
    AttendanceService,
  ],
  exports: [AttendanceService, AttendanceRepository],
})
export class AttendanceModule {}
