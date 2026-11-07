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
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  AvailableClassroomsQueryDto,
  ClassroomQueryDto,
  ClassroomScheduleQueryDto,
  CreateClassroomDto,
  CreateMaintenanceDto,
  UpdateClassroomDto,
} from './dto/classroom.dto';
import { ClassroomsService } from './classrooms.service';

@Controller('classrooms')
export class ClassroomsController {
  constructor(private readonly classroomsService: ClassroomsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.CLASSROOMS_VIEW)
  async list(@Query() query: ClassroomQueryDto) {
    return this.classroomsService.list(query);
  }

  @Get('available')
  @RequirePermissions(PERMISSIONS.CLASSROOMS_VIEW)
  async findAvailable(@Query() query: AvailableClassroomsQueryDto) {
    return this.classroomsService.findAvailable(query);
  }

  @Delete('maintenances/:maintId')
  @RequirePermissions(PERMISSIONS.CLASSROOMS_MANAGE)
  async removeMaintenance(
    @Param('maintId', ParseUUIDPipe) maintId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.classroomsService.removeMaintenance(maintId, actor);
  }

  @Get(':id/schedule')
  @RequirePermissions(PERMISSIONS.CLASSROOMS_VIEW)
  async getSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ClassroomScheduleQueryDto,
  ) {
    return this.classroomsService.getSchedule(id, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CLASSROOMS_VIEW)
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.classroomsService.getById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.CLASSROOMS_MANAGE)
  async create(@Body() dto: CreateClassroomDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.classroomsService.create(dto, actor);
  }

  @Post(':id/maintenances')
  @RequirePermissions(PERMISSIONS.CLASSROOMS_MANAGE)
  async addMaintenance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMaintenanceDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.classroomsService.addMaintenance(id, dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.CLASSROOMS_MANAGE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassroomDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.classroomsService.update(id, dto, actor);
  }
}
