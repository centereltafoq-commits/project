import { Module } from '@nestjs/common';
import { StudentsRepository } from './students.repository';
import { StudentsProfileRepository } from './students-profile.repository';
import { StudentsService } from './students.service';
import { StudentsController } from './students.controller';

@Module({
  controllers: [StudentsController],
  providers: [StudentsRepository, StudentsProfileRepository, StudentsService],
  exports: [StudentsService, StudentsRepository],
})
export class StudentsModule {}
