import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsRepository } from './settings.repository';
import { BackupsService } from '../backups/backups.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CacheService } from '../../common/cache/cache.module';
import { ConfigService } from '@nestjs/config';

describe('SettingsService', () => {
  let service: SettingsService;
  let settingsRepository: Partial<SettingsRepository>;
  let backupsService: Partial<BackupsService>;
  let auditLogsService: Partial<AuditLogsService>;
  let cacheService: Partial<CacheService>;
  let configService: Partial<ConfigService>;

  const defaultMockSettings = {
    id: 'default',
    centerName: 'سنتر النخبة التعليمي',
    centerSubtitle: 'نظام الإدارة المتكامل',
    logoUrl: null,
    phone: '01000000000',
    address: 'القاهرة، مصر',
    academicYear: '2026 / 2027',
    currencySymbol: 'ج.م',
    updatedAt: new Date(),
    updatedBy: null,
  };

  beforeEach(() => {
    process.env.ANNUAL_RESET_PIN = '123456';

    settingsRepository = {
      getSettings: vi.fn().mockResolvedValue(defaultMockSettings),
      upsertSettings: vi.fn().mockImplementation(async (data) => ({
        ...defaultMockSettings,
        ...data,
      })),
      clearOperationalData: vi.fn().mockResolvedValue({ success: true, purgedCounts: { sessions: 10 } }),
    };

    backupsService = {
      createBackup: vi.fn().mockResolvedValue({
        id: 'backup-123',
        fileName: 'backup-educenter-2026.sql.gz',
        status: 'SUCCESS',
      } as any),
    };

    auditLogsService = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    cacheService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      invalidatePrefix: vi.fn().mockResolvedValue(undefined),
    };

    configService = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'annualResetPin') return '123456';
        return undefined;
      }),
    };

    service = new SettingsService(
      settingsRepository as SettingsRepository,
      backupsService as BackupsService,
      auditLogsService as AuditLogsService,
      cacheService as CacheService,
      configService as ConfigService,
    );
  });

  describe('getSettings', () => {
    it('returns default or stored center settings and caches result', async () => {
      const result = await service.getSettings();
      expect(result).toBeDefined();
      expect(result.centerName).toBe('سنتر النخبة التعليمي');
      expect(settingsRepository.getSettings).toHaveBeenCalledOnce();
    });

    it('returns cached settings if present in cache', async () => {
      vi.mocked(cacheService.get!).mockResolvedValueOnce(defaultMockSettings);
      const result = await service.getSettings();
      expect(result.centerName).toBe('سنتر النخبة التعليمي');
      expect(settingsRepository.getSettings).not.toHaveBeenCalled();
    });
  });

  describe('updateSettings', () => {
    it('updates name, logo, phone and invalidates cache', async () => {
      const dto = {
        centerName: 'سنتر الأوائل',
        phone: '01112223334',
        logoUrl: 'https://cdn.example.com/logo.png',
      };
      const userId = '00000000-0000-4000-8000-000000000001';

      const result = await service.updateSettings(dto, userId);

      expect(settingsRepository.upsertSettings).toHaveBeenCalledWith(dto, userId);
      expect(cacheService.invalidatePrefix).toHaveBeenCalledWith('settings');
      expect(auditLogsService.record).toHaveBeenCalled();
      expect(result.centerName).toBe('سنتر الأوائل');
    });
  });

  describe('resetAcademicYear', () => {
    it('throws ForbiddenException when PIN does not match', async () => {
      const dto = { pin: '999999', purgeStudents: false };
      const userId = '00000000-0000-4000-8000-000000000001';

      await expect(service.resetAcademicYear(dto, userId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(backupsService.createBackup).not.toHaveBeenCalled();
      expect(settingsRepository.clearOperationalData).not.toHaveBeenCalled();
    });

    it('enforces mandatory pre-backup guarantee: halts if backup fails', async () => {
      vi.mocked(backupsService.createBackup!).mockRejectedValueOnce(
        new Error('Disk space full'),
      );
      const dto = { pin: '123456', purgeStudents: false };
      const userId = '00000000-0000-4000-8000-000000000001';

      await expect(service.resetAcademicYear(dto, userId)).rejects.toThrow(
        'Disk space full',
      );
      expect(backupsService.createBackup).toHaveBeenCalled();
      expect(settingsRepository.clearOperationalData).not.toHaveBeenCalled();
    });

    it('executes backup, purges operational data, advances academic year, and invalidates caches when PIN is valid', async () => {
      const dto = {
        pin: '123456',
        purgeStudents: true,
        newAcademicYear: '2027 / 2028',
      };
      const userId = '00000000-0000-4000-8000-000000000001';

      const result = await service.resetAcademicYear(dto, userId);

      expect(backupsService.createBackup).toHaveBeenCalledWith('MANUAL');
      expect(settingsRepository.clearOperationalData).toHaveBeenCalledWith(true);
      expect(settingsRepository.upsertSettings).toHaveBeenCalledWith(
        expect.objectContaining({ academicYear: '2027 / 2028' }),
        userId,
      );
      expect(cacheService.invalidatePrefix).toHaveBeenCalledWith('');
      expect(auditLogsService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'system.annual_reset',
          actorUserId: userId,
        }),
      );
      expect(result.success).toBe(true);
      expect(result.backupId).toBe('backup-123');
    });
  });
});
