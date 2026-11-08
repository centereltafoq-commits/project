import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { PERMISSIONS } from '@edu-center/shared';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../common/decorators/permissions.decorator';
import { CreateRoleDto, UpdateRolePermissionsDto } from './dto/role.dto';
import { RolesService } from './roles.service';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequireAnyPermissions(
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.ROLES_MANAGE,
  )
  async listRoles() {
    return this.rolesService.listRoles();
  }

  @Get('permissions')
  @RequireAnyPermissions(PERMISSIONS.USERS_VIEW, PERMISSIONS.ROLES_MANAGE)
  async listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  async createRole(@Body() dto: CreateRoleDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.rolesService.createRole(dto, actor);
  }

  @Put(':id/permissions')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  async updatePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.rolesService.updateRolePermissions(id, dto, actor);
  }
}

