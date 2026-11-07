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
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
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
  async list(@Query() query: GradeLevelQueryDto) {
    return this.gradeLevelsService.list(query);
  }

  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.gradeLevelsService.getById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.GROUPS_MANAGE)
  async create(@Body() dto: CreateGradeLevelDto) {
    return this.gradeLevelsService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.GROUPS_MANAGE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGradeLevelDto,
  ) {
    return this.gradeLevelsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.GROUPS_MANAGE)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.gradeLevelsService.remove(id);
  }
}
