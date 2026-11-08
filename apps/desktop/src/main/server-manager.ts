import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import { testServerConnection } from './network-utils';

/**
 * Real-time operational status of the embedded NestJS API server process.
 */
export interface ServerStatus {
  running: boolean;
  pid?: number;
  port: number;
  uptime?: number;
  error?: string;
}

/**
 * Options used to configure the ServerManager instance.
 */
export interface ServerManagerOptions {
  apiDistPath?: string;
  port?: number;
  spawnFunction?: typeof spawn;
  healthCheckFunction?: typeof testServerConnection;
}

/**
 * Manages the lifecycle of the local NestJS background backend process,
 * handling process spawning, monitoring, termination, and state queries.
 */
export class ServerManager {
  private childProcess: ChildProcess | null = null;
  private apiDistPath: string;
  private port: number;
  private startTime: number | null = null;
  private spawnFn: typeof spawn;
  private healthCheckFn: typeof testServerConnection;
  private lastError?: string;

  constructor(options?: ServerManagerOptions) {
    this.apiDistPath = options?.apiDistPath || path.resolve(process.cwd(), 'apps/api/dist/main.js');
    this.port = options?.port || 4000;
    this.spawnFn = options?.spawnFunction || spawn;
    this.healthCheckFn = options?.healthCheckFunction || testServerConnection;
  }

  /**
   * Retrieves the current execution status of the NestJS server process.
   */
  public getStatus(): ServerStatus {
    const isAlive = this.childProcess !== null && !this.childProcess.killed;

    return {
      running: isAlive,
      pid: isAlive ? this.childProcess?.pid : undefined,
      port: this.port,
      uptime: this.startTime && isAlive ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      error: this.lastError,
    };
  }

  /**
   * Spawns the NestJS backend as a background child process using Node.js.
   * Attaches log listeners and lifecycle handlers to monitor process health.
   */
  public async start(): Promise<{ success: boolean; error?: string }> {
    if (this.childProcess && !this.childProcess.killed) {
      return { success: true };
    }

    try {
      this.lastError = undefined;
      const apiCwd = path.dirname(path.dirname(path.resolve(this.apiDistPath)));

      const child = this.spawnFn('node', [this.apiDistPath], {
        cwd: apiCwd,
        env: {
          ...process.env,
          PORT: String(this.port),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.childProcess = child;
      this.startTime = Date.now();

      child.stdout?.on('data', (data: Buffer | string) => {
        const line = data.toString().trim();
        if (line) {
          console.log(`[API-Server] ${line}`);
        }
      });

      child.stderr?.on('data', (data: Buffer | string) => {
        const line = data.toString().trim();
        if (line) {
          console.error(`[API-Server-Err] ${line}`);
        }
      });

      child.on('error', (err: Error) => {
        this.lastError = err.message;
        console.error('[API-Server] Process encountered an error:', err.message);
        this.childProcess = null;
        this.startTime = null;
      });

      child.on('exit', (code: number | null, signal: NodeJS.Signals | string | null) => {
        if (code !== null && code !== 0) {
          this.lastError = `Process exited with code ${code}`;
        } else if (signal && signal !== 'SIGTERM') {
          this.lastError = `Process terminated by signal ${signal}`;
        }

        console.warn(`[API-Server] Process exited with code ${code}, signal ${signal}`);
        this.childProcess = null;
        this.startTime = null;
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
   * Gracefully terminates the running backend child process with SIGTERM.
   */
  public async stop(): Promise<{ success: boolean }> {
    if (!this.childProcess || this.childProcess.killed) {
      this.childProcess = null;
      this.startTime = null;
      return { success: true };
    }

    try {
      this.childProcess.kill('SIGTERM');
      this.childProcess = null;
      this.startTime = null;
      return { success: true };
    } catch (err: any) {
      console.error('[API-Server] Error terminating server process:', err?.message || err);
      return { success: false };
    }
  }

  /**
   * Restarts the NestJS backend process by stopping any running instance
   * and subsequently launching a fresh instance.
   */
  public async restart(): Promise<{ success: boolean; error?: string }> {
    await this.stop();
    return this.start();
  }
}
