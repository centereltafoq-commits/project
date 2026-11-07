import { Module } from '@nestjs/common';
import { ClassroomsRepository } from './classrooms.repository';
import { ClassroomsAvailabilityRepository } from './classrooms-availability.repository';
import { ClassroomsService } from './classrooms.service';
import { ClassroomsController } from './classrooms.controller';

@Module({
  controllers: [ClassroomsController],
  providers: [ClassroomsRepository, ClassroomsAvailabilityRepository, ClassroomsService],
  exports: [ClassroomsService, ClassroomsRepository, ClassroomsAvailabilityRepository],
})
export class ClassroomsModule {}
