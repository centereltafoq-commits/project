import { Module } from '@nestjs/common';
import { TeachersRepository } from './teachers.repository';
import { TeachersProfileRepository } from './teachers-profile.repository';
import { TeachersService } from './teachers.service';
import { TeachersController } from './teachers.controller';

@Module({
  controllers: [TeachersController],
  providers: [TeachersRepository, TeachersProfileRepository, TeachersService],
  exports: [TeachersService, TeachersRepository],
})
export class TeachersModule {}
