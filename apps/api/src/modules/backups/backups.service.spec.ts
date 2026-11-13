import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { BackupsService } from './backups.service';

describe('BackupsService - Upload & Integrity', () => {
  let service: BackupsService;
  let mockRepo: any;
  let mockUsersRepo: any;
  let mockCache: any;
  let mockConfig: any;
  let mockAudit: any;
  let tempTestDir: string;

  beforeEach(() => {
    tempTestDir = path.resolve(process.cwd(), 'storage', 'test-backups-' + Date.now());
    if (!fs.existsSync(tempTestDir)) {
      fs.mkdirSync(tempTestDir, { recursive: true });
    }

    mockRepo = {
      getSettings: vi.fn(),
      updateSettings: vi.fn(),
      listRecords: vi.fn(),
      createRecord: vi.fn().mockImplementation((data) => Promise.resolve({ id: 'rec-test-1', ...data })),
      findRecordById: vi.fn(),
      updateRecord: vi.fn(),
    };

    mockUsersRepo = {
      findPasswordHashById: vi.fn(),
    };

    mockCache = {
      invalidatePrefix: vi.fn(),
    };

    mockConfig = {
      getOrThrow: vi.fn().mockReturnValue('postgres://user:pass@localhost:5432/edu_center'),
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new BackupsService(
      mockRepo,
      {} as any,
      {} as any,
      mockUsersRepo,
      mockConfig,
      mockCache,
      mockAudit,
    );

    // Override storageDir to our test temp directory
    (service as any).storageDir = tempTestDir;
  });

  afterEach(() => {
    if (fs.existsSync(tempTestDir)) {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    }
  });

  it('rejects unsupported file extensions', async () => {
    const invalidFile = {
      originalname: 'document.pdf',
      buffer: Buffer.from('some-content'),
    } as any;

    await expect(service.uploadBackupFile(invalidFile)).rejects.toThrow(BadRequestException);
  });

  it('accepts and automatically gzips plain .sql backup file', async () => {
    const sqlContent = 'CREATE TABLE test (id int); INSERT INTO test VALUES (1);';
    const sqlFile = {
      originalname: 'database_dump.sql',
      buffer: Buffer.from(sqlContent, 'utf-8'),
    } as any;

    const record = await service.uploadBackupFile(sqlFile, 'actor-1');

    expect(record).toBeDefined();
    expect(record.triggerType).toBe('UPLOADED');
    expect(record.fileName).toMatch(/^upload-database_dump-.*\.sql\.gz$/);
    expect(record.checksum).toHaveLength(64);
    expect(fs.existsSync(record.filePath)).toBe(true);

    // Verify file on disk is valid gzip that decompresses to our SQL
    const fileBytes = fs.readFileSync(record.filePath);
    const decompressed = zlib.gunzipSync(fileBytes).toString('utf-8');
    expect(decompressed).toBe(sqlContent);
  });

  it('accepts already gzipped .sql.gz backup file without double-compressing', async () => {
    const sqlContent = 'SELECT 42;';
    const gzippedBuffer = zlib.gzipSync(Buffer.from(sqlContent, 'utf-8'));
    const gzFile = {
      originalname: 'backup_export.sql.gz',
      buffer: gzippedBuffer,
    } as any;

    const record = await service.uploadBackupFile(gzFile, 'actor-2');

    expect(record).toBeDefined();
    expect(record.triggerType).toBe('UPLOADED');
    expect(record.checksum).toHaveLength(64);

    const fileBytes = fs.readFileSync(record.filePath);
    const decompressed = zlib.gunzipSync(fileBytes).toString('utf-8');
    expect(decompressed).toBe(sqlContent);
  });

  it('rejects .sql.gz with missing gzip magic bytes', async () => {
    const invalidGz = {
      originalname: 'fake_archive.sql.gz',
      buffer: Buffer.from('this is plain text not gzip'),
    } as any;

    await expect(service.uploadBackupFile(invalidGz)).rejects.toThrow(
      'ملف النسخة المضغوطة (.sql.gz) تالف أو غير صالح. الملف لا يحتوي على بيانات Gzip صحيحة',
    );
  });

  it('rejects corrupted or truncated .sql.gz files', async () => {
    // Starts with gzip magic bytes 0x1f, 0x8b but followed by garbage
    const corruptedGz = {
      originalname: 'corrupt.sql.gz',
      buffer: Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x12, 0x34]),
    } as any;

    await expect(service.uploadBackupFile(corruptedGz)).rejects.toThrow(
      /فشل التحقق من سلامة الملف المضغوط/,
    );
  });

  it('rejects binary executable files disguised as .sql', async () => {
    const binaryData = Buffer.concat([
      Buffer.from('MZ'),
      Buffer.from([0x00, 0x00, 0x01, 0x00]),
      Buffer.from('Fake executable'),
    ]);
    const binaryFile = {
      originalname: 'malicious.sql',
      buffer: binaryData,
    } as any;

    await expect(service.uploadBackupFile(binaryFile)).rejects.toThrow(
      'محتوى ملف SQL غير صالح. الملف يبدو أنه ملف ثنائي تنفيذي وليس ملف نصي لأوامر SQL',
    );
  });

  it('rejects gzipped archive that does not contain SQL statements', async () => {
    const nonSqlGz = {
      originalname: 'random_text.sql.gz',
      buffer: zlib.gzipSync(Buffer.from('hello world, just plain text without any sql statements')),
    } as any;

    await expect(service.uploadBackupFile(nonSqlGz)).rejects.toThrow(
      'ملف النسخة الاحتياطية لا يحتوي على أوامر SQL صالحة لقاعدة البيانات',
    );
  });

  it('rejects empty or whitespace-only .sql files', async () => {
    const emptyFile = {
      originalname: 'empty.sql',
      buffer: Buffer.from('   \n\t  '),
    } as any;

    await expect(service.uploadBackupFile(emptyFile)).rejects.toThrow(
      'ملف SQL فارغ ولا يحتوي على أوامر قاعدة البيانات',
    );
  });

  it('rejects restoreBackup when status is FAILED or IN_PROGRESS', async () => {
    service.verifyAdminPassword = vi.fn().mockResolvedValue(undefined as never);
    mockRepo.findRecordById.mockResolvedValue({
      id: 'rec-failed-1',
      fileName: 'failed.sql.gz',
      filePath: path.join(tempTestDir, 'failed.sql.gz'),
      status: 'FAILED',
    });

    await expect(
      service.restoreBackup('rec-failed-1', 'password123', 'admin-id'),
    ).rejects.toThrow(/لا يمكن استعادة نسخة احتياطية غير مكتملة أو فاشلة/);
  });

  it('upgrades DROP TABLE IF EXISTS statements to CASCADE during restore prep', () => {
    const sql = 'DROP TABLE IF EXISTS public.system_settings;\nCREATE TABLE public.system_settings ();';
    const prepared = (service as any).prepareRestoreSql(sql);
    expect(prepared).toContain('DROP TABLE IF EXISTS public.system_settings CASCADE;');
  });

  it('rejects restoreBackup when checksum does not match', async () => {
    service.verifyAdminPassword = vi.fn().mockResolvedValue(undefined as never);

    const testFile = path.join(tempTestDir, 'test-checksum.sql.gz');
    fs.writeFileSync(testFile, zlib.gzipSync(Buffer.from('SELECT 1;')));

    mockRepo.findRecordById.mockResolvedValue({
      id: 'rec-checksum-1',
      fileName: 'test-checksum.sql.gz',
      filePath: testFile,
      checksum: 'different-checksum-than-actual',
    });

    await expect(
      service.restoreBackup('rec-checksum-1', 'password123', 'admin-id'),
    ).rejects.toThrow(/فشل التحقق من تطابق كود التشفير \(Checksum\)/);
  });
});
