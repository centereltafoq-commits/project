import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PERMISSIONS } from '@edu-center/shared';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  AssistantProfileQueryDto,
  AssistantQueryDto,
  CreateAssistantDto,
  UpdateAssistantDto,
} from './dto/assistant.dto';
import { AssistantsService } from './assistants.service';

@Controller('assistants')
export class AssistantsController {
  constructor(private readonly assistantsService: AssistantsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.ASSISTANTS_VIEW)
  async list(@Query() query: AssistantQueryDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.assistantsService.list(query, actor);
  }

  @Get(':id/profile')
  @RequirePermissions(PERMISSIONS.ASSISTANTS_VIEW)
  async getProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AssistantProfileQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.assistantsService.getProfile(id, query.yearMonth, actor);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ASSISTANTS_VIEW)
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.assistantsService.getById(id, actor);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ASSISTANTS_MANAGE)
  async create(@Body() dto: CreateAssistantDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.assistantsService.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.ASSISTANTS_MANAGE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssistantDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.assistantsService.update(id, dto, actor);
  }
}
