import { Module } from '@nestjs/common';
import { AssistantsRepository } from './assistants.repository';
import { AssistantsProfileRepository } from './assistants-profile.repository';
import { AssistantsService } from './assistants.service';
import { AssistantsController } from './assistants.controller';

@Module({
  controllers: [AssistantsController],
  providers: [AssistantsRepository, AssistantsProfileRepository, AssistantsService],
  exports: [AssistantsService, AssistantsRepository],
})
export class AssistantsModule {}
