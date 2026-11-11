import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { PERMISSIONS, SystemRole } from '@edu-center/shared';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { REQUIRED_PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { ResetAcademicYearDto, UpdateSettingsDto } from './dto/settings.dto';

describe('SettingsController', () => {
  let controller: SettingsController;
  let service: SettingsService;
  const reflector = new Reflector();

  beforeEach(() => {
    service = {
      getSettings: vi.fn(),
      updateSettings: vi.fn(),
      resetAcademicYear: vi.fn(),
      uploadLogo: vi.fn(),
      removeLogo: vi.fn(),
      getLogoStorageDir: vi.fn(),
    } as unknown as SettingsService;

    controller = new SettingsController(service);
  });

  describe('Route Metadata & Security Guards', () => {
    it('marks getSettings and getLogoFile as public', () => {
      const isPublicSettings = reflector.get<boolean>(IS_PUBLIC_KEY, controller.getSettings);
      expect(isPublicSettings).toBe(true);

      const isPublicLogo = reflector.get<boolean>(IS_PUBLIC_KEY, controller.getLogoFile);
      expect(isPublicLogo).toBe(true);
    });

    it('enforces OWNER role on updateSettings endpoint', () => {
      const roles = reflector.get<string[]>(ROLES_KEY, controller.updateSettings);
      expect(roles).toEqual([SystemRole.OWNER]);

      const permissions = reflector.get<string[]>(REQUIRED_PERMISSIONS_KEY, controller.updateSettings);
      expect(permissions).toEqual([PERMISSIONS.SETTINGS_MANAGE]);

      const guards = Reflect.getMetadata(GUARDS_METADATA, controller.updateSettings);
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
    });

    it('enforces OWNER role on uploadLogo endpoint', () => {
      const roles = reflector.get<string[]>(ROLES_KEY, controller.uploadLogo);
      expect(roles).toEqual([SystemRole.OWNER]);

      const permissions = reflector.get<string[]>(REQUIRED_PERMISSIONS_KEY, controller.uploadLogo);
      expect(permissions).toEqual([PERMISSIONS.SETTINGS_MANAGE]);

      const guards = Reflect.getMetadata(GUARDS_METADATA, controller.uploadLogo);
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
    });

    it('enforces OWNER role on removeLogo endpoint', () => {
      const roles = reflector.get<string[]>(ROLES_KEY, controller.removeLogo);
      expect(roles).toEqual([SystemRole.OWNER]);

      const permissions = reflector.get<string[]>(REQUIRED_PERMISSIONS_KEY, controller.removeLogo);
      expect(permissions).toEqual([PERMISSIONS.SETTINGS_MANAGE]);

      const guards = Reflect.getMetadata(GUARDS_METADATA, controller.removeLogo);
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
    });

    it('enforces OWNER role on resetAcademicYear endpoint', () => {
      const roles = reflector.get<string[]>(ROLES_KEY, controller.resetAcademicYear);
      expect(roles).toEqual([SystemRole.OWNER]);

      const permissions = reflector.get<string[]>(REQUIRED_PERMISSIONS_KEY, controller.resetAcademicYear);
      expect(permissions).toEqual([PERMISSIONS.SETTINGS_MANAGE]);

      const guards = Reflect.getMetadata(GUARDS_METADATA, controller.resetAcademicYear);
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
    });
  });

  describe('Handler logic', () => {
    it('delegates getSettings to service', async () => {
      const mockResult = { id: 'default', centerName: 'Center' } as any;
      vi.mocked(service.getSettings).mockResolvedValue(mockResult);

      const res = await controller.getSettings();
      expect(res).toBe(mockResult);
      expect(service.getSettings).toHaveBeenCalledOnce();
    });

    it('delegates updateSettings to service with actor user ID', async () => {
      const dto: UpdateSettingsDto = { centerName: 'New Center Name' };
      const actor = { id: 'owner-uuid-1', roleCode: SystemRole.OWNER } as any;
      const mockResult = { id: 'default', centerName: 'New Center Name' } as any;
      vi.mocked(service.updateSettings).mockResolvedValue(mockResult);

      const res = await controller.updateSettings(dto, actor);
      expect(res).toBe(mockResult);
      expect(service.updateSettings).toHaveBeenCalledWith(dto, actor);
    });

    it('delegates resetAcademicYear to service with actor user ID', async () => {
      const dto: ResetAcademicYearDto = {
        pin: '123456',
        purgeStudents: false,
        newAcademicYear: '2026 / 2027',
      };
      const actor = { id: 'owner-uuid-1', roleCode: SystemRole.OWNER } as any;
      const mockResult = {
        success: true,
        backupId: 'backup-1',
        purgeStudents: false,
        message: 'Success',
      };
      vi.mocked(service.resetAcademicYear).mockResolvedValue(mockResult);

      const res = await controller.resetAcademicYear(dto, actor);
      expect(res).toBe(mockResult);
      expect(service.resetAcademicYear).toHaveBeenCalledWith(dto, actor);
    });

    it('delegates uploadLogo to service with actor user ID', async () => {
      const mockFile = {
        buffer: Buffer.from('fake-image-data'),
        originalname: 'logo.png',
        mimetype: 'image/png',
      } as any;
      const actor = { id: 'owner-uuid-1', roleCode: SystemRole.OWNER } as any;
      const mockResult = { logoUrl: '/api/settings/logo/logo-123.png', fileName: 'logo-123.png' };
      vi.mocked(service.uploadLogo).mockResolvedValue(mockResult);

      const res = await controller.uploadLogo(mockFile, actor);
      expect(res).toBe(mockResult);
      expect(service.uploadLogo).toHaveBeenCalledWith(mockFile, actor);
    });

    it('throws BadRequestException if no file passed to uploadLogo', async () => {
      const actor = { id: 'owner-uuid-1', roleCode: SystemRole.OWNER } as any;
      await expect(controller.uploadLogo(undefined as any, actor)).rejects.toThrow(
        'يرجى اختيار ملف الصورة لرفعه',
      );
    });

    it('delegates removeLogo to service with actor user ID', async () => {
      const actor = { id: 'owner-uuid-1', roleCode: SystemRole.OWNER } as any;
      const mockResult = { success: true, message: 'Removed' };
      vi.mocked(service.removeLogo).mockResolvedValue(mockResult);

      const res = await controller.removeLogo(actor);
      expect(res).toBe(mockResult);
      expect(service.removeLogo).toHaveBeenCalledWith(actor);
    });
  });
});
