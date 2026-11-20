import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { PERMISSIONS } from '@edu-center/shared';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireAnyPermissions } from '../../common/decorators/permissions.decorator';
import {
  CreateWhatsappTemplateDto,
  UpdateWhatsappTemplateDto,
} from './dto/whatsapp-template.dto';
import { WhatsappTemplatesService } from './whatsapp-templates.service';

@Controller('whatsapp/templates')
export class WhatsappController {
  constructor(private readonly templatesService: WhatsappTemplatesService) {}

  @Get()
  @RequireAnyPermissions(
    PERMISSIONS.STUDENTS_VIEW,
    PERMISSIONS.GROUPS_VIEW,
    PERMISSIONS.ATTENDANCE_VIEW,
    PERMISSIONS.FINANCE_VIEW,
  )
  async listTemplates() {
    return this.templatesService.listTemplates();
  }

  @Post('reset-defaults')
  @RequireAnyPermissions(PERMISSIONS.GROUPS_MANAGE, PERMISSIONS.SETTINGS_MANAGE)
  async resetDefaults(@CurrentUser() actor: AuthenticatedUser) {
    return this.templatesService.resetDefaults(actor);
  }

  @Post()
  @RequireAnyPermissions(
    PERMISSIONS.STUDENTS_UPDATE,
    PERMISSIONS.GROUPS_MANAGE,
    PERMISSIONS.ATTENDANCE_RECORD,
    PERMISSIONS.SETTINGS_MANAGE,
  )
  async createTemplate(
    @Body() dto: CreateWhatsappTemplateDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.templatesService.createTemplate(dto, actor);
  }

  @Patch(':id')
  @RequireAnyPermissions(
    PERMISSIONS.STUDENTS_UPDATE,
    PERMISSIONS.GROUPS_MANAGE,
    PERMISSIONS.ATTENDANCE_RECORD,
    PERMISSIONS.SETTINGS_MANAGE,
  )
  async updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateWhatsappTemplateDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.templatesService.updateTemplate(id, dto, actor);
  }

  @Delete(':id')
  @RequireAnyPermissions(
    PERMISSIONS.STUDENTS_UPDATE,
    PERMISSIONS.GROUPS_MANAGE,
    PERMISSIONS.ATTENDANCE_RECORD,
    PERMISSIONS.SETTINGS_MANAGE,
  )
  async deleteTemplate(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.templatesService.deleteTemplate(id, actor);
  }
}
