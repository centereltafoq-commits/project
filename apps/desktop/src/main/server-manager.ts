import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import { testServerConnection } from './network-utils';
import { DatabaseStatus, PostgresManager, resolveAsciiSafePostgresDir } from './postgres-manager';
import {
  ensureRuntimeSecrets,
  resolveApiDistPath,
  resolveApiDrizzleDir,
  resolveDesktopDataDir,
  resolveNodeRuntimeCommand,
  resolvePortablePostgresDir,
  resolveWebDistPath,
} from './runtime-paths';

/**
 * Real-time operational status of the embedded NestJS API server process.
 */
export interface ServerStatus {
  running: boolean;
  pid?: number;
  port: number;
  uptime?: number;
  error?: string;
  database?: DatabaseStatus;
}

/**
 * Options used to configure the ServerManager instance.
 */
export interface ServerManagerOptions {
  apiDistPath?: string;
  port?: number;
  nodeExecutable?: string;
  postgresManager?: PostgresManager;
  spawnFunction?: typeof spawn;
  healthCheckFunction?: typeof testServerConnection;
  onRunningChange?: (running: boolean) => void;
}

/**
 * Manages the lifecycle of the local NestJS background backend process (and optional
 * embedded Portable PostgreSQL manager), using Electron's embedded Node engine in
 * production so teachers never need to install Node.js separately.
 */
export class ServerManager {
  private childProcess: ChildProcess | null = null;
  private apiDistPath: string;
  private port: number;
  private nodeExecutable?: string;
  private postgresManager?: PostgresManager;
  private spawnFn: typeof spawn;
  private healthCheckFn: typeof testServerConnection;
  private onRunningChange?: (running: boolean) => void;
  private startTime: number | null = null;
  private lastError?: string;
  private lastStderrLine?: string;

  constructor(options?: ServerManagerOptions) {
    this.apiDistPath = options?.apiDistPath
      ? options.apiDistPath
      : resolveApiDistPath();
    this.port = options?.port || 4000;
    this.nodeExecutable = options?.nodeExecutable;
    this.postgresManager = options?.postgresManager;
    this.spawnFn = options?.spawnFunction || spawn;
    this.healthCheckFn = options?.healthCheckFunction || testServerConnection;
    this.onRunningChange = options?.onRunningChange;
  }

  /**
   * Retrieves the current execution status of the NestJS server and PostgreSQL database.
   */
  public getStatus(): ServerStatus {
    const isAlive = this.childProcess !== null && !this.childProcess.killed;

    return {
      running: isAlive,
      pid: isAlive ? this.childProcess?.pid : undefined,
      port: this.port,
      uptime: this.startTime && isAlive ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      error: this.lastError,
      database: this.postgresManager?.getStatus(),
    };
  }

  /**
   * Ensures PostgreSQL is running (if managed) and spawns the NestJS backend process.
   */
  public async start(): Promise<{ success: boolean; error?: string }> {
    if (this.childProcess && !this.childProcess.killed) {
      return { success: true };
    }

    try {
      this.lastError = undefined;
      this.lastStderrLine = undefined;

      let managedDbUrl: string | undefined;
      if (this.postgresManager) {
        const dbStatus = await this.postgresManager.ensureStarted();
        if (!dbStatus.running) {
          this.lastError = dbStatus.error || 'تعذر تشغيل قاعدة البيانات PostgreSQL';
          return { success: false, error: this.lastError };
        }
        managedDbUrl = dbStatus.databaseUrl;
      }

      const apiCwd = path.dirname(path.dirname(path.resolve(this.apiDistPath)));
      const { command, useElectronAsNode } = resolveNodeRuntimeCommand(this.nodeExecutable);
      const desktopDataDir = resolveDesktopDataDir();
      const secrets = ensureRuntimeSecrets(desktopDataDir);
      const webDistDir = resolveWebDistPath();
      const drizzleDir = resolveApiDrizzleDir();
      const portablePgDir = resolvePortablePostgresDir();

      const env: NodeJS.ProcessEnv = {
        ...process.env,
        PORT: String(this.port),
        HOST: '0.0.0.0',
        CORS_ALLOW_LAN: 'true',
      };

      if (useElectronAsNode) {
        env.ELECTRON_RUN_AS_NODE = '1';
      }
      if (!env.NODE_ENV) {
        env.NODE_ENV = 'production';
      }
      if (!env.CORS_ORIGIN) {
        env.CORS_ORIGIN = `http://localhost:${this.port}`;
      }
      if (!env.STORAGE_ROOT_DIR) {
        env.STORAGE_ROOT_DIR = desktopDataDir;
      }
      const effectivePgDir =
        this.postgresManager?.getResolvedPortableDir?.() ??
        (portablePgDir ? resolveAsciiSafePostgresDir(portablePgDir) : null);
      if (effectivePgDir && !env.PG_BIN_DIR) {
        env.PG_BIN_DIR = path.join(effectivePgDir, 'bin');
      }
      if (managedDbUrl && !env.DATABASE_URL) {
        env.DATABASE_URL = managedDbUrl;
      }
      if (!env.JWT_ACCESS_SECRET) {
        env.JWT_ACCESS_SECRET = secrets.jwtAccessSecret;
      }
      if (!env.JWT_REFRESH_SECRET) {
        env.JWT_REFRESH_SECRET = secrets.jwtRefreshSecret;
      }
      if (!env.ANNUAL_RESET_PIN) {
        env.ANNUAL_RESET_PIN = secrets.annualResetPin;
      }
      if (webDistDir && !env.WEB_DIST_DIR) {
        env.WEB_DIST_DIR = webDistDir;
      }
      if (drizzleDir && !env.API_DRIZZLE_DIR) {
        env.API_DRIZZLE_DIR = drizzleDir;
      }

      const child = this.spawnFn(command, [this.apiDistPath], {
        cwd: apiCwd,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.childProcess = child;
      this.startTime = Date.now();
      this.onRunningChange?.(true);

      child.stdout?.on('data', (data: Buffer | string) => {
        const line = data.toString().trim();
        if (line) {
          console.log(`[API-Server] ${line}`);
        }
      });

      child.stderr?.on('data', (data: Buffer | string) => {
        const line = data.toString().trim();
        if (line) {
          const lastLine = line.split(/\r?\n/).filter(Boolean).pop();
          if (lastLine) {
            this.lastStderrLine = lastLine.slice(0, 240);
          }
          console.error(`[API-Server-Err] ${line}`);
        }
      });

      child.on('error', (err: Error) => {
        this.lastError = err.message;
        console.error('[API-Server] Process encountered an error:', err.message);
        this.childProcess = null;
        this.startTime = null;
        this.onRunningChange?.(false);
      });

      child.on('exit', (code: number | null, signal: NodeJS.Signals | string | null) => {
        if (code !== null && code !== 0) {
          this.lastError = this.lastStderrLine
            ? `Process exited with code ${code}: ${this.lastStderrLine}`
            : `Process exited with code ${code}`;
        } else if (signal && signal !== 'SIGTERM') {
          this.lastError = `Process terminated by signal ${signal}`;
        }

        console.warn(`[API-Server] Process exited with code ${code}, signal ${signal}`);
        this.childProcess = null;
        this.startTime = null;
        this.onRunningChange?.(false);
      });

      return { success: true };
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to spawn API server process';
      this.lastError = errorMessage;
      console.error('[API-Server] Failed to start:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Checks health connectivity using the configured health check function.
   */
  public async waitUntilReady(url = `http://127.0.0.1:${this.port}`, timeoutMs = 1500) {
    return this.healthCheckFn(url, timeoutMs);
  }

  /**
   * Gracefully terminates the running backend child process (and managed Portable Postgres).
   */
  public async stop(): Promise<{ success: boolean }> {
    try {
      if (this.childProcess && !this.childProcess.killed) {
        this.childProcess.kill('SIGTERM');
      }
      this.childProcess = null;
      this.startTime = null;
      this.onRunningChange?.(false);
      await this.postgresManager?.stop();
      return { success: true };
    } catch (err: any) {
      console.error('[API-Server] Error terminating server process:', err?.message || err);
      return { success: false };
    }
  }

  /**
   * Restarts the NestJS backend process cleanly.
   */
  public async restart(): Promise<{ success: boolean; error?: string }> {
    await this.stop();
    return this.start();
  }
}
