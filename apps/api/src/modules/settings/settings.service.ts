import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../common/cache/cache.module';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UploadedMulterFile } from '../../common/types/multer.types';
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

  private extractActorInfo(actor?: string | AuthenticatedUser): {
    actorUserId?: string;
    actorName?: string;
  } {
    if (!actor) return {};
    if (typeof actor === 'object') {
      return {
        actorUserId: actor.id,
        actorName: actor.fullName,
      };
    }
    return { actorUserId: actor };
  }

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
    actor?: string | AuthenticatedUser,
  ): Promise<SystemSettingsRecord> {
    const { actorUserId, actorName } = this.extractActorInfo(actor);
    const previous = await this.getSettings();
    if (
      previous.logoUrl &&
      previous.logoUrl.startsWith('/api/settings/logo/') &&
      dto.logoUrl !== undefined &&
      dto.logoUrl !== previous.logoUrl
    ) {
      const oldFilename = path.basename(previous.logoUrl);
      const oldPath = path.resolve(this.getLogoStorageDir(), oldFilename);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e: any) {
          this.logger.warn(`Failed to unlink replaced logo: ${e.message}`);
        }
      }
    }

    const updated = await this.repository.upsertSettings(dto, actorUserId);
    await this.cacheService.invalidatePrefix('settings');

    await this.auditLogsService.record({
      actorUserId,
      actorName,
      action: 'system.settings_update',
      entityType: 'SETTINGS',
      entityId: 'default',
      beforeData: previous,
      afterData: updated,
    });

    return updated;
  }

  getLogoStorageDir(): string {
    const storageRoot = process.env.STORAGE_ROOT_DIR || process.cwd();
    const dir = path.resolve(storageRoot, 'storage', 'uploads', 'branding');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }

  private validateImageBufferSignature(
    buffer: Buffer,
    ext: string,
    mimetype?: string,
  ): void {
    if (!buffer || buffer.length < 4) {
      throw new BadRequestException('ملف الصورة فارغ أو تالف');
    }

    if (ext === '.svg' || mimetype === 'image/svg+xml') {
      if (buffer.includes(0x00)) {
        throw new BadRequestException('محتوى ملف SVG غير صالح أو يحتوي على بيانات ثنائية');
      }
      const svgText = buffer.toString('utf-8');
      if (svgText.includes('\uFFFD') || !/<svg[\s>]/i.test(svgText) || !/<\/svg>/i.test(svgText)) {
        throw new BadRequestException('محتوى ملف SVG غير صالح أو تالف');
      }
      return;
    }

    const isPng =
      ext === '.png' &&
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpg =
      (ext === '.jpg' || ext === '.jpeg') &&
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
    const isGif =
      ext === '.gif' &&
      buffer.length >= 6 &&
      (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
        buffer.subarray(0, 6).toString('ascii') === 'GIF89a');
    const isWebp =
      ext === '.webp' &&
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP';

    if (!isPng && !isJpg && !isGif && !isWebp) {
      throw new BadRequestException('محتوى ملف الصورة تالف أو لا يطابق صيغة الصورة المحددة');
    }
  }

  async uploadLogo(
    file: UploadedMulterFile,
    actor?: string | AuthenticatedUser,
  ): Promise<{ logoUrl: string; fileName: string }> {
    const { actorUserId, actorName } = this.extractActorInfo(actor);
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('ملف الصورة مفقود أو غير صالح');
    }

    if (file.buffer.length > 5 * 1024 * 1024) {
      throw new BadRequestException('حجم ملف الصورة يتجاوز الحد الأقصى المسموح به (5 ميجابايت)');
    }

    if (file.mimetype && !file.mimetype.startsWith('image/')) {
      throw new BadRequestException('نوع المحتوى للملف غير صالح. يجب أن يكون ملف صورة');
    }

    const allowedExts = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExts.includes(ext)) {
      throw new BadRequestException(
        'نوع الملف غير مدعوم. يرجى رفع صورة بصيغة PNG أو JPG أو WEBP أو SVG',
      );
    }

    this.validateImageBufferSignature(file.buffer, ext, file.mimetype);

    // Security check for SVG uploads to prevent stored script injection
    if (ext === '.svg' || file.mimetype === 'image/svg+xml') {
      const svgContent = file.buffer.toString('utf-8');
      const hasScriptTag = /<script[\s>]/i.test(svgContent);
      const hasJsUrl = /javascript:/i.test(svgContent);
      const hasInlineHandlers = /on(load|error|click|mouseover|mouseenter)[\s=]/i.test(svgContent);
      if (hasScriptTag || hasJsUrl || hasInlineHandlers) {
        throw new BadRequestException('ملف SVG يحتوي على وسوم برمجية أو أحداث غير مسموح بها لأسباب أمنية');
      }
    }

    const uploadDir = this.getLogoStorageDir();
    const filename = `logo-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
    const targetPath = path.join(uploadDir, filename);

    fs.writeFileSync(targetPath, file.buffer);

    const logoUrl = `/api/settings/logo/${filename}`;

    const previous = await this.getSettings();
    if (previous.logoUrl && previous.logoUrl.startsWith('/api/settings/logo/')) {
      const oldFilename = path.basename(previous.logoUrl);
      const oldPath = path.resolve(uploadDir, oldFilename);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e: any) {
          this.logger.warn(`Failed to unlink previous logo: ${e.message}`);
        }
      }
    }

    await this.repository.upsertSettings({ logoUrl }, actorUserId);
    await this.cacheService.invalidatePrefix('settings');

    await this.auditLogsService.record({
      actorUserId,
      actorName,
      action: 'system.settings_logo_uploaded',
      entityType: 'SETTINGS',
      entityId: 'default',
      beforeData: { logoUrl: previous.logoUrl },
      afterData: { logoUrl },
    });

    return { logoUrl, fileName: filename };
  }

  async removeLogo(
    actor?: string | AuthenticatedUser,
  ): Promise<{ success: boolean; message: string }> {
    const { actorUserId, actorName } = this.extractActorInfo(actor);
    const previous = await this.getSettings();
    if (previous.logoUrl && previous.logoUrl.startsWith('/api/settings/logo/')) {
      const oldFilename = path.basename(previous.logoUrl);
      const oldPath = path.resolve(this.getLogoStorageDir(), oldFilename);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e: any) {
          this.logger.warn(`Failed to unlink removed logo: ${e.message}`);
        }
      }
    }

    await this.repository.upsertSettings({ logoUrl: null }, actorUserId);
    await this.cacheService.invalidatePrefix('settings');

    await this.auditLogsService.record({
      actorUserId,
      actorName,
      action: 'system.settings_logo_removed',
      entityType: 'SETTINGS',
      entityId: 'default',
      beforeData: { logoUrl: previous.logoUrl },
      afterData: { logoUrl: null },
    });

    return { success: true, message: 'تم حذف شعار السنتر بنجاح' };
  }

  async resetAcademicYear(
    dto: ResetAcademicYearDto,
    actor?: string | AuthenticatedUser,
  ): Promise<{
    success: boolean;
    backupId: string;
    purgeStudents: boolean;
    message: string;
  }> {
    const { actorUserId, actorName } = this.extractActorInfo(actor);
    const expectedPin =
      this.configService.get<string>('annualResetPin') ||
      process.env.ANNUAL_RESET_PIN ||
      '123456';

    const isPinValid = this.verifyPinTimingSafe(dto.pin, expectedPin);
    if (!isPinValid) {
      await this.auditLogsService.record({
        actorUserId,
        actorName,
        action: 'system.annual_reset_failed_pin',
        entityType: 'SYSTEM',
        entityId: 'default',
        metadata: { attemptedAt: new Date().toISOString() },
      });
      throw new ForbiddenException(
        'رمز الأمان PIN غير صحيح. تم إلغاء عملية بدء العام الدراسي الجديد لأسباب أمنية.',
      );
    }

    this.logger.warn(
      `Starting Annual Academic Year Reset requested by user [${actorUserId || 'system'}] (purgeStudents=${dto.purgeStudents})...`,
    );

    // 1. Mandatory Pre-Purge Full Backup
    const backupRecord =
      typeof actor === 'object' && actor
        ? await this.backupsService.createBackup('MANUAL', actor)
        : await this.backupsService.createBackup('MANUAL');
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
      actorName,
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
