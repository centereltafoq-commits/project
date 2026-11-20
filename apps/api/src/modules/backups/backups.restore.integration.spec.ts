import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BackupsService } from './backups.service';

const testDatabaseUrl = process.env.BACKUP_RESTORE_TEST_DATABASE_URL;
const restoreSuite = testDatabaseUrl ? describe : describe.skip;
const testId = `${process.pid}_${Date.now()}`;
const probeTable = `restore_probe_${testId}`;
const backupTable = `restore_backup_catalog_${testId}`;

restoreSuite('BackupsService - PostgreSQL restore integration', () => {
  let client: Client;
  let service: BackupsService;
  let tempDir: string;
  let backupFile: string;

  beforeAll(async () => {
    const database = new URL(testDatabaseUrl!);
    if (!database.pathname.slice(1).startsWith('edu_center_restore_test_')) {
      throw new Error(
        'BACKUP_RESTORE_TEST_DATABASE_URL must point to an isolated edu_center_restore_test_* database',
      );
    }

    client = new Client({ connectionString: testDatabaseUrl });
    await client.connect();
    await client.query(
      `CREATE TABLE public."${probeTable}" (id integer PRIMARY KEY, value text NOT NULL)`,
    );
    await client.query(
      `CREATE TABLE public."${backupTable}" (id integer PRIMARY KEY, value text NOT NULL)`,
    );
    await client.query(`INSERT INTO public."${probeTable}" VALUES (1, 'before-restore')`);
    await client.query(`INSERT INTO public."${backupTable}" VALUES (1, 'backup-catalog')`);

    const storageRoot = process.env.STORAGE_ROOT_DIR || process.cwd();
    service = new BackupsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { getOrThrow: () => testDatabaseUrl } as any,
      { invalidatePrefix: async () => undefined } as any,
      {} as any,
    );
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edu-center-restore-integration-'));
    backupFile = path.join(tempDir, 'generated-backup.sql.gz');

    const pgDumpPath = path.join(
      process.env.PG_BIN_DIR || 'C:\\laragon\\bin\\postgresql\\postgresql\\bin',
      process.platform === 'win32' ? 'pg_dump.exe' : 'pg_dump',
    );
    const dump = execFileSync(
      pgDumpPath,
      [
        '--dbname',
        testDatabaseUrl!,
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-privileges',
      ],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    fs.writeFileSync(backupFile, zlib.gzipSync(dump));
    await client.query(`UPDATE public."${probeTable}" SET value = 'after-backup'`);
    await client.query(`UPDATE public."${backupTable}" SET value = 'catalog-after-backup'`);
  });

  afterAll(async () => {
    if (client) {
      await client.query(`DROP TABLE IF EXISTS public."${probeTable}"`);
      await client.query(`DROP TABLE IF EXISTS public."${backupTable}"`);
      await client.end();
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('rolls back every restored table when a generated SQL dump fails', async () => {
    const brokenFile = path.join(tempDir, 'generated-backup-with-error.sql.gz');
    const compressed = fs.readFileSync(backupFile);
    const dump = zlib.gunzipSync(compressed);
    fs.writeFileSync(
      brokenFile,
      zlib.gzipSync(Buffer.concat([dump, Buffer.from('\nSELECT * FROM restore_table_that_does_not_exist;\n')])),
    );

    await expect((service as any).executeRestore(brokenFile)).rejects.toThrow(
      /تعذر استعادة قاعدة البيانات/,
    );

    const probe = await client.query(`SELECT value FROM public."${probeTable}" WHERE id = 1`);
    const catalog = await client.query(`SELECT value FROM public."${backupTable}" WHERE id = 1`);
    expect(probe.rows[0]?.value).toBe('after-backup');
    expect(catalog.rows[0]?.value).toBe('catalog-after-backup');
  });

  it('restores a pg_dump archive and its catalog after a successful transaction', async () => {
    await (service as any).executeRestore(backupFile);

    const probe = await client.query(`SELECT value FROM public."${probeTable}" WHERE id = 1`);
    const catalog = await client.query(`SELECT value FROM public."${backupTable}" WHERE id = 1`);
    expect(probe.rows[0]?.value).toBe('before-restore');
    expect(catalog.rows[0]?.value).toBe('backup-catalog');
  });
});
