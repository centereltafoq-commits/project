import * as crypto from 'crypto';
import {
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../common/cache/cache.module';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { BackupsService } from '../backups/backups.service';
import { ResetAcademicYearDto, UpdateSettingsDto } from './dto/settings.dto';
import { SettingsRepository, SystemSettingsRecord } from './settings.repository';

const SETTINGS_CACHE_KEY = 'settings:global';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly repository: SettingsRepository,
    private readonly backupsService: BackupsService,
    private readonly auditLogsService: AuditLogsService,
    private readonly cacheService: CacheService,
    private readonly configService: ConfigService,
  ) {}

  async getSettings(): Promise<SystemSettingsRecord> {
    const cached = await this.cacheService.get<SystemSettingsRecord>(SETTINGS_CACHE_KEY);
    if (cached) {
      return cached;
    }

    const settings = await this.repository.getSettings();
    await this.cacheService.set(SETTINGS_CACHE_KEY, settings, 300);
    return settings;
  }

  async updateSettings(
    dto: UpdateSettingsDto,
    actorUserId?: string,
  ): Promise<SystemSettingsRecord> {
    const previous = await this.getSettings();
    const updated = await this.repository.upsertSettings(dto, actorUserId);
    await this.cacheService.invalidatePrefix('settings');

    await this.auditLogsService.record({
      actorUserId,
      action: 'system.settings_update',
      entityType: 'SETTINGS',
      entityId: 'default',
      beforeData: previous,
      afterData: updated,
    });

    return updated;
  }

  async resetAcademicYear(
    dto: ResetAcademicYearDto,
    actorUserId?: string,
  ): Promise<{
    success: boolean;
    backupId: string;
    purgeStudents: boolean;
    message: string;
  }> {
    const expectedPin =
      this.configService.get<string>('annualResetPin') ||
      process.env.ANNUAL_RESET_PIN ||
      '123456';

    const isPinValid = this.verifyPinTimingSafe(dto.pin, expectedPin);
    if (!isPinValid) {
      await this.auditLogsService.record({
        actorUserId,
        action: 'system.annual_reset_failed_pin',
        entityType: 'SYSTEM',
        entityId: 'default',
        metadata: { attemptedAt: new Date().toISOString() },
      });
      throw new UnauthorizedException(
        'رمز الأمان PIN غير صحيح. تم إلغاء عملية بدء العام الدراسي الجديد لأسباب أمنية.',
      );
    }

    this.logger.warn(
      `Starting Annual Academic Year Reset requested by user [${actorUserId || 'system'}] (purgeStudents=${dto.purgeStudents})...`,
    );

    // 1. Mandatory Pre-Purge Full Backup
    const backupRecord = await this.backupsService.createBackup('MANUAL');
    this.logger.log(
      `Pre-purge full backup completed successfully with ID: ${backupRecord.id}`,
    );

    // 2. Transactional Operational Purge
    const purgeStudents = Boolean(dto.purgeStudents);
    await this.repository.clearOperationalData(purgeStudents);

    // 3. Update Academic Year if new one provided
    if (dto.newAcademicYear && dto.newAcademicYear.trim() !== '') {
      await this.repository.upsertSettings(
        { academicYear: dto.newAcademicYear.trim() },
        actorUserId,
      );
    }

    // 4. Invalidate all app-wide caches (dashboards, students, groups, finance, settings)
    await this.cacheService.invalidatePrefix('');

    // 5. Audit Logging
    await this.auditLogsService.record({
      actorUserId,
      action: 'system.annual_reset',
      entityType: 'SYSTEM',
      entityId: 'default',
      metadata: {
        backupId: backupRecord.id,
        backupFileName: backupRecord.fileName,
        purgeStudents,
        newAcademicYear: dto.newAcademicYear,
        notes: dto.notes,
      },
    });

    this.logger.log('Annual Academic Year Reset completed successfully.');

    return {
      success: true,
      backupId: backupRecord.id,
      purgeStudents,
      message: 'تم أرشفة وتصفير بيانات العام المنتهي وبدء العام الدراسي الجديد بنجاح.',
    };
  }

  private verifyPinTimingSafe(inputPin: string, expectedPin: string): boolean {
    if (!inputPin || !expectedPin || inputPin.length !== expectedPin.length) {
      return false;
    }
    const bufA = Buffer.from(inputPin);
    const bufB = Buffer.from(expectedPin);
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
