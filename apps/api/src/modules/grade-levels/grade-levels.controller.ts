import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PERMISSIONS } from '@edu-center/shared';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import {
  CreateGradeLevelDto,
  GradeLevelQueryDto,
  UpdateGradeLevelDto,
} from './dto/grade-level.dto';
import { GradeLevelsService } from './grade-levels.service';

@Controller('grade-levels')
export class GradeLevelsController {
  constructor(private readonly gradeLevelsService: GradeLevelsService) {}

  @Get()
  @RequireAnyPermissions(
    PERMISSIONS.GROUPS_VIEW,
    PERMISSIONS.GROUPS_MANAGE,
    PERMISSIONS.STUDENTS_VIEW,
    PERMISSIONS.STUDENTS_CREATE,
    PERMISSIONS.STUDENTS_UPDATE,
  )
  async list(@Query() query: GradeLevelQueryDto) {
    return this.gradeLevelsService.list(query);
  }

  @Get(':id')
  @RequireAnyPermissions(
    PERMISSIONS.GROUPS_VIEW,
    PERMISSIONS.GROUPS_MANAGE,
    PERMISSIONS.STUDENTS_VIEW,
    PERMISSIONS.STUDENTS_CREATE,
    PERMISSIONS.STUDENTS_UPDATE,
  )
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.gradeLevelsService.getById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.GROUPS_MANAGE)
  async create(
    @Body() dto: CreateGradeLevelDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.gradeLevelsService.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.GROUPS_MANAGE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGradeLevelDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.gradeLevelsService.update(id, dto, actor);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.GROUPS_MANAGE)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.gradeLevelsService.remove(id, actor);
  }
}


