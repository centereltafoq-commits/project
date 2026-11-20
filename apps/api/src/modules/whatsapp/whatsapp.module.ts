import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappTemplatesService } from './whatsapp-templates.service';

@Module({
  controllers: [WhatsappController],
  providers: [WhatsappTemplatesService],
  exports: [WhatsappTemplatesService],
})
export class WhatsappModule {}
