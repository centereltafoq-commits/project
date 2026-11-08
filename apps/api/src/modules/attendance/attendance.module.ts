import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceRepository } from './attendance.repository';
import { AttendanceService } from './attendance.service';
import { MakeupsRepository } from './makeups.repository';
import { MakeupsService } from './makeups.service';
import { SessionSheetRepository } from './session-sheet.repository';

@Module({
  imports: [FinanceModule],
  controllers: [AttendanceController],
  providers: [
    AttendanceRepository,
    SessionSheetRepository,
    MakeupsRepository,
    AttendanceService,
    MakeupsService,
  ],
  exports: [AttendanceService, MakeupsService, AttendanceRepository, MakeupsRepository],
})
export class AttendanceModule {}
