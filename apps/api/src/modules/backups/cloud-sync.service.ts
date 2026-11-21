import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { BackupsRepository } from './backups.repository';
import { BackupsService } from './backups.service';
import {
  CloudSyncDatabaseStats,
  CloudSyncLocalConfig,
  CloudSyncManifest,
  CloudSyncPullResult,
  CloudSyncPushResult,
  CloudSyncStateCode,
  CloudSyncStatusResponse,
  CloudSyncVersionEntry,
} from './cloud-sync.types';
import { SupabaseStorageDriver } from './drivers/supabase-storage.driver';
import {
  PullCloudSyncDto,
  PushCloudSyncDto,
  TestCloudSyncConnectionDto,
  UpdateCloudSyncConfigDto,
} from './dto/cloud-sync.dto';

const DEFAULT_BUCKET_NAME = 'educenter-sync';
const MAX_REMOTE_HISTORY = 15;

@Injectable()
export class CloudSyncService {
  private readonly logger = new Logger(CloudSyncService.name);
  private readonly configDir: string;
  private readonly configFilePath: string;
  private readonly whatsappTemplatesPath: string;
  private isSyncInProgress = false;

  constructor(
    private readonly backupsService: BackupsService,
    private readonly backupsRepository: BackupsRepository,
    private readonly supabaseDriver: SupabaseStorageDriver,
    private readonly auditLogsService: AuditLogsService,
  ) {
    const storageRoot = process.env.STORAGE_ROOT_DIR || process.cwd();
    this.configDir = path.resolve(storageRoot, 'storage', 'cloud-sync');
    this.configFilePath = path.join(this.configDir, 'sync-config.json');
    this.whatsappTemplatesPath = path.resolve(
      storageRoot,
      'storage',
      'uploads',
      'whatsapp',
      'templates.json',
    );
  }

  private ensureConfigDir(): void {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  private readLocalConfig(): CloudSyncLocalConfig {
    this.ensureConfigDir();
    if (fs.existsSync(this.configFilePath)) {
      try {
        const raw = fs.readFileSync(this.configFilePath, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<CloudSyncLocalConfig>;
        return {
          enabled: Boolean(parsed.enabled ?? true),
          supabaseUrl: String(parsed.supabaseUrl || ''),
          supabaseKey: String(parsed.supabaseKey || ''),
          bucketName: String(parsed.bucketName || DEFAULT_BUCKET_NAME),
          deviceId: String(parsed.deviceId || crypto.randomUUID()),
          deviceName: String(parsed.deviceName || os.hostname() || 'جهاز السنتر'),
          lastSyncedVersion: Number(parsed.lastSyncedVersion || 0),
          lastSyncedChecksum: parsed.lastSyncedChecksum ?? null,
          lastSyncedFingerprint: parsed.lastSyncedFingerprint ?? null,
          lastSyncedAt: parsed.lastSyncedAt ?? null,
          lastPushedAt: parsed.lastPushedAt ?? null,
          lastPulledAt: parsed.lastPulledAt ?? null,
        };
      } catch (err: any) {
        this.logger.warn(`Failed parsing sync-config.json, resetting defaults: ${err?.message}`);
      }
    }

    const initial: CloudSyncLocalConfig = {
      enabled: false,
      supabaseUrl: '',
      supabaseKey: '',
      bucketName: DEFAULT_BUCKET_NAME,
      deviceId: crypto.randomUUID(),
      deviceName: os.hostname() || 'جهاز السنتر',
      lastSyncedVersion: 0,
      lastSyncedChecksum: null,
      lastSyncedFingerprint: null,
      lastSyncedAt: null,
      lastPushedAt: null,
      lastPulledAt: null,
    };
    this.writeLocalConfigAtomic(initial);
    return initial;
  }

  private writeLocalConfigAtomic(config: CloudSyncLocalConfig): void {
    this.ensureConfigDir();
    const tmpPath = `${this.configFilePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(config, null, 2), 'utf-8');
    fs.renameSync(tmpPath, this.configFilePath);
  }

  private maskSecretKey(secret: string): string | null {
    const clean = (secret || '').trim();
    if (!clean) return null;
    if (clean.length <= 12) return '••••••••';
    return `${clean.slice(0, 6)}••••••${clean.slice(-4)}`;
  }

  private resolveSecretKey(
    incomingKey: string | undefined,
    existingKey: string,
  ): string {
    const trimmed = (incomingKey || '').trim();
    if (!trimmed || trimmed.includes('••••••') || trimmed === '••••••••') {
      return existingKey;
    }
    return trimmed;
  }

  private readWhatsappTemplatesSnapshot(): {
    templates: unknown[] | null;
    contentHash: string;
  } {
    try {
      if (!fs.existsSync(this.whatsappTemplatesPath)) {
        return { templates: null, contentHash: 'none' };
      }
      const raw = fs.readFileSync(this.whatsappTemplatesPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return { templates: null, contentHash: 'invalid' };
      }
      const canonical = JSON.stringify(parsed);
      const contentHash = crypto
        .createHash('sha256')
        .update(canonical)
        .digest('hex')
        .slice(0, 16);
      return { templates: parsed, contentHash };
    } catch {
      return { templates: null, contentHash: 'error' };
    }
  }

  private writeWhatsappTemplatesSnapshot(templates: unknown[] | null | undefined): void {
    if (!Array.isArray(templates)) return;
    try {
      const dir = path.dirname(this.whatsappTemplatesPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${this.whatsappTemplatesPath}.sync.${Date.now()}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(templates, null, 2), 'utf-8');
      fs.renameSync(tmpPath, this.whatsappTemplatesPath);
    } catch (err: any) {
      this.logger.warn(`Failed syncing whatsapp templates file: ${err?.message}`);
    }
  }

  async computeDatabaseStats(): Promise<{
    stats: CloudSyncDatabaseStats;
    centerName: string;
  }> {
    const raw = await this.backupsRepository.getOperationalDatabaseStats();
    const { contentHash } = this.readWhatsappTemplatesSnapshot();
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${raw.digestSource}|tpl:${contentHash}`)
      .digest('hex')
      .slice(0, 24);

    return {
      centerName: raw.centerName,
      stats: {
        studentsCount: raw.studentsCount,
        teachersCount: raw.teachersCount,
        groupsCount: raw.groupsCount,
        sessionsCount: raw.sessionsCount,
        attendanceCount: raw.attendanceCount,
        paymentsCount: raw.paymentsCount,
        expensesCount: raw.expensesCount,
        auditCount: raw.auditCount,
        lastMutationAt: raw.lastMutationAt,
        fingerprint,
      },
    };
  }

  private hasOperationalData(stats: CloudSyncDatabaseStats): boolean {
    return (
      stats.studentsCount > 0 ||
      stats.teachersCount > 0 ||
      stats.groupsCount > 0 ||
      stats.sessionsCount > 0 ||
      stats.attendanceCount > 0 ||
      stats.paymentsCount > 0 ||
      stats.expensesCount > 0
    );
  }

  private computeHasUnsyncedLocalChanges(
    config: CloudSyncLocalConfig,
    localStats: CloudSyncDatabaseStats,
  ): boolean {
    if (config.lastSyncedFingerprint) {
      return config.lastSyncedFingerprint !== localStats.fingerprint;
    }
    return this.hasOperationalData(localStats);
  }

  private buildStateMessage(
    state: CloudSyncStateCode,
    remoteLatest: CloudSyncVersionEntry | null,
    connectionError?: string | null,
  ): string {
    switch (state) {
      case 'NOT_CONFIGURED':
        return 'لم يتم ربط حساب Supabase السحابي بعد. اضغط إعداد الربط لإدخال بيانات المشروع.';
      case 'CONNECTION_ERROR':
        return connectionError || 'تعذر الوصول إلى سحابة Supabase حالياً (تأكد من اتصال الإنترنت).';
      case 'REMOTE_EMPTY':
        return 'الربط السحابي جاهز، ولا توجد أي نسخ منشورة على السحابة حتى الآن. يمكنك نشر النسخة الأولى الآن.';
      case 'IN_SYNC':
        return `الجهاز متزامن تماماً مع السحابة على الإصدار v${remoteLatest?.version ?? 0}.`;
      case 'LOCAL_AHEAD':
        return 'توجد تعديلات محلية جديدة على هذا الجهاز لم يتم نشرها للسحابة بعد.';
      case 'REMOTE_NEWER':
        return `توجد نسخة أحدث على السحابة (v${remoteLatest?.version ?? '?'}) منشورة من جهاز "${remoteLatest?.deviceName ?? ''}".`;
      case 'CONFLICT':
        return `تنبيه: توجد نسخة أحدث على السحابة (v${remoteLatest?.version ?? '?'}) وفي نفس الوقت لديك تعديلات محلية لم تُنشر بعد.`;
    }
  }

  async getStatus(): Promise<CloudSyncStatusResponse> {
    const config = this.readLocalConfig();
    const { stats: localStats } = await this.computeDatabaseStats();
    const hasLocalUnsyncedChanges = this.computeHasUnsyncedLocalChanges(config, localStats);
    const configured = Boolean(config.enabled && config.supabaseUrl && config.supabaseKey);

    let state: CloudSyncStateCode = 'NOT_CONFIGURED';
    let remoteLatest: CloudSyncVersionEntry | null = null;
    let remoteHistory: CloudSyncVersionEntry[] = [];
    let connectionError: string | null = null;

    if (configured) {
      try {
        const manifest = await this.supabaseDriver.getManifest({
          supabaseUrl: config.supabaseUrl,
          supabaseKey: config.supabaseKey,
          bucketName: config.bucketName,
        });

        if (!manifest) {
          state = 'REMOTE_EMPTY';
        } else {
          remoteLatest = manifest.latest;
          remoteHistory = Array.isArray(manifest.history) ? manifest.history : [manifest.latest];
          const remoteIsNewer =
            manifest.latest.version > config.lastSyncedVersion ||
            (manifest.latest.version === config.lastSyncedVersion &&
              Boolean(config.lastSyncedChecksum) &&
              manifest.latest.checksum !== config.lastSyncedChecksum);

          if (remoteIsNewer && hasLocalUnsyncedChanges) {
            state = 'CONFLICT';
          } else if (remoteIsNewer) {
            state = 'REMOTE_NEWER';
          } else if (hasLocalUnsyncedChanges) {
            state = 'LOCAL_AHEAD';
          } else {
            state = 'IN_SYNC';
          }
        }
      } catch (err: any) {
        state = 'CONNECTION_ERROR';
        connectionError = err?.message || 'تعذر الاتصال بسحابة Supabase';
      }
    }

    return {
      configured,
      enabled: config.enabled,
      state,
      stateMessageAr: this.buildStateMessage(state, remoteLatest, connectionError),
      deviceId: config.deviceId,
      deviceName: config.deviceName,
      supabaseUrl: config.supabaseUrl,
      supabaseKeyMasked: this.maskSecretKey(config.supabaseKey),
      hasSupabaseKey: Boolean(config.supabaseKey),
      bucketName: config.bucketName,
      lastSyncedVersion: config.lastSyncedVersion,
      lastSyncedAt: config.lastSyncedAt,
      lastPushedAt: config.lastPushedAt,
      lastPulledAt: config.lastPulledAt,
      hasLocalUnsyncedChanges,
      localStats,
      remoteLatest,
      remoteHistory,
      connectionError,
      checkedAt: new Date().toISOString(),
    };
  }

  async testConnection(
    dto: TestCloudSyncConnectionDto,
  ): Promise<{ ok: boolean; bucketCreated: boolean; message: string }> {
    const config = this.readLocalConfig();
    const resolvedUrl = this.supabaseDriver.normalizeSupabaseUrl(dto.supabaseUrl);
    const resolvedBucket = this.supabaseDriver.validateBucketName(
      dto.bucketName || config.bucketName || DEFAULT_BUCKET_NAME,
    );
    const resolvedKey = this.resolveSecretKey(dto.supabaseKey, config.supabaseKey);

    if (!resolvedKey) {
      throw new BadRequestException('مفتاح Supabase (service_role) مطلوب لفحص الاتصال');
    }

    const result = await this.supabaseDriver.ensureBucket({
      supabaseUrl: resolvedUrl,
      supabaseKey: resolvedKey,
      bucketName: resolvedBucket,
    });

    if (!result.ok) {
      throw new BadRequestException(result.error || 'تعذر الاتصال بمشروع Supabase');
    }

    return {
      ok: true,
      bucketCreated: result.bucketCreated,
      message: result.bucketCreated
        ? `تم الاتصال بمشروع Supabase بنجاح وتم إنشاء حاوية التخزين الخاصة (${resolvedBucket}) تلقائياً.`
        : `تم الاتصال بمشروع Supabase والتحقق من جاهزية حاوية التخزين (${resolvedBucket}) بنجاح.`,
    };
  }

  async saveConfig(
    dto: UpdateCloudSyncConfigDto,
    actor?: AuthenticatedUser,
  ): Promise<{
    success: boolean;
    bucketCreated: boolean;
    message: string;
    status: CloudSyncStatusResponse;
  }> {
    const existing = this.readLocalConfig();
    const normalizedUrl = this.supabaseDriver.normalizeSupabaseUrl(dto.supabaseUrl);
    const normalizedBucket = this.supabaseDriver.validateBucketName(
      dto.bucketName || existing.bucketName || DEFAULT_BUCKET_NAME,
    );
    const resolvedKey = this.resolveSecretKey(dto.supabaseKey, existing.supabaseKey);

    if (!resolvedKey) {
      throw new BadRequestException('يرجى إدخال مفتاح الصلاحية (service_role key) من مشروع Supabase');
    }

    const check = await this.supabaseDriver.ensureBucket({
      supabaseUrl: normalizedUrl,
      supabaseKey: resolvedKey,
      bucketName: normalizedBucket,
    });

    if (!check.ok) {
      throw new BadRequestException(check.error || 'تعذر التحقق من اتصال Supabase');
    }

    const updated: CloudSyncLocalConfig = {
      ...existing,
      enabled: dto.enabled ?? true,
      supabaseUrl: normalizedUrl,
      supabaseKey: resolvedKey,
      bucketName: normalizedBucket,
      deviceName: dto.deviceName.trim(),
    };

    this.writeLocalConfigAtomic(updated);

    await this.auditLogsService.record({
      actorUserId: actor?.id ?? null,
      actorName: actor?.fullName ?? null,
      action: 'CLOUD_SYNC_CONFIG_UPDATE',
      entityType: 'CLOUD_SYNC',
      entityId: updated.deviceId,
      afterData: {
        supabaseUrl: updated.supabaseUrl,
        bucketName: updated.bucketName,
        deviceName: updated.deviceName,
        enabled: updated.enabled,
      },
    });

    const status = await this.getStatus();
    return {
      success: true,
      bucketCreated: check.bucketCreated,
      message: check.bucketCreated
        ? `تم ربط Supabase بنجاح وتجهيز حاوية المزامنة (${normalizedBucket}) تلقائياً.`
        : 'تم حفظ إعدادات الربط السحابي (Supabase) والتحقق من جاهزيتها بنجاح.',
      status,
    };
  }

  async pushToCloud(
    dto: PushCloudSyncDto,
    actor?: AuthenticatedUser,
  ): Promise<CloudSyncPushResult> {
    if (this.isSyncInProgress) {
      throw new ConflictException('توجد عملية مزامنة سحابية قيد التنفيذ حالياً، يرجى الانتظار لحظات.');
    }

    const config = this.readLocalConfig();
    if (!config.enabled || !config.supabaseUrl || !config.supabaseKey) {
      throw new BadRequestException(
        'لم يتم إعداد الربط السحابي مع Supabase بعد. افتح تبويب «إعدادات الربط بـ Supabase» وأكمل الربط أولاً.',
      );
    }

    this.isSyncInProgress = true;
    try {
      const creds = {
        supabaseUrl: config.supabaseUrl,
        supabaseKey: config.supabaseKey,
        bucketName: config.bucketName,
      };

      const bucketCheck = await this.supabaseDriver.ensureBucket(creds);
      if (!bucketCheck.ok) {
        throw new BadRequestException(bucketCheck.error || 'تعذر الوصول إلى تخزين Supabase');
      }

      const remoteManifest = await this.supabaseDriver.getManifest(creds);
      if (
        remoteManifest &&
        remoteManifest.latest.version > config.lastSyncedVersion &&
        !dto.force
      ) {
        throw new ConflictException(
          `توجد نسخة أحدث منشورة على السحابة (الإصدار v${remoteManifest.latest.version}) بواسطة "${remoteManifest.latest.pushedByName}" من جهاز "${remoteManifest.latest.deviceName}". يُرجى سحب آخر التعديلات أولاً أو تفعيل خيار النشر الإجباري.`,
        );
      }

      const { stats, centerName } = await this.computeDatabaseStats();
      const backupRecord = await this.backupsService.createBackup('MANUAL', actor);
      const gzBuffer = fs.readFileSync(backupRecord.filePath);
      this.backupsService.validateBackupBuffer(gzBuffer, true);
      const checksum = crypto.createHash('sha256').update(gzBuffer).digest('hex');

      const nextVersion = (remoteManifest?.latest?.version ?? 0) + 1;
      const nowIso = new Date().toISOString();
      const safeFileName = `sync-v${nextVersion}-${backupRecord.fileName}`;
      const snapshotPath = `snapshots/${safeFileName}`;

      await this.supabaseDriver.uploadSnapshot(creds, snapshotPath, gzBuffer);

      const newEntry: CloudSyncVersionEntry = {
        version: nextVersion,
        snapshotPath,
        fileName: safeFileName,
        checksum,
        fileSizeBytes: gzBuffer.length,
        pushedAt: nowIso,
        pushedByName: actor?.fullName || 'مسؤول النظام',
        pushedByRole: actor?.roleCode || 'OWNER',
        deviceName: config.deviceName,
        deviceId: config.deviceId,
        centerName,
        note: dto.note?.trim() || null,
        stats,
      };

      const previousHistory = Array.isArray(remoteManifest?.history)
        ? remoteManifest!.history
        : remoteManifest?.latest
          ? [remoteManifest.latest]
          : [];
      const keptHistory = [newEntry, ...previousHistory].slice(0, MAX_REMOTE_HISTORY);
      const evictedPaths = previousHistory
        .slice(MAX_REMOTE_HISTORY - 1)
        .map((item) => item.snapshotPath)
        .filter((p) => p && p !== snapshotPath);

      const { templates } = this.readWhatsappTemplatesSnapshot();

      const updatedManifest: CloudSyncManifest = {
        schemaVersion: 1,
        latest: newEntry,
        history: keptHistory,
        whatsappTemplates: templates ?? remoteManifest?.whatsappTemplates ?? null,
        updatedAt: nowIso,
      };

      await this.supabaseDriver.uploadManifest(creds, updatedManifest);

      if (evictedPaths.length > 0) {
        await this.supabaseDriver.deleteObjects(creds, evictedPaths);
      }

      await this.auditLogsService.record({
        actorUserId: actor?.id ?? null,
        actorName: actor?.fullName ?? null,
        action: 'CLOUD_SYNC_PUSH',
        entityType: 'CLOUD_SYNC',
        entityId: `v${nextVersion}`,
        afterData: {
          version: nextVersion,
          fileName: safeFileName,
          fileSizeBytes: gzBuffer.length,
          checksum,
          deviceName: config.deviceName,
          note: newEntry.note,
          studentsCount: stats.studentsCount,
          paymentsCount: stats.paymentsCount,
        },
      });

      const postPush = await this.computeDatabaseStats();
      const updatedConfig: CloudSyncLocalConfig = {
        ...config,
        lastSyncedVersion: nextVersion,
        lastSyncedChecksum: checksum,
        lastSyncedFingerprint: postPush.stats.fingerprint,
        lastSyncedAt: nowIso,
        lastPushedAt: nowIso,
      };
      this.writeLocalConfigAtomic(updatedConfig);

      const status = await this.getStatus();
      return {
        success: true,
        message: `تم نشر كافة التعديلات والبيانات إلى السحابة بنجاح (الإصدار v${nextVersion}).`,
        pushedVersion: newEntry,
        status,
      };
    } finally {
      this.isSyncInProgress = false;
    }
  }

  async pullFromCloud(
    dto: PullCloudSyncDto,
    actor?: AuthenticatedUser,
  ): Promise<CloudSyncPullResult> {
    if (this.isSyncInProgress) {
      throw new ConflictException('توجد عملية مزامنة سحابية قيد التنفيذ حالياً، يرجى الانتظار لحظات.');
    }

    const config = this.readLocalConfig();
    if (!config.enabled || !config.supabaseUrl || !config.supabaseKey) {
      throw new BadRequestException(
        'لم يتم إعداد الربط السحابي مع Supabase بعد. افتح تبويب «إعدادات الربط بـ Supabase» وأكمل الربط أولاً.',
      );
    }

    this.isSyncInProgress = true;
    let tempPullPath: string | null = null;
    try {
      const creds = {
        supabaseUrl: config.supabaseUrl,
        supabaseKey: config.supabaseKey,
        bucketName: config.bucketName,
      };

      const remoteManifest = await this.supabaseDriver.getManifest(creds);
      if (!remoteManifest) {
        throw new BadRequestException(
          'لا توجد أي بيانات منشورة على السحابة حتى الآن. يجب نشر التعديلات من جهاز السنتر أولاً.',
        );
      }

      const candidates = [
        remoteManifest.latest,
        ...(Array.isArray(remoteManifest.history) ? remoteManifest.history : []),
      ];
      const targetEntry = dto.targetVersion
        ? candidates.find((item) => item.version === dto.targetVersion)
        : remoteManifest.latest;

      if (!targetEntry) {
        throw new NotFoundException(`الإصدار السحابي المطلوب (v${dto.targetVersion}) غير موجود`);
      }

      const { stats: prePullStats } = await this.computeDatabaseStats();
      const hasUnsyncedLocal = this.computeHasUnsyncedLocalChanges(config, prePullStats);
      if (hasUnsyncedLocal && !dto.confirmOverwriteLocalChanges) {
        throw new ConflictException(
          'لديك بيانات أو تعديلات محلية لم تُنشر إلى السحابة بعد. سيقوم النظام بأخذ نسخة احتياطية محلية تلقائية لحماية بياناتك قبل الاستبدال؛ يرجى تأكيد السحب للمتابعة.',
        );
      }

      const downloadedBuffer = await this.supabaseDriver.downloadSnapshot(
        creds,
        targetEntry.snapshotPath,
      );
      if (!downloadedBuffer || downloadedBuffer.length === 0) {
        throw new BadRequestException('ملف النسخة السحابية المُحمّل فارغ أو تالف');
      }

      const computedChecksum = crypto
        .createHash('sha256')
        .update(downloadedBuffer)
        .digest('hex');
      if (targetEntry.checksum && computedChecksum !== targetEntry.checksum) {
        throw new BadRequestException(
          'فشل التحقق من سلامة وبصمة الملف السحابي (Checksum Mismatch). تم إيقاف الاستعادة لحماية قاعدة البيانات المحلية.',
        );
      }

      this.backupsService.validateBackupBuffer(downloadedBuffer, true);

      // Mandatory safety backup on local disk BEFORE applying remote snapshot
      const safetyBackup = await this.backupsService.createBackup('MANUAL', actor);

      const safeTempName = `temp-cloud-pull-v${targetEntry.version}-${Date.now()}.sql.gz`;
      tempPullPath = path.join(this.backupsService.getStorageDir(), safeTempName);
      fs.writeFileSync(tempPullPath, downloadedBuffer);

      await this.backupsService.restoreDatabaseFromCloudSnapshot(tempPullPath);

      if (
        targetEntry.version === remoteManifest.latest.version &&
        Array.isArray(remoteManifest.whatsappTemplates)
      ) {
        this.writeWhatsappTemplatesSnapshot(remoteManifest.whatsappTemplates);
      }

      await this.auditLogsService.record({
        actorUserId: actor?.id ?? null,
        actorName: actor?.fullName ?? null,
        action: 'CLOUD_SYNC_PULL',
        entityType: 'CLOUD_SYNC',
        entityId: `v${targetEntry.version}`,
        afterData: {
          pulledVersion: targetEntry.version,
          fromDeviceName: targetEntry.deviceName,
          fromUserName: targetEntry.pushedByName,
          checksum: targetEntry.checksum,
          safetyBackupFileName: safetyBackup.fileName,
        },
      });

      const postPull = await this.computeDatabaseStats();
      const nowIso = new Date().toISOString();
      const updatedConfig: CloudSyncLocalConfig = {
        ...config,
        lastSyncedVersion: targetEntry.version,
        lastSyncedChecksum: targetEntry.checksum,
        lastSyncedFingerprint: postPull.stats.fingerprint,
        lastSyncedAt: nowIso,
        lastPulledAt: nowIso,
      };
      this.writeLocalConfigAtomic(updatedConfig);

      const status = await this.getStatus();
      return {
        success: true,
        message: `تم سحب وتحديث البيانات بنجاح من الإصدار السحابي (v${targetEntry.version}) مع حفظ نسخة أمان محلية (${safetyBackup.fileName}).`,
        pulledVersion: targetEntry,
        safetyBackupFileName: safetyBackup.fileName,
        status,
      };
    } finally {
      if (tempPullPath && fs.existsSync(tempPullPath)) {
        try {
          fs.unlinkSync(tempPullPath);
        } catch {}
      }
      this.isSyncInProgress = false;
    }
  }
}
