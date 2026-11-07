import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { PERMISSIONS } from '@edu-center/shared';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  CreateTeacherDto,
  TeacherProfileQueryDto,
  TeacherQueryDto,
  UpdateTeacherAvailabilityDto,
  UpdateTeacherDto,
} from './dto/teacher.dto';
import { TeachersService } from './teachers.service';

@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachersService: TeachersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.TEACHERS_VIEW)
  async list(@Query() query: TeacherQueryDto) {
    return this.teachersService.list(query);
  }

  @Get('me/profile')
  @RequirePermissions(PERMISSIONS.TEACHERS_VIEW_OWN)
  async getOwnProfile(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: TeacherProfileQueryDto,
  ) {
    return this.teachersService.getOwnProfile(actor.id, query.yearMonth);
  }

  @Get(':id/profile')
  @RequirePermissions(PERMISSIONS.TEACHERS_VIEW)
  async getProfile(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: TeacherProfileQueryDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.teachersService.getProfile(id, query.yearMonth, actor);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.TEACHERS_VIEW)
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.teachersService.getById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.TEACHERS_MANAGE)
  async create(@Body() dto: CreateTeacherDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.teachersService.create(dto, actor);
  }

  @Put(':id/availability')
  @RequirePermissions(PERMISSIONS.TEACHERS_MANAGE)
  async updateAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeacherAvailabilityDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.teachersService.updateAvailability(id, dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.TEACHERS_MANAGE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeacherDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.teachersService.update(id, dto, actor);
  }
}
