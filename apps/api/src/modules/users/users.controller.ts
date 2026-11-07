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
  CreateUserDto,
  UpdateUserDto,
  UpdateUserPermissionOverridesDto,
  UserQueryDto,
} from './dto/user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_VIEW)
  async list(@Query() query: UserQueryDto) {
    return this.usersService.list(query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USERS_VIEW)
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.getById(id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  async create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.usersService.create(dto, actor);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.update(id, dto, actor);
  }

  @Put(':id/permissions')
  @RequirePermissions(PERMISSIONS.ROLES_MANAGE)
  async updateOverrides(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserPermissionOverridesDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.usersService.updatePermissionOverrides(id, dto, actor);
  }
}

