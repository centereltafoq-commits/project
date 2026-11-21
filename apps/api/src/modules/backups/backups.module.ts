import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { UsersModule } from '../users/users.module';
import { BackupsController } from './backups.controller';
import { BackupsRepository } from './backups.repository';
import { BackupsScheduler } from './backups.scheduler';
import { BackupsService } from './backups.service';
import { CloudSyncController } from './cloud-sync.controller';
import { CloudSyncService } from './cloud-sync.service';
import { GoogleDriveDriver } from './drivers/google-drive.driver';
import { LocalStorageDriver } from './drivers/local-storage.driver';
import { SupabaseStorageDriver } from './drivers/supabase-storage.driver';

@Module({
  imports: [UsersModule, AuditLogsModule],
  controllers: [BackupsController, CloudSyncController],
  providers: [
    BackupsRepository,
    LocalStorageDriver,
    GoogleDriveDriver,
    SupabaseStorageDriver,
    BackupsService,
    BackupsScheduler,
    CloudSyncService,
  ],
  exports: [BackupsService, CloudSyncService],
})
export class BackupsModule {}


