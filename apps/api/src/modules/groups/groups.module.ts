import { Module } from '@nestjs/common';
import { GroupsRepository } from './groups.repository';
import { GroupsMutationRepository } from './groups-mutation.repository';
import { EnrollmentsRepository } from './enrollments.repository';
import { GroupsService } from './groups.service';
import { EnrollmentsService } from './enrollments.service';
import { GroupsController } from './groups.controller';

@Module({
  controllers: [GroupsController],
  providers: [
    GroupsRepository,
    GroupsMutationRepository,
    EnrollmentsRepository,
    GroupsService,
    EnrollmentsService,
  ],
  exports: [GroupsService, EnrollmentsService, GroupsRepository, EnrollmentsRepository],
})
export class GroupsModule {}
