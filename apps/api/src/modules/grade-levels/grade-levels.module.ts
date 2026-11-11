import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { GradeLevelsController } from './grade-levels.controller';
import { GradeLevelsRepository } from './grade-levels.repository';
import { GradeLevelsService } from './grade-levels.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [GradeLevelsController],
  providers: [GradeLevelsRepository, GradeLevelsService],
  exports: [GradeLevelsService, GradeLevelsRepository],
})
export class GradeLevelsModule {}


