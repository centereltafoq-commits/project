import { execFile, spawn } from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import { promisify } from 'util';
import { resolveDesktopDataDir, resolvePortablePostgresDir } from './runtime-paths';

const execFileAsync = promisify(execFile);

async function runPostgresCommand(file: string, args: string[]): Promise<void> {
  if (args[args.length - 1] !== 'start') {
    await execFileAsync(file, args, { windowsHide: true });
    return;
  }

  // The PostgreSQL server can inherit pg_ctl's pipes on Windows and keep them open after pg_ctl exits.
  await new Promise<void>((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true, stdio: 'ignore' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`pg_ctl start exited with ${code ?? signal}. See postgres.log for details.`));
    });
  });
}

export type DatabaseSource = 'external' | 'portable' | 'none';

export function hasNonAsciiChars(targetPath: string): boolean {
  return /[^\x00-\x7F]/.test(targetPath);
}

export function getSafeAsciiRootDir(): string {
  return path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'EduCenter-ERP');
}

/**
 * Ensures PostgreSQL's `pgdata` directory stays on a pure ASCII path so `initdb.exe` and
 * `postgres.exe` never fail on Windows machines with Arabic user account names.
 */
export function resolveSafePgDataDir(
  baseDataDir: string,
  asciiRootDir = getSafeAsciiRootDir(),
): string {
  if (!hasNonAsciiChars(baseDataDir)) {
    return path.join(baseDataDir, 'pgdata');
  }
  return path.join(asciiRootDir, 'pgdata');
}

/**
 * Exposes a bundled `pgsql` folder located under a non-ASCII/Arabic folder via an ASCII
 * NTFS junction (or fallback copy) under `C:\Users\Public\EduCenter-ERP\pgsql-runtime`.
 */
export function resolveAsciiSafePostgresDir(
  portableDir: string,
  asciiRootDir = getSafeAsciiRootDir(),
): string {
  if (!hasNonAsciiChars(portableDir)) {
    return portableDir;
  }

  fs.mkdirSync(asciiRootDir, { recursive: true });
  const safeDir = path.join(asciiRootDir, 'pgsql-runtime');
  const resolvedSource = path.resolve(portableDir);

  if (fs.existsSync(safeDir)) {
    try {
      const stat = fs.lstatSync(safeDir);
      if (stat.isSymbolicLink() && path.resolve(fs.realpathSync(safeDir)) === resolvedSource) {
        return safeDir;
      }
    } catch {
      // Recreate broken link or stale directory below
    }
    try {
      fs.rmSync(safeDir, { recursive: true, force: true });
    } catch {
      // If active lock exists, return existing safe runtime if pg_ctl.exe is already present
      if (fs.existsSync(path.join(safeDir, 'bin', 'pg_ctl.exe'))) {
        return safeDir;
      }
    }
  }

  try {
    fs.symlinkSync(portableDir, safeDir, 'junction');
    return safeDir;
  } catch {
    fs.cpSync(portableDir, safeDir, { recursive: true, force: true });
    return safeDir;
  }
}

export interface DatabaseStatus {
  running: boolean;
  source: DatabaseSource;
  port: number;
  databaseUrl?: string;
  error?: string;
}

export interface PostgresManagerOptions {
  port?: number;
  dataDir?: string;
  portableDir?: string | null;
  tcpProbeFn?: (host: string, port: number) => Promise<boolean>;
  execFileFn?: (file: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;
}

/**
 * Probes whether a TCP service is already listening on host:port.
 */
export function probeTcpPort(host: string, port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

/**
 * Manages the PostgreSQL database dependency for Server Mode:
 * 1. Detects an already-running PostgreSQL instance on localhost (external/Laragon).
 * 2. Otherwise initializes and starts bundled Portable PostgreSQL cleanly inside userData.
 */
export class PostgresManager {
  private readonly port: number;
  private readonly pgDataDir: string;
  private readonly portableDirOverride?: string | null;
  private readonly tcpProbeFn: (host: string, port: number) => Promise<boolean>;
  private readonly execFileFn: (file: string, args: string[]) => Promise<unknown>;

  private startedPortable = false;
  private resolvedPortableDir: string | null = null;
  private status: DatabaseStatus;

  constructor(options?: PostgresManagerOptions) {
    this.port =
      options?.port ??
      (resolvePortablePostgresDir() && !process.env.DATABASE_URL ? 5439 : 5432);
    const baseDataDir = options?.dataDir ?? resolveDesktopDataDir();
    this.pgDataDir = resolveSafePgDataDir(baseDataDir);
    this.portableDirOverride = options?.portableDir;
    this.tcpProbeFn = options?.tcpProbeFn ?? probeTcpPort;
    this.execFileFn = options?.execFileFn ?? runPostgresCommand;
    this.status = {
      running: false,
      source: 'none',
      port: this.port,
    };
  }

  public getStatus(): DatabaseStatus {
    return { ...this.status };
  }

  private getPortableDir(): string | null {
    if (this.portableDirOverride !== undefined) {
      return this.portableDirOverride;
    }
    return resolvePortablePostgresDir();
  }

  public getResolvedPortableDir(): string | null {
    const portableDir = this.getPortableDir();
    if (!portableDir) {
      this.resolvedPortableDir = null;
      return null;
    }
    this.resolvedPortableDir = resolveAsciiSafePostgresDir(portableDir);
    return this.resolvedPortableDir;
  }

  private buildDefaultDatabaseUrl(): string {
    return `postgresql://postgres:postgres@127.0.0.1:${this.port}/edu_center_erp`;
  }

  /**
   * Ensures PostgreSQL is running and returns connection status + DATABASE_URL.
   */
  public async ensureStarted(): Promise<DatabaseStatus> {
    const alreadyListening = await this.tcpProbeFn('127.0.0.1', this.port);
    if (alreadyListening) {
      const source: DatabaseSource = this.startedPortable ? 'portable' : 'external';
      this.status = {
        running: true,
        source,
        port: this.port,
        databaseUrl: process.env.DATABASE_URL || this.buildDefaultDatabaseUrl(),
      };
      return this.getStatus();
    }

    const portableDir = this.getResolvedPortableDir();
    if (!portableDir) {
      this.status = {
        running: false,
        source: 'none',
        port: this.port,
        error:
          'قاعدة البيانات PostgreSQL غير مشغلة على المنفذ 5432 ولم يتم تضمين النسخة المحمولة. شغّل قاعدة البيانات أو استخدم النسخة الكاملة.',
      };
      return this.getStatus();
    }

    const initDbExe = path.join(portableDir, 'bin', 'initdb.exe');
    const pgCtlExe = path.join(portableDir, 'bin', 'pg_ctl.exe');
    const logFile = path.join(this.pgDataDir, 'postgres.log');

    try {
      fs.mkdirSync(this.pgDataDir, { recursive: true });
      const pidFile = path.join(this.pgDataDir, 'postmaster.pid');
      if (fs.existsSync(pidFile)) {
        try {
          fs.unlinkSync(pidFile);
          console.warn(
            '[PostgresManager] Removed stale postmaster.pid left from an unclean shutdown.',
          );
        } catch {
          // Non-fatal: pg_ctl will report exact lock state if still held
        }
      }

      if (!fs.existsSync(path.join(this.pgDataDir, 'PG_VERSION'))) {
        await this.execFileFn(initDbExe, [
          '-D',
          this.pgDataDir,
          '-U',
          'postgres',
          '-A',
          'trust',
          '-E',
          'UTF8',
          '--no-locale',
        ]);
      }

      await this.execFileFn(pgCtlExe, [
        '-D',
        this.pgDataDir,
        '-l',
        logFile,
        '-o',
        `-p ${this.port} -h 127.0.0.1`,
        '-w',
        'start',
      ]);

      this.startedPortable = true;
      this.status = {
        running: true,
        source: 'portable',
        port: this.port,
        databaseUrl: this.buildDefaultDatabaseUrl(),
      };
      return this.getStatus();
    } catch (err) {
      this.status = {
        running: false,
        source: 'none',
        port: this.port,
        error:
          err instanceof Error
            ? `تعذر تشغيل قاعدة البيانات المحمولة: ${err.message}`
            : 'تعذر تشغيل قاعدة البيانات المحمولة',
      };
      return this.getStatus();
    }
  }

  /**
   * Stops the portable PostgreSQL instance cleanly on exit if this app started it.
   */
  public async stop(): Promise<void> {
    if (!this.startedPortable) return;
    const portableDir = this.getResolvedPortableDir();
    if (!portableDir) return;

    const pgCtlExe = path.join(portableDir, 'bin', 'pg_ctl.exe');
    try {
      await this.execFileFn(pgCtlExe, ['-D', this.pgDataDir, '-m', 'fast', '-w', 'stop']);
    } catch {
      // Ignore shutdown error if process already stopped
    } finally {
      this.startedPortable = false;
      this.status = { running: false, source: 'none', port: this.port };
    }
  }
}
