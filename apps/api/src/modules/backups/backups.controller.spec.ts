import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS } from '@edu-center/shared';
import { REQUIRED_PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';

describe('BackupsController', () => {
  let controller: BackupsController;
  let service: BackupsService;
  const reflector = new Reflector();

  beforeEach(() => {
    service = {
      getSettings: vi.fn(),
      updateSettings: vi.fn(),
      listRecords: vi.fn(),
      createBackup: vi.fn(),
      uploadBackupFile: vi.fn(),
      getRecordById: vi.fn(),
      restoreBackup: vi.fn(),
      disconnectGoogle: vi.fn(),
    } as unknown as BackupsService;

    controller = new BackupsController(service);
  });

  describe('Permissions Metadata', () => {
    it('enforces BACKUPS_MANAGE on uploadBackup', () => {
      const permissions = reflector.get<string[]>(
        REQUIRED_PERMISSIONS_KEY,
        controller.uploadBackup,
      );
      expect(permissions).toEqual([PERMISSIONS.BACKUPS_MANAGE]);
    });

    it('enforces BACKUPS_MANAGE on triggerManualBackup', () => {
      const permissions = reflector.get<string[]>(
        REQUIRED_PERMISSIONS_KEY,
        controller.triggerManualBackup,
      );
      expect(permissions).toEqual([PERMISSIONS.BACKUPS_MANAGE]);
    });

    it('enforces BACKUPS_VIEW on list', () => {
      const permissions = reflector.get<string[]>(
        REQUIRED_PERMISSIONS_KEY,
        controller.list,
      );
      expect(permissions).toEqual([PERMISSIONS.BACKUPS_VIEW]);
    });
  });

  describe('Handler logic', () => {
    it('delegates uploadBackup to service with actor user ID', async () => {
      const mockFile = {
        buffer: Buffer.from('fake-sql-content'),
        originalname: 'backup.sql',
      } as any;
      const actor = { id: 'user-uuid-1' } as any;
      const mockRecord = {
        id: 'rec-123',
        fileName: 'upload-backup.sql.gz',
        fileSizeBytes: 1024,
        triggerType: 'UPLOADED',
        status: 'SUCCESS',
      };
      vi.mocked(service.uploadBackupFile).mockResolvedValue(mockRecord as any);

      const res = await controller.uploadBackup(mockFile, actor);
      expect(res).toBe(mockRecord);
      expect(service.uploadBackupFile).toHaveBeenCalledWith(mockFile, 'user-uuid-1');
    });

    it('throws BadRequestException if file is missing in uploadBackup', async () => {
      const actor = { id: 'user-uuid-1' } as any;
      await expect(controller.uploadBackup(undefined as any, actor)).rejects.toThrow(
        'يرجى اختيار ملف النسخة الاحتياطية لرفعه',
      );
    });

    it('delegates restoreBackup to service with actor user ID', async () => {
      const actor = { id: 'user-uuid-1' } as any;
      vi.mocked(service.restoreBackup).mockResolvedValue({
        success: true,
        message: 'Restored successfully',
      });

      const res = await controller.restoreBackup('00000000-0000-0000-0000-000000000001', { password: 'pass' }, actor);
      expect(res.success).toBe(true);
      expect(service.restoreBackup).toHaveBeenCalledWith(
        '00000000-0000-0000-0000-000000000001',
        'pass',
        'user-uuid-1',
      );
    });
  });
});
