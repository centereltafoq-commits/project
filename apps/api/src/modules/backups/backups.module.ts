import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { UsersModule } from '../users/users.module';
import { BackupsController } from './backups.controller';
import { BackupsRepository } from './backups.repository';
import { BackupsScheduler } from './backups.scheduler';
import { BackupsService } from './backups.service';
import { GoogleDriveDriver } from './drivers/google-drive.driver';
import { LocalStorageDriver } from './drivers/local-storage.driver';

@Module({
  imports: [UsersModule, AuditLogsModule],
  controllers: [BackupsController],
  providers: [
    BackupsRepository,
    LocalStorageDriver,
    GoogleDriveDriver,
    BackupsService,
    BackupsScheduler,
  ],
  exports: [BackupsService],
})
export class BackupsModule {}


