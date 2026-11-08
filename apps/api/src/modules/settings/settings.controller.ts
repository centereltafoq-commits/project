import { Body, Controller, Get, Put, Post } from '@nestjs/common';
import { PERMISSIONS } from '@edu-center/shared';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ResetAcademicYearDto, UpdateSettingsDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Put()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  async updateSettings(
    @Body() dto: UpdateSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.updateSettings(dto, user?.id);
  }

  @Post('reset-academic-year')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  async resetAcademicYear(
    @Body() dto: ResetAcademicYearDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.resetAcademicYear(dto, user?.id);
  }
}
