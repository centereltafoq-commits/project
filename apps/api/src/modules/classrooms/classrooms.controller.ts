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
  AllocateGroupToClassroomDto,
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

  @Get('unallocated-groups')
  @RequirePermissions(PERMISSIONS.CLASSROOMS_VIEW)
  async getUnallocatedGroups(@Query('includeAll') includeAll?: string) {
    return this.classroomsService.getUnallocatedGroups(includeAll === 'true');
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

  @Get(':id/allocated-groups')
  @RequirePermissions(PERMISSIONS.CLASSROOMS_VIEW)
  async getAllocatedGroups(@Param('id', ParseUUIDPipe) id: string) {
    return this.classroomsService.getAllocatedGroups(id);
  }

  @Post(':id/allocate-group')
  @RequirePermissions(PERMISSIONS.CLASSROOMS_MANAGE)
  async allocateGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AllocateGroupToClassroomDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.classroomsService.allocateGroup(id, dto, actor);
  }

  @Delete(':id/allocate-group/:groupId')
  @RequirePermissions(PERMISSIONS.CLASSROOMS_MANAGE)
  async releaseGroup(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.classroomsService.releaseGroup(id, groupId, actor);
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
