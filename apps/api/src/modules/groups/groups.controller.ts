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
import { CreateGroupDto, GroupQueryDto, UpdateGroupDto } from './dto/group.dto';
import {
  CreateEnrollmentDto,
  EnrollmentQueryDto,
  UpdateEnrollmentDto,
} from './dto/enrollment.dto';
import { GroupsService } from './groups.service';
import { EnrollmentsService } from './enrollments.service';

@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly enrollmentsService: EnrollmentsService,
  ) {}

  @Get()
  @RequirePermissions(PERMISSIONS.GROUPS_VIEW)
  async list(@Query() query: GroupQueryDto) {
    return this.groupsService.list(query);
  }

  @Patch('enrollments/:enrollmentId')
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_MANAGE)
  async updateEnrollment(
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Body() dto: UpdateEnrollmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.enrollmentsService.updateEnrollment(enrollmentId, dto, actor);
  }

  @Get(':groupId/enrollments')
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_VIEW)
  async listEnrollments(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query() query: EnrollmentQueryDto,
  ) {
    return this.enrollmentsService.listEnrollments(groupId, query);
  }

  @Post(':groupId/enrollments')
  @RequirePermissions(PERMISSIONS.ENROLLMENTS_MANAGE)
  async subscribeStudent(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: CreateEnrollmentDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.enrollmentsService.subscribeStudent(groupId, dto, actor);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.GROUPS_VIEW)
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.groupsService.getById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.GROUPS_MANAGE)
  async create(@Body() dto: CreateGroupDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.groupsService.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.GROUPS_MANAGE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGroupDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.groupsService.update(id, dto, actor);
  }
}
