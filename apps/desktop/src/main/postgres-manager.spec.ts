import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { PostgresManager, resolveSafePgDataDir } from './postgres-manager';

describe('PostgresManager', () => {
  it('routes non-ASCII/Arabic Windows user paths to safe ASCII pgdata path while keeping ASCII paths unchanged', () => {
    expect(resolveSafePgDataDir('C:\\Users\\Ahmed\\AppData\\Roaming\\EduCenter ERP', 'C:\\Users\\Public\\EduCenter-ERP')).toBe(
      path.join('C:\\Users\\Ahmed\\AppData\\Roaming\\EduCenter ERP', 'pgdata'),
    );
    expect(resolveSafePgDataDir('C:\\Users\\أحمد\\AppData\\Roaming\\EduCenter ERP', 'C:\\Users\\Public\\EduCenter-ERP')).toBe(
      path.join('C:\\Users\\Public\\EduCenter-ERP', 'pgdata'),
    );
  });
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

  it('removes stale postmaster.pid left after a crash/power outage before calling pg_ctl start', async () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'edu-pg-pid-test-'));
    const portableDir = path.join(tmpBase, 'pgsql');
    const pgDataDir = path.join(tmpBase, 'pgdata');
    fs.mkdirSync(path.join(portableDir, 'bin'), { recursive: true });
    fs.mkdirSync(pgDataDir, { recursive: true });
    fs.writeFileSync(path.join(pgDataDir, 'PG_VERSION'), '16\n', 'utf8');
    fs.writeFileSync(path.join(pgDataDir, 'postmaster.pid'), '99999\n', 'utf8');

    const execFileFn = vi.fn().mockResolvedValue({ stdout: '', stderr: '' });
    const manager = new PostgresManager({
      port: 5439,
      dataDir: tmpBase,
      portableDir,
      tcpProbeFn: vi.fn().mockResolvedValue(false),
      execFileFn,
    });

    try {
      const status = await manager.ensureStarted();
      expect(status.running).toBe(true);
      expect(status.port).toBe(5439);
      expect(fs.existsSync(path.join(pgDataDir, 'postmaster.pid'))).toBe(false);
      expect(execFileFn).toHaveBeenCalledTimes(1);
      expect(execFileFn.mock.calls[0]?.[0]).toContain('pg_ctl.exe');
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });
});
