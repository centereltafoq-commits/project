import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { PostgresManager } from './postgres-manager';

describe('PostgresManager', () => {
  it('reuses external PostgreSQL instance when port 5432 is already listening', async () => {
    const manager = new PostgresManager({
      port: 5432,
      tcpProbeFn: vi.fn().mockResolvedValue(true),
    });

    const status = await manager.ensureStarted();
    expect(status.running).toBe(true);
    expect(status.source).toBe('external');
    expect(status.port).toBe(5432);
  });

  it('returns clear Arabic error when PostgreSQL is stopped and portable dir is missing', async () => {
    const manager = new PostgresManager({
      port: 5432,
      portableDir: null,
      tcpProbeFn: vi.fn().mockResolvedValue(false),
    });

    const status = await manager.ensureStarted();
    expect(status.running).toBe(false);
    expect(status.source).toBe('none');
    expect(status.error).toContain('PostgreSQL');
  });

  it('initializes pgdata via initdb and starts portable pg_ctl when bundled', async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'edu-pg-test-'));
    const portableDir = path.join(tmpBase, 'pgsql');
    fs.mkdirSync(path.join(portableDir, 'bin'), { recursive: true });

    const execFileFn = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
    const manager = new PostgresManager({
      port: 5432,
      dataDir: tmpBase,
      portableDir,
      tcpProbeFn: vi.fn().mockResolvedValue(false),
      execFileFn,
    });

    try {
      const status = await manager.ensureStarted();
      expect(status.running).toBe(true);
      expect(status.source).toBe('portable');
      expect(execFileFn).toHaveBeenCalledTimes(2);
      expect(execFileFn.mock.calls[0]?.[0]).toContain('initdb.exe');
      expect(execFileFn.mock.calls[1]?.[0]).toContain('pg_ctl.exe');

      await manager.stop();
      expect(execFileFn).toHaveBeenCalledTimes(3);
      expect(execFileFn.mock.calls[2]?.[1]).toContain('stop');
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });
});
