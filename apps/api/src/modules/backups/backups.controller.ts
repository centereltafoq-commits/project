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
@RequirePermissions(PERMISSIONS.USERS_MANAGE)
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  @Get('settings')
  async getSettings() {
    return this.backupsService.getSettings();
  }

  @Patch('settings')
  async updateSettings(@Body() dto: UpdateBackupSettingsDto) {
    return this.backupsService.updateSettings(dto);
  }

  @Get()
  async list(@Query() query: BackupQueryDto) {
    return this.backupsService.listRecords(query);
  }

  @Post('trigger')
  async triggerManualBackup() {
    return this.backupsService.createBackup('MANUAL');
  }

  @Get(':id/download')
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
    stream.pipe(res);
  }

  @Post(':id/restore')
  async restoreBackup(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RestoreBackupDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.backupsService.restoreBackup(id, dto.password, actor.id);
  }

  @Delete('google/disconnect')
  async disconnectGoogle() {
    return this.backupsService.disconnectGoogle();
  }
}
