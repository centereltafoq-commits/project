import { Body, Controller, ForbiddenException, Get, Patch, Post } from '@nestjs/common';
import { SystemRole } from '@edu-center/shared';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { CloudSyncService } from './cloud-sync.service';
import {
  PullCloudSyncDto,
  PushCloudSyncDto,
  TestCloudSyncConnectionDto,
  UpdateCloudSyncConfigDto,
} from './dto/cloud-sync.dto';

@Controller('backups/cloud-sync')
export class CloudSyncController {
  constructor(private readonly cloudSyncService: CloudSyncService) {}

  private assertStaffAccess(actor: AuthenticatedUser): void {
    if (!actor || actor.roleCode === SystemRole.TEACHER) {
      throw new ForbiddenException('المزامنة السحابية متاحة لطاقم الإدارة والمساعدين فقط');
    }
  }

  @Get('status')
  async getStatus(@CurrentUser() actor: AuthenticatedUser) {
    this.assertStaffAccess(actor);
    return this.cloudSyncService.getStatus(actor);
  }

  @Post('test')
  async testConnection(
    @Body() dto: TestCloudSyncConnectionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    this.assertStaffAccess(actor);
    return this.cloudSyncService.testConnection(dto);
  }

  @Patch('config')
  async saveConfig(
    @Body() dto: UpdateCloudSyncConfigDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    this.assertStaffAccess(actor);
    return this.cloudSyncService.saveConfig(dto, actor);
  }

  @Post('push')
  async pushToCloud(
    @Body() dto: PushCloudSyncDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    this.assertStaffAccess(actor);
    return this.cloudSyncService.pushToCloud(dto, actor);
  }

  @Post('pull')
  async pullFromCloud(
    @Body() dto: PullCloudSyncDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    this.assertStaffAccess(actor);
    return this.cloudSyncService.pullFromCloud(dto, actor);
  }
}
