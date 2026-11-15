import { execFile } from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import * as path from 'path';
import { promisify } from 'util';
import { resolveDesktopDataDir, resolvePortablePostgresDir } from './runtime-paths';

const execFileAsync = promisify(execFile);

export type DatabaseSource = 'external' | 'portable' | 'none';

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
  private readonly execFileFn: (
    file: string,
    args: string[],
  ) => Promise<{ stdout: string; stderr: string }>;

  private startedPortable = false;
  private status: DatabaseStatus;

  constructor(options?: PostgresManagerOptions) {
    this.port = options?.port ?? 5432;
    const baseDataDir = options?.dataDir ?? resolveDesktopDataDir();
    this.pgDataDir = path.join(baseDataDir, 'pgdata');
    this.portableDirOverride = options?.portableDir;
    this.tcpProbeFn = options?.tcpProbeFn ?? probeTcpPort;
    this.execFileFn =
      options?.execFileFn ??
      (async (file, args) => {
        const res = await execFileAsync(file, args, { windowsHide: true });
        return { stdout: String(res.stdout ?? ''), stderr: String(res.stderr ?? '') };
      });
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

    const portableDir = this.getPortableDir();
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
    const portableDir = this.getPortableDir();
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
