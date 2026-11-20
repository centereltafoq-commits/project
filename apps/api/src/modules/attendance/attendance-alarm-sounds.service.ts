import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UploadedMulterFile } from '../../common/types/multer.types';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

export interface CustomAlarmSoundRecord {
  id: string;
  label: string;
  fileName: string;
  originalName: string;
  url: string;
  sizeBytes: number;
  createdAt: string;
}

const MAX_MP3_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_CUSTOM_SOUNDS = 20;
const MANIFEST_FILENAME = 'manifest.json';
const SAFE_ALARM_FILENAME_REGEX = /^alarm-[a-f0-9-]{36}\.mp3$/i;
const ALLOWED_MP3_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/x-mpeg',
  'audio/mpeg3',
  'application/octet-stream',
]);

/**
 * Validates that a binary buffer starts with an ID3v2 header or contains a valid MPEG audio frame sync.
 */
export function isValidMp3Buffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 128) {
    return false;
  }

  // Standard ID3v2 tag header at byte 0 ("ID3" + major version <= 4)
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33 && buffer[3] <= 4) {
    return true;
  }

  // Raw MPEG frame sync scan across first 4 KB (11 sync bits + valid version/layer/bitrate/sample-rate)
  const scanLimit = Math.min(buffer.length - 4, 4096);
  for (let i = 0; i <= scanLimit; i += 1) {
    if (
      buffer[i] === 0xff &&
      (buffer[i + 1] & 0xe0) === 0xe0 &&
      (buffer[i + 1] & 0x18) !== 0x08 &&
      (buffer[i + 1] & 0x06) !== 0x00 &&
      (buffer[i + 2] & 0xf0) !== 0xf0 &&
      (buffer[i + 2] & 0x0c) !== 0x0c
    ) {
      return true;
    }
  }

  return false;
}

function sanitizeSoundLabel(rawLabel?: string, originalName?: string): string {
  const fromOriginal = originalName
    ? path.basename(originalName, path.extname(originalName))
    : '';
  const candidate = (rawLabel ?? fromOriginal ?? '')
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

  return candidate || 'صوت إنذار مخصص';
}

@Injectable()
export class AttendanceAlarmSoundsService {
  private readonly logger = new Logger(AttendanceAlarmSoundsService.name);
  private manifestQueue: Promise<unknown> = Promise.resolve();

  constructor(@Optional() private readonly auditLogsService?: AuditLogsService) {}

  getStorageDir(): string {
    const storageRoot = process.env.STORAGE_ROOT_DIR || process.cwd();
    return path.resolve(storageRoot, 'storage', 'uploads', 'attendance-alarms');
  }

  private async ensureStorageDir(): Promise<string> {
    const dir = this.getStorageDir();
    await fs.promises.mkdir(dir, { recursive: true });
    return dir;
  }

  private runSerialized<T>(task: () => Promise<T>): Promise<T> {
    const next = this.manifestQueue.then(task, task);
    this.manifestQueue = next.catch(() => undefined);
    return next;
  }

  private async readManifest(dir: string): Promise<CustomAlarmSoundRecord[]> {
    const manifestPath = path.join(dir, MANIFEST_FILENAME);
    try {
      const raw = await fs.promises.readFile(manifestPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as CustomAlarmSoundRecord[]) : [];
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        return [];
      }
      this.logger.warn(`Failed reading alarm sounds manifest: ${err?.message ?? err}`);
      return [];
    }
  }

  private async writeManifestAtomic(
    dir: string,
    records: CustomAlarmSoundRecord[],
  ): Promise<void> {
    const manifestPath = path.join(dir, MANIFEST_FILENAME);
    const tmpPath = path.join(dir, `${MANIFEST_FILENAME}.${crypto.randomUUID()}.tmp`);
    await fs.promises.writeFile(tmpPath, JSON.stringify(records, null, 2), 'utf-8');
    await fs.promises.rename(tmpPath, manifestPath);
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  async listSounds(): Promise<CustomAlarmSoundRecord[]> {
    const dir = await this.ensureStorageDir();
    const manifest = await this.readManifest(dir);

    const existing: CustomAlarmSoundRecord[] = [];
    let staleDetected = false;

    for (const item of manifest) {
      if (!item || typeof item.fileName !== 'string' || !SAFE_ALARM_FILENAME_REGEX.test(item.fileName)) {
        staleDetected = true;
        continue;
      }
      const present = await this.fileExists(path.join(dir, item.fileName));
      if (present) {
        existing.push(item);
      } else {
        staleDetected = true;
      }
    }

    if (staleDetected) {
      await this.runSerialized(async () => {
        const latest = await this.readManifest(dir);
        const pruned: CustomAlarmSoundRecord[] = [];
        for (const entry of latest) {
          if (
            entry &&
            typeof entry.fileName === 'string' &&
            SAFE_ALARM_FILENAME_REGEX.test(entry.fileName) &&
            (await this.fileExists(path.join(dir, entry.fileName)))
          ) {
            pruned.push(entry);
          }
        }
        await this.writeManifestAtomic(dir, pruned);
      });
    }

    return existing.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async uploadSound(
    file: UploadedMulterFile,
    label?: string,
    actor?: AuthenticatedUser,
  ): Promise<CustomAlarmSoundRecord> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('ملف الصوت مفقود أو فارغ');
    }
    if (file.buffer.length > MAX_MP3_SIZE_BYTES) {
      throw new BadRequestException('حجم ملف MP3 يجب ألا يتجاوز 5 ميجابايت');
    }

    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext !== '.mp3') {
      throw new BadRequestException('يرجى رفع ملف صوتي بصيغة MP3 فقط (.mp3)');
    }

    const normalizedMime = file.mimetype?.toLowerCase().trim();
    if (normalizedMime && !ALLOWED_MP3_MIME_TYPES.has(normalizedMime)) {
      throw new BadRequestException('صيغة الملف غير مدعومة، يرجى رفع ملف MP3 صالح');
    }

    if (!isValidMp3Buffer(file.buffer)) {
      throw new BadRequestException('يرجى رفع ملف صوتي صالح بصيغة MP3 فقط');
    }

    const dir = await this.ensureStorageDir();
    const id = crypto.randomUUID();
    const fileName = `alarm-${id}.mp3`;
    const targetPath = path.join(dir, fileName);

    const record: CustomAlarmSoundRecord = {
      id,
      label: sanitizeSoundLabel(label, file.originalname),
      fileName,
      originalName: path.basename(file.originalname || fileName).slice(0, 140),
      url: `/api/attendance/alarm-sounds/${fileName}`,
      sizeBytes: file.buffer.length,
      createdAt: new Date().toISOString(),
    };

    await this.runSerialized(async () => {
      const existing = await this.readManifest(dir);
      if (existing.length >= MAX_CUSTOM_SOUNDS) {
        throw new BadRequestException(
          `تم الوصول للحد الأقصى (${MAX_CUSTOM_SOUNDS} صوت مخصص)، يرجى حذف أحد الأصوات القديمة أولاً`,
        );
      }

      await fs.promises.writeFile(targetPath, file.buffer);
      try {
        await this.writeManifestAtomic(dir, [record, ...existing]);
      } catch (err) {
        await fs.promises.unlink(targetPath).catch(() => undefined);
        throw err;
      }
    });

    await this.auditLogsService?.record({
      actorUserId: actor?.id,
      actorName: actor?.fullName,
      action: 'attendance.alarm_sound_upload',
      entityType: 'ATTENDANCE_ALARM_SOUND',
      entityId: record.id,
      afterData: record,
    });

    return record;
  }

  async deleteSound(
    id: string,
    actor?: AuthenticatedUser,
  ): Promise<{ success: true; id: string }> {
    const dir = await this.ensureStorageDir();

    const deletedRecord = await this.runSerialized(async () => {
      const existing = await this.readManifest(dir);
      const target = existing.find((item) => item.id === id);
      if (!target) {
        throw new NotFoundException('ملف الصوت غير موجود');
      }

      const remaining = existing.filter((item) => item.id !== id);
      await this.writeManifestAtomic(dir, remaining);

      const filePath = path.join(dir, path.basename(target.fileName));
      await fs.promises.unlink(filePath).catch((err: any) => {
        if (err?.code !== 'ENOENT') {
          this.logger.warn(`Failed removing alarm sound file ${target.fileName}: ${err?.message}`);
        }
      });

      return target;
    });

    await this.auditLogsService?.record({
      actorUserId: actor?.id,
      actorName: actor?.fullName,
      action: 'attendance.alarm_sound_delete',
      entityType: 'ATTENDANCE_ALARM_SOUND',
      entityId: id,
      beforeData: deletedRecord,
    });

    return { success: true, id };
  }

  async resolveSoundFilePath(filename: string): Promise<string> {
    if (!filename || filename !== path.basename(filename) || !SAFE_ALARM_FILENAME_REGEX.test(filename)) {
      throw new BadRequestException('اسم الملف غير صالح');
    }

    const dir = this.getStorageDir();
    const filePath = path.resolve(dir, filename);
    if (!(await this.fileExists(filePath))) {
      throw new NotFoundException('ملف الصوت غير موجود');
    }

    return filePath;
  }
}
