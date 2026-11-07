import * as fs from 'fs';
import { Response } from 'express';
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { PERMISSIONS } from '@edu-center/shared';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { BackupsService } from './backups.service';
import {
  BackupQueryDto,
  RestoreBackupDto,
  UpdateBackupSettingsDto,
} from './dto/backup.dto';

@Controller('backups')
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  @Get('settings')
  @RequirePermissions(PERMISSIONS.BACKUPS_VIEW)
  async getSettings() {
    return this.backupsService.getSettings();
  }

  @Patch('settings')
  @RequirePermissions(PERMISSIONS.BACKUPS_MANAGE)
  async updateSettings(@Body() dto: UpdateBackupSettingsDto) {
    return this.backupsService.updateSettings(dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.BACKUPS_VIEW)
  async list(@Query() query: BackupQueryDto) {
    return this.backupsService.listRecords(query);
  }

  @Post('trigger')
  @RequirePermissions(PERMISSIONS.BACKUPS_MANAGE)
  async triggerManualBackup() {
    return this.backupsService.createBackup('MANUAL');
  }

  @Get(':id/download')
  @RequirePermissions(PERMISSIONS.BACKUPS_MANAGE)
  async downloadFile(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const record = await this.backupsService.getRecordById(id);
    if (!fs.existsSync(record.filePath)) {
      throw new NotFoundException('ملف النسخة الاحتياطية غير موجود على القرص الصلب');
    }

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${record.fileName}"`,
    );
    res.setHeader('Content-Length', record.fileSizeBytes);

    const stream = fs.createReadStream(record.filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).json({ message: 'فشل في قراءة ملف النسخة الاحتياطية' });
      }
    });
    res.on('close', () => {
      stream.destroy();
    });
    stream.pipe(res);
  }

  @Post(':id/restore')
  @RequirePermissions(PERMISSIONS.BACKUPS_MANAGE)
  async restoreBackup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RestoreBackupDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.backupsService.restoreBackup(id, dto.password, actor.id);
  }

  @Delete('google/disconnect')
  @RequirePermissions(PERMISSIONS.BACKUPS_MANAGE)
  async disconnectGoogle() {
    return this.backupsService.disconnectGoogle();
  }
}

