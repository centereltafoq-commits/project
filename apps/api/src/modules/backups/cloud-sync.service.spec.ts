import * as crypto from 'crypto';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import * as zlib from 'zlib';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { SystemRole } from '@edu-center/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudSyncController } from './cloud-sync.controller';
import { CloudSyncService } from './cloud-sync.service';
import { CloudSyncManifest } from './cloud-sync.types';
import { SupabaseStorageDriver } from './drivers/supabase-storage.driver';

describe('CloudSyncService & CloudSyncController', () => {
  let service: CloudSyncService;
  let controller: CloudSyncController;
  let tempRoot: string;
  let prevStorageRoot: string | undefined;

  let mockBackupsService: any;
  let mockBackupsRepo: any;
  let mockSupabaseDriver: any;
  let mockAuditLogsService: any;

  const ownerActor = {
    id: 'owner-1',
    email: 'owner@center.com',
    fullName: 'مالك السنتر',
    roleCode: SystemRole.OWNER,
    permissions: [],
  } as any;

  const assistantActor = {
    id: 'assistant-1',
    email: 'assistant@center.com',
    fullName: 'أسستنت الاستقبال',
    roleCode: SystemRole.ATTENDANCE_EMPLOYEE,
    permissions: [],
  } as any;

  const teacherActor = {
    id: 'teacher-1',
    email: 'teacher@center.com',
    fullName: 'مدرس المادة',
    roleCode: SystemRole.TEACHER,
    permissions: [],
  } as any;

  const emptyDbStats = {
    studentsCount: 0,
    teachersCount: 0,
    groupsCount: 0,
    sessionsCount: 0,
    attendanceCount: 0,
    paymentsCount: 0,
    expensesCount: 0,
    auditCount: 0,
    lastMutationAt: null,
    centerName: 'سنتر التفوق',
    digestSource: '0|0|0|0|0|0|0|0|0|0|1|0|سنتر التفوق|0|0|0|0|0|0|0|0|0|0|0|0',
  };

  const activeDbStats = {
    ...emptyDbStats,
    studentsCount: 15,
    paymentsCount: 9,
    auditCount: 24,
    lastMutationAt: '2026-11-21T12:00:00.000Z',
    digestSource: '15|3|4|12|80|9|2|15|1|0|2|24|سنتر التفوق|active',
  };

  beforeEach(() => {
    tempRoot = path.resolve(process.cwd(), 'storage', `test-cloud-sync-${Date.now()}`);
    fs.mkdirSync(path.join(tempRoot, 'storage', 'backups'), { recursive: true });
    prevStorageRoot = process.env.STORAGE_ROOT_DIR;
    process.env.STORAGE_ROOT_DIR = tempRoot;

    mockBackupsService = {
      getStorageDir: vi.fn(() => path.join(tempRoot, 'storage', 'backups')),
      validateBackupBuffer: vi.fn((buf: Buffer) => buf),
      createBackup: vi.fn(async () => {
        const fileName = `backup-educenter-${Date.now()}.sql.gz`;
        const filePath = path.join(tempRoot, 'storage', 'backups', fileName);
        const gz = zlib.gzipSync(Buffer.from('SELECT 1;'));
        fs.writeFileSync(filePath, gz);
        return {
          id: `backup-${Date.now()}`,
          fileName,
          filePath,
          fileSizeBytes: gz.length,
          checksum: crypto.createHash('sha256').update(gz).digest('hex'),
          status: 'SUCCESS',
        };
      }),
      restoreDatabaseFromCloudSnapshot: vi.fn(async () => undefined),
    };

    mockBackupsRepo = {
      getOperationalDatabaseStats: vi.fn().mockResolvedValue(activeDbStats),
    };

    mockSupabaseDriver = {
      normalizeSupabaseUrl: vi.fn((u: string) => u.replace(/\/+$/, '')),
      validateBucketName: vi.fn((b: string) => (b || 'educenter-sync').toLowerCase()),
      ensureBucket: vi.fn().mockResolvedValue({ ok: true, bucketCreated: true }),
      getManifest: vi.fn().mockResolvedValue(null),
      uploadSnapshot: vi.fn().mockResolvedValue(undefined),
      uploadManifest: vi.fn().mockResolvedValue(undefined),
      downloadSnapshot: vi.fn(),
      deleteObjects: vi.fn().mockResolvedValue(undefined),
    };

    mockAuditLogsService = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new CloudSyncService(
      mockBackupsService,
      mockBackupsRepo,
      mockSupabaseDriver,
      mockAuditLogsService,
    );
    controller = new CloudSyncController(service);
  });

  afterEach(() => {
    if (prevStorageRoot === undefined) {
      delete process.env.STORAGE_ROOT_DIR;
    } else {
      process.env.STORAGE_ROOT_DIR = prevStorageRoot;
    }
    if (fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it('saves Supabase config, auto-creates bucket, masks secret key, and persists device identity', async () => {
    const saveRes = await service.saveConfig(
      {
        supabaseUrl: 'https://demo-center.supabase.co/',
        supabaseKey: 'service-role-secret-key-1234567890',
        bucketName: 'educenter-sync',
        deviceName: 'جهاز السنتر الرئيسي (الأسستنت)',
      },
      assistantActor,
    );

    expect(saveRes.success).toBe(true);
    expect(saveRes.bucketCreated).toBe(true);
    expect(saveRes.status.configured).toBe(true);
    expect(saveRes.status.state).toBe('REMOTE_EMPTY');
    expect(saveRes.status.hasSupabaseKey).toBe(true);
    expect(saveRes.status.supabaseKeyMasked).not.toContain('1234567890-full');
    expect(saveRes.status.supabaseKeyMasked).toContain('••••••');
    expect(mockAuditLogsService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CLOUD_SYNC_CONFIG_UPDATE',
        entityType: 'CLOUD_SYNC',
      }),
    );
  });

  it('blocks pushToCloud with ConflictException when remote has newer version unless forced', async () => {
    await service.saveConfig(
      {
        supabaseUrl: 'https://demo-center.supabase.co',
        supabaseKey: 'service-role-secret-key-1234567890',
        deviceName: 'جهاز المدير',
      },
      ownerActor,
    );

    const remoteManifest: CloudSyncManifest = {
      schemaVersion: 1,
      updatedAt: '2026-11-21T13:00:00.000Z',
      latest: {
        version: 3,
        snapshotPath: 'snapshots/v3.sql.gz',
        fileName: 'v3.sql.gz',
        checksum: 'abc',
        fileSizeBytes: 500,
        pushedAt: '2026-11-21T13:00:00.000Z',
        pushedByName: 'أسستنت المساء',
        pushedByRole: SystemRole.ATTENDANCE_EMPLOYEE,
        deviceName: 'جهاز السنتر',
        deviceId: 'other-device',
        centerName: 'سنتر التفوق',
        stats: { ...activeDbStats, fingerprint: 'fp-v3' },
      },
      history: [],
    };
    mockSupabaseDriver.getManifest.mockResolvedValue(remoteManifest);

    await expect(service.pushToCloud({ note: 'تعديل' }, ownerActor)).rejects.toThrow(
      ConflictException,
    );

    const forced = await service.pushToCloud(
      { note: 'اعتماد إجباري', force: true },
      ownerActor,
    );
    expect(forced.success).toBe(true);
    expect(forced.pushedVersion.version).toBe(4);
    expect(mockSupabaseDriver.uploadSnapshot).toHaveBeenCalledTimes(1);
    expect(mockSupabaseDriver.uploadManifest).toHaveBeenCalledTimes(1);
    expect(forced.status.state).toBe('IN_SYNC');
    expect(forced.status.hasLocalUnsyncedChanges).toBe(false);
  });

  it('blocks pullFromCloud when local device has unsynced data unless confirmed, and guards against corrupted checksum', async () => {
    await service.saveConfig(
      {
        supabaseUrl: 'https://demo-center.supabase.co',
        supabaseKey: 'service-role-secret-key-1234567890',
        deviceName: 'جهاز المدير',
      },
      ownerActor,
    );

    const validSnapshotGz = zlib.gzipSync(Buffer.from('CREATE TABLE synced_test (id int);'));
    const validChecksum = crypto.createHash('sha256').update(validSnapshotGz).digest('hex');

    const remoteManifest: CloudSyncManifest = {
      schemaVersion: 1,
      updatedAt: '2026-11-21T13:30:00.000Z',
      whatsappTemplates: [{ id: 'tpl-1', title: 'اختبار', content: 'مرحبا' }],
      latest: {
        version: 2,
        snapshotPath: 'snapshots/sync-v2.sql.gz',
        fileName: 'sync-v2.sql.gz',
        checksum: validChecksum,
        fileSizeBytes: validSnapshotGz.length,
        pushedAt: '2026-11-21T13:30:00.000Z',
        pushedByName: 'أسستنت الاستقبال',
        pushedByRole: SystemRole.ATTENDANCE_EMPLOYEE,
        deviceName: 'جهاز السنتر الرئيسي',
        deviceId: 'center-pc',
        centerName: 'سنتر التفوق',
        stats: { ...activeDbStats, fingerprint: 'fp-v2' },
      },
      history: [],
    };
    mockSupabaseDriver.getManifest.mockResolvedValue(remoteManifest);

    // First: local has operational data -> must ask confirmation before overwrite
    await expect(service.pullFromCloud({}, ownerActor)).rejects.toThrow(ConflictException);
    expect(mockBackupsService.restoreDatabaseFromCloudSnapshot).not.toHaveBeenCalled();

    // Second: corrupted buffer must be rejected BEFORE creating safety backup or restoring DB
    mockSupabaseDriver.downloadSnapshot.mockResolvedValueOnce(
      zlib.gzipSync(Buffer.from('TAMPERED SQL')),
    );
    await expect(
      service.pullFromCloud({ confirmOverwriteLocalChanges: true }, ownerActor),
    ).rejects.toThrow(/فشل التحقق من سلامة وبصمة الملف السحابي/);
    expect(mockBackupsService.createBackup).not.toHaveBeenCalled();
    expect(mockBackupsService.restoreDatabaseFromCloudSnapshot).not.toHaveBeenCalled();

    // Third: valid snapshot + confirmation -> takes safety backup, restores DB, syncs templates, reaches IN_SYNC
    mockSupabaseDriver.downloadSnapshot.mockResolvedValueOnce(validSnapshotGz);
    const pullRes = await service.pullFromCloud(
      { confirmOverwriteLocalChanges: true },
      ownerActor,
    );

    expect(pullRes.success).toBe(true);
    expect(pullRes.pulledVersion.version).toBe(2);
    expect(pullRes.safetyBackupFileName).toMatch(/^backup-educenter-/);
    expect(mockBackupsService.createBackup).toHaveBeenCalledTimes(1);
    expect(mockBackupsService.restoreDatabaseFromCloudSnapshot).toHaveBeenCalledTimes(1);
    expect(pullRes.status.lastSyncedVersion).toBe(2);
    expect(pullRes.status.state).toBe('IN_SYNC');

    const syncedTemplatesPath = path.join(
      tempRoot,
      'storage',
      'uploads',
      'whatsapp',
      'templates.json',
    );
    expect(fs.existsSync(syncedTemplatesPath)).toBe(true);
  });

  it('allows assistant and owner to push & pull, while denying teacher access', async () => {
    await expect(controller.getStatus(teacherActor)).rejects.toThrow(ForbiddenException);
    await expect(controller.pushToCloud({}, teacherActor)).rejects.toThrow(ForbiddenException);
    await expect(controller.pullFromCloud({}, teacherActor)).rejects.toThrow(ForbiddenException);

    mockBackupsRepo.getOperationalDatabaseStats.mockResolvedValue(emptyDbStats);
    const assistantStatus = await controller.getStatus(assistantActor);
    expect(assistantStatus.configured).toBe(false);

    const ownerStatus = await controller.getStatus(ownerActor);
    expect(ownerStatus.configured).toBe(false);
  });

  it('completes real HTTP two-device Push & Pull round-trip via SupabaseStorageDriver', async () => {
    const buckets = new Set<string>();
    const objects = new Map<string, Buffer>();
    const server = http.createServer((req, res) => {
      const reqUrl = (req.url || '').split('?')[0];
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const body = Buffer.concat(chunks);
        if (req.method === 'GET' && reqUrl.startsWith('/storage/v1/bucket/')) {
          const name = decodeURIComponent(reqUrl.slice('/storage/v1/bucket/'.length));
          if (!buckets.has(name)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ statusCode: '404', error: 'not_found', message: 'Bucket not found' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ id: name, name }));
          return;
        }
        if (req.method === 'POST' && reqUrl === '/storage/v1/bucket') {
          const parsed = JSON.parse(body.toString('utf8')) as {
            name: string;
            file_size_limit?: number;
          };
          if (parsed.file_size_limit && parsed.file_size_limit > 52428800) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'The object exceeded the maximum allowed size' }));
            return;
          }
          buckets.add(parsed.name);
          res.writeHead(201, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ name: parsed.name }));
          return;
        }
        if (reqUrl.startsWith('/storage/v1/object/')) {
          const rest = reqUrl.slice('/storage/v1/object/'.length);
          const slash = rest.indexOf('/');
          const bucket = decodeURIComponent(rest.slice(0, slash));
          const objKey = rest
            .slice(slash + 1)
            .split('/')
            .map(decodeURIComponent)
            .join('/');
          const mapKey = `${bucket}/${objKey}`;

          if (req.method === 'POST') {
            objects.set(mapKey, body);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ Key: mapKey }));
            return;
          }
          if (req.method === 'GET') {
            const val = objects.get(mapKey);
            if (!val) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ statusCode: '404', error: 'not_found', message: 'Object not found' }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
            res.end(val);
            return;
          }
        }
        res.writeHead(404);
        res.end('Not Found');
      });
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as any).port;
    const fakeSupabaseUrl = `http://127.0.0.1:${port}`;
    const realDriver = new SupabaseStorageDriver();

    const dirA = path.join(tempRoot, 'device-a');
    const dirB = path.join(tempRoot, 'device-b');
    fs.mkdirSync(path.join(dirA, 'storage', 'backups'), { recursive: true });
    fs.mkdirSync(path.join(dirB, 'storage', 'backups'), { recursive: true });

    try {
      let dbStateA = {
        ...activeDbStats,
        studentsCount: 25,
        paymentsCount: 14,
        digestSource: 'state-a-v1',
      };
      let dbStateB = { ...emptyDbStats };
      let cloudSqlPayload = Buffer.from('');

      const createMockBackupsForDir = (dir: string, isDeviceA: boolean) => ({
        getStorageDir: () => path.join(dir, 'storage', 'backups'),
        validateBackupBuffer: (buf: Buffer) => buf,
        createBackup: vi.fn(async () => {
          const gz = zlib.gzipSync(
            Buffer.from(
              isDeviceA
                ? 'CREATE TABLE t (id int); INSERT INTO t VALUES (1);'
                : 'CREATE TABLE t (id int); INSERT INTO t VALUES (2);',
            ),
          );
          if (isDeviceA) cloudSqlPayload = gz;
          const fileName = `backup-${Date.now()}.sql.gz`;
          const filePath = path.join(dir, 'storage', 'backups', fileName);
          fs.writeFileSync(filePath, gz);
          return {
            id: `bk-${Date.now()}`,
            fileName,
            filePath,
            fileSizeBytes: gz.length,
            checksum: crypto.createHash('sha256').update(gz).digest('hex'),
            status: 'SUCCESS',
          };
        }),
        restoreDatabaseFromCloudSnapshot: vi.fn(async (filePath: string) => {
          const restoredBytes = fs.readFileSync(filePath);
          if (restoredBytes.equals(cloudSqlPayload)) {
            dbStateB = { ...dbStateA };
          }
        }),
      });

      process.env.STORAGE_ROOT_DIR = dirA;
      const serviceA = new CloudSyncService(
        createMockBackupsForDir(dirA, true) as any,
        { getOperationalDatabaseStats: vi.fn(async () => dbStateA) } as any,
        realDriver,
        mockAuditLogsService,
      );

      process.env.STORAGE_ROOT_DIR = dirB;
      const serviceB = new CloudSyncService(
        createMockBackupsForDir(dirB, false) as any,
        { getOperationalDatabaseStats: vi.fn(async () => dbStateB) } as any,
        realDriver,
        mockAuditLogsService,
      );

      const savedA = await serviceA.saveConfig(
        {
          supabaseUrl: fakeSupabaseUrl,
          supabaseKey: 'test-service-role-key-secret',
          bucketName: 'educenter-sync',
          deviceName: 'جهاز السنتر الرئيسي',
        },
        assistantActor,
      );
      expect(savedA.bucketCreated).toBe(true);
      expect(savedA.status.state).toBe('REMOTE_EMPTY');

      const pushA = await serviceA.pushToCloud({ note: 'وردية المساء' }, assistantActor);
      expect(pushA.pushedVersion.version).toBe(1);
      expect(pushA.status.state).toBe('IN_SYNC');

      const savedB = await serviceB.saveConfig(
        {
          supabaseUrl: fakeSupabaseUrl,
          supabaseKey: 'test-service-role-key-secret',
          bucketName: 'educenter-sync',
          deviceName: 'جهاز المدير',
        },
        ownerActor,
      );
      expect(savedB.bucketCreated).toBe(false);
      expect(savedB.status.state).toBe('REMOTE_NEWER');
      expect(savedB.status.remoteLatest?.note).toBe('وردية المساء');

      const pullB = await serviceB.pullFromCloud({}, ownerActor);
      expect(pullB.pulledVersion.version).toBe(1);
      expect(pullB.status.state).toBe('IN_SYNC');
      expect(pullB.status.localStats.studentsCount).toBe(25);

      // Manager edits locally -> LOCAL_AHEAD -> pushes v2 -> Assistant sees REMOTE_NEWER
      dbStateB = { ...dbStateB, studentsCount: 26, digestSource: 'state-b-edited-v2' };
      const statusBEdited = await serviceB.getStatus();
      expect(statusBEdited.state).toBe('LOCAL_AHEAD');

      const pushB = await serviceB.pushToCloud({ note: 'تعديل المدير' }, ownerActor);
      expect(pushB.pushedVersion.version).toBe(2);
      expect(pushB.status.state).toBe('IN_SYNC');

      const statusA = await serviceA.getStatus();
      expect(statusA.state).toBe('REMOTE_NEWER');
      expect(statusA.remoteLatest?.version).toBe(2);
      expect(statusA.remoteLatest?.deviceName).toBe('جهاز المدير');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
