import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BackupsService } from './backups.service';

@Injectable()
export class BackupsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupsScheduler.name);
  private timer: NodeJS.Timeout | null = null;
  private lastScheduledDate: string | null = null;

  constructor(private readonly backupsService: BackupsService) {}

  onModuleInit() {
    this.timer = setInterval(() => this.checkSchedule(), 60 * 1000);
    this.logger.log('Automated backups scheduler initialized.');
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async checkSchedule() {
    try {
      const settings = await this.backupsService.getSettings();
      if (!settings.autoBackupEnabled) return;

      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTime = `${currentHours}:${currentMinutes}`;
      const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      if (currentTime === settings.scheduleTime && this.lastScheduledDate !== todayDate) {
        this.lastScheduledDate = todayDate;
        this.logger.log(`Starting automated daily backup for ${todayDate} at ${currentTime}...`);
        await this.backupsService.createBackup('SCHEDULED');
        this.logger.log(`Automated daily backup for ${todayDate} completed successfully.`);
      }
    } catch (err: any) {
      this.logger.error(`Automated backup schedule error: ${err.message}`);
    }
  }
}
