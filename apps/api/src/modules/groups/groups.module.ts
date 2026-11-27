import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { GroupsRepository } from './groups.repository';
import { GroupsMutationRepository } from './groups-mutation.repository';
import { EnrollmentsRepository } from './enrollments.repository';
import { GroupsService } from './groups.service';
import { GroupsExcelService } from './groups-excel.service';
import { GroupEnrollmentsExcelService } from './group-enrollments-excel.service';
import { EnrollmentsService } from './enrollments.service';
import { GroupsController } from './groups.controller';

@Module({
  imports: [FinanceModule],
  controllers: [GroupsController],
  providers: [
    GroupsRepository,
    GroupsMutationRepository,
    EnrollmentsRepository,
    GroupsService,
    GroupsExcelService,
    GroupEnrollmentsExcelService,
    EnrollmentsService,
  ],
  exports: [
    GroupsService,
    GroupsExcelService,
    GroupEnrollmentsExcelService,
    EnrollmentsService,
    GroupsRepository,
    EnrollmentsRepository,
  ],
})
export class GroupsModule {}
