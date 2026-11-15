import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { StudentsModule } from '../students/students.module';
import { AttendanceController } from './attendance.controller';
import { AttendanceQrService } from './attendance-qr.service';
import { AttendanceRepository } from './attendance.repository';
import { AttendanceService } from './attendance.service';
import { SessionSheetRepository } from './session-sheet.repository';

@Module({
  imports: [FinanceModule, StudentsModule],
  controllers: [AttendanceController],
  providers: [
    AttendanceRepository,
    SessionSheetRepository,
    AttendanceService,
    AttendanceQrService,
  ],
  exports: [AttendanceService, AttendanceQrService, AttendanceRepository],
})
export class AttendanceModule {}
