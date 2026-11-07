import { Module } from '@nestjs/common';
import { GradeLevelsController } from './grade-levels.controller';
import { GradeLevelsRepository } from './grade-levels.repository';
import { GradeLevelsService } from './grade-levels.service';

@Module({
  controllers: [GradeLevelsController],
  providers: [GradeLevelsRepository, GradeLevelsService],
  exports: [GradeLevelsService, GradeLevelsRepository],
})
export class GradeLevelsModule {}
