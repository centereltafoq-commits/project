import { Module } from '@nestjs/common';
import { RolesRepository } from './roles.repository';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';

@Module({
  controllers: [RolesController],
  providers: [RolesRepository, RolesService],
  exports: [RolesService, RolesRepository],
})
export class RolesModule {}

