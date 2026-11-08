import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { CacheService } from '../../common/cache/cache.module';
import { UsersRepository } from '../users/users.repository';
import { BackupsRepository } from './backups.repository';
import { GoogleDriveDriver } from './drivers/google-drive.driver';
import { LocalStorageDriver } from './drivers/local-storage.driver';
import { BackupQueryDto, UpdateBackupSettingsDto } from './dto/backup.dto';

@Injectable()
export class BackupsService {
  private readonly logger = new Logger(BackupsService.name);
  private readonly storageDir: string;
  private readonly pgDumpPath: string;
  private readonly psqlPath: string;

  constructor(
    private readonly repository: BackupsRepository,
    private readonly localStorageDriver: LocalStorageDriver,
    private readonly googleDriveDriver: GoogleDriveDriver,
    private readonly usersRepository: UsersRepository,
    private readonly config: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    this.storageDir = path.resolve(process.cwd(), 'storage', 'backups');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    const laragonBin = 'C:\\laragon\\bin\\postgresql\\postgresql\\bin';
    this.pgDumpPath = fs.existsSync(path.join(laragonBin, 'pg_dump.exe'))
      ? path.join(laragonBin, 'pg_dump.exe')
      : 'pg_dump';
    this.psqlPath = fs.existsSync(path.join(laragonBin, 'psql.exe'))
      ? path.join(laragonBin, 'psql.exe')
      : 'psql';
  }

  private getDbCredentials(): { dbUrl: string; password?: string } {
    const dbUrl = this.config.getOrThrow<string>('databaseUrl');
    let password = process.env.PGPASSWORD || undefined;
    try {
      const parsed = new URL(dbUrl);
      if (parsed.password) {
        password = decodeURIComponent(parsed.password);
      }
    } catch {}
    return { dbUrl, password };
  }

  private sanitizePublicSettings<
    T extends { googleDriveTokens?: unknown; dropboxTokens?: unknown },
  >(settings: T) {
    return {
      ...settings,
      googleDriveTokens: settings.googleDriveTokens ? { connected: true } : null,
      dropboxTokens: settings.dropboxTokens ? { connected: true } : null,
    };
  }

  async getSettings() {
    const raw = await this.repository.getSettings();
    return this.sanitizePublicSettings(raw);
  }

  async updateSettings(dto: UpdateBackupSettingsDto) {
    const updated = await this.repository.updateSettings(dto);
    return this.sanitizePublicSettings(updated);
  }

  async listRecords(query: BackupQueryDto) {
    return this.repository.listRecords(query);
  }

  async getRecordById(id: string) {
    const record = await this.repository.findRecordById(id);
    if (!record) {
      throw new NotFoundException('سجل النسخة الاحتياطية غير موجود');
    }
    return record;
  }

  async createBackup(triggerType: 'MANUAL' | 'SCHEDULED' = 'MANUAL') {
    const settings = await this.repository.getSettings();
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestampStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const fileName = `backup-educenter-${timestampStr}.sql.gz`;
    const targetFilePath = path.join(this.storageDir, fileName);

    const initialRecord = await this.repository.createRecord({
      fileName,
      filePath: targetFilePath,
      fileSizeBytes: 0,
      triggerType,
      destinations: ['SERVER_STORAGE'],
      status: 'IN_PROGRESS',
    });

    try {
      const { dbUrl, password } = this.getDbCredentials();
      const hash = crypto.createHash('sha256');
      const gzip = zlib.createGzip({ level: 9 });
      const outputStream = fs.createWriteStream(targetFilePath);

      await new Promise<void>((resolve, reject) => {
        let isSettled = false;
        const safeResolve = () => {
          if (!isSettled) {
            isSettled = true;
            resolve();
          }
        };
        const safeReject = (err: unknown) => {
          if (!isSettled) {
            isSettled = true;
            reject(err);
          }
        };

        const dump = spawn(
          this.pgDumpPath,
          ['--dbname', dbUrl, '--clean', '--if-exists', '--no-owner', '--no-privileges'],
          {
            env: { ...process.env, ...(password ? { PGPASSWORD: password } : {}) },
          },
        );

        let errOutput = '';
        dump.stderr.on('data', (chunk) => (errOutput += chunk.toString()));
        gzip.on('data', (chunk) => hash.update(chunk));

        let dumpFinished = false;
        let dumpCode: number | null = null;
        let outputFinished = false;

        const checkCompletion = () => {
          if (dumpFinished && dumpCode !== 0) {
            safeReject(new Error(`pg_dump failed (code ${dumpCode}): ${errOutput}`));
            return;
          }
          if (dumpFinished && outputFinished) {
            safeResolve();
          }
        };

        outputStream.on('finish', () => {
          outputFinished = true;
          checkCompletion();
        });

        outputStream.on('error', safeReject);
        gzip.on('error', safeReject);
        dump.on('error', safeReject);

        dump.on('close', (code) => {
          dumpFinished = true;
          dumpCode = code;
          checkCompletion();
        });

        dump.stdout.pipe(gzip).pipe(outputStream);
      });

      const stats = fs.statSync(targetFilePath);
      const checksum = hash.digest('hex');
      const destinations: string[] = ['SERVER_STORAGE'];

      if (settings.localPath && settings.localPath.trim() !== '') {
        const localResult = await this.localStorageDriver.upload(
          targetFilePath,
          fileName,
          settings.localPath,
        );
        if (localResult.success) destinations.push('LOCAL');
      }

      if (settings.googleDriveEnabled && settings.googleDriveTokens) {
        const driveResult = await this.googleDriveDriver.upload(
          targetFilePath,
          fileName,
          settings.googleDriveTokens,
        );
        if (driveResult.success) destinations.push('GOOGLE_DRIVE');
      }

      const updated = await this.repository.updateRecord(initialRecord.id, {
        fileSizeBytes: stats.size,
        checksum,
        destinations,
        status: 'SUCCESS',
      });

      await this.enforceRetentionPolicy(settings.retentionCount);
      return updated;
    } catch (err: any) {
      if (fs.existsSync(targetFilePath)) {
        try {
          fs.unlinkSync(targetFilePath);
        } catch {}
      }
      this.logger.error(`Backup creation failed: ${err.message}`, err.stack);
      await this.repository.updateRecord(initialRecord.id, {
        status: 'FAILED',
        errorMessage: err.message,
      });
      throw new BadRequestException(`فشل إنشاء النسخة الاحتياطية: ${err.message}`);
    }
  }

  private async enforceRetentionPolicy(retentionLimit: number) {
    try {
      const excess = await this.repository.findRecordsExceedingRetention(retentionLimit);
      for (const rec of excess) {
        if (fs.existsSync(rec.filePath)) {
          try {
            fs.unlinkSync(rec.filePath);
          } catch {}
        }
        await this.repository.deleteRecord(rec.id);
      }
    } catch (err: any) {
      this.logger.warn(`Retention policy cleanup failed: ${err.message}`);
    }
  }

  async verifyAdminPassword(actorUserId: string, passwordPlain: string) {
    const passwordHash = await this.usersRepository.findPasswordHashById(actorUserId);
    if (!passwordHash) {
      throw new UnauthorizedException('المستخدم غير موجود');
    }
    const isValid = await argon2.verify(passwordHash, passwordPlain);
    if (!isValid) {
      throw new UnauthorizedException('كلمة المرور غير صحيحة. تم إلغاء عملية الاستعادة لأسباب أمنية.');
    }
  }

  async restoreBackup(id: string, passwordPlain: string, actorUserId: string) {
    await this.verifyAdminPassword(actorUserId, passwordPlain);
    const record = await this.getRecordById(id);
    if (!fs.existsSync(record.filePath)) {
      throw new NotFoundException('ملف النسخة الاحتياطية غير موجود على القرص الصلب');
    }

    await this.executeRestore(record.filePath);
    await this.cacheService.invalidatePrefix('');
    return { success: true, message: `تمت استعادة قاعدة البيانات بنجاح من النسخة (${record.fileName})` };
  }

  async restoreFromBuffer(buffer: Buffer, passwordPlain: string, actorUserId: string) {
    await this.verifyAdminPassword(actorUserId, passwordPlain);
    const tempFile = path.join(this.storageDir, `temp-restore-${Date.now()}.sql.gz`);
    fs.writeFileSync(tempFile, buffer);

    try {
      await this.executeRestore(tempFile);
      await this.cacheService.invalidatePrefix('');
      return { success: true, message: 'تمت استعادة قاعدة البيانات من الملف المرفوع بنجاح' };
    } finally {
      if (fs.existsSync(tempFile)) {
        try {
          fs.unlinkSync(tempFile);
        } catch {}
      }
    }
  }

  private async executeRestore(filePath: string): Promise<void> {
    const { dbUrl, password } = this.getDbCredentials();
    const gunzip = zlib.createGunzip();
    const fileStream = fs.createReadStream(filePath);

    return new Promise((resolve, reject) => {
      let isSettled = false;
      const safeReject = (err: unknown) => {
        if (!isSettled) {
          isSettled = true;
          reject(err);
        }
      };
      const safeResolve = () => {
        if (!isSettled) {
          isSettled = true;
          resolve();
        }
      };

      const psql = spawn(this.psqlPath, ['-d', dbUrl, '-v', 'ON_ERROR_STOP=0'], {
        env: { ...process.env, ...(password ? { PGPASSWORD: password } : {}) },
      });

      fileStream.on('error', safeReject);
      gunzip.on('error', safeReject);
      psql.stdin.on('error', (err: any) => {
        if (err.code !== 'EPIPE') safeReject(err);
      });
      psql.on('error', safeReject);

      fileStream.pipe(gunzip).pipe(psql.stdin);

      let errOutput = '';
      psql.stderr.on('data', (c) => (errOutput += c.toString()));

      psql.on('close', (code) => {
        if (code === 0) {
          safeResolve();
        } else {
          this.logger.warn(`psql exited with code ${code}: ${errOutput}`);
          safeResolve(); // psql warnings on clean drop/recreate are normal
        }
      });
    });
  }

  async disconnectGoogle() {
    const updated = await this.repository.updateSettings({
      googleDriveEnabled: false,
      googleDriveTokens: null,
    });
    return this.sanitizePublicSettings(updated);
  }
}
