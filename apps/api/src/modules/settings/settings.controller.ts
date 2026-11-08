import * as fs from 'fs';
import * as path from 'path';
import { Response } from 'express';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Put,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PERMISSIONS, SystemRole } from '@edu-center/shared';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UploadedMulterFile } from '../../common/types/multer.types';
import { ResetAcademicYearDto, UpdateSettingsDto } from './dto/settings.dto';
import { SettingsService } from './settings.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get()
  async getSettings() {
    return this.settingsService.getSettings();
  }

  @Public()
  @Get('logo/:filename')
  async getLogoFile(@Param('filename') filename: string, @Res() res: Response) {
    const safeFilename = path.basename(filename);
    const filePath = path.resolve(
      this.settingsService.getLogoStorageDir(),
      safeFilename,
    );
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('صورة الشعار غير موجودة');
    }

    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    return res.sendFile(filePath);
  }

  @Put()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.OWNER)
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  async updateSettings(
    @Body() dto: UpdateSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.updateSettings(dto, user?.id);
  }

  @Post('logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.OWNER)
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadLogo(
    @UploadedFile() file: UploadedMulterFile,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) {
      throw new BadRequestException('يرجى اختيار ملف الصورة لرفعه');
    }
    return this.settingsService.uploadLogo(file, user?.id);
  }

  @Delete('logo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.OWNER)
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  async removeLogo(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.removeLogo(user?.id);
  }

  @Post('reset-academic-year')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(SystemRole.OWNER)
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  async resetAcademicYear(
    @Body() dto: ResetAcademicYearDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.resetAcademicYear(dto, user?.id);
  }
}
