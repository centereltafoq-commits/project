import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { ServerManager, ServerStatus, ServerManagerOptions } from './server-manager';

describe('ServerManager', () => {
  let mockChildProcess: any;
  let spawnSpy: any;

  function createMockChildProcess(pid = 12345) {
    const child = new EventEmitter() as any;
    child.pid = pid;
    child.killed = false;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = vi.fn().mockImplementation((signal?: string) => {
      child.killed = true;
      child.emit('exit', 0, signal || 'SIGTERM');
      return true;
    });
    return child;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockChildProcess = createMockChildProcess();
    spawnSpy = vi.fn().mockReturnValue(mockChildProcess);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization and initial status', () => {
    it('initializes with STOPPED status and default port 4000', () => {
      const manager = new ServerManager({ apiDistPath: 'apps/api/dist/main.js' });
      const status: ServerStatus = manager.getStatus();

      expect(status.running).toBe(false);
      expect(status.port).toBe(4000);
      expect(status.pid).toBeUndefined();
      expect(status.uptime).toBe(0);
      expect(status.error).toBeUndefined();
    });

    it('respects custom port configuration in options', () => {
      const manager = new ServerManager({
        apiDistPath: 'apps/api/dist/main.js',
        port: 4500,
      });
      const status = manager.getStatus();

      expect(status.port).toBe(4500);
      expect(status.running).toBe(false);
    });
  });

  describe('start()', () => {
    it('spawns child process when started, setting PID and running: true', async () => {
      const manager = new ServerManager({
        apiDistPath: 'C:/apps/api/dist/main.js',
        port: 4000,
        spawnFunction: spawnSpy,
      });

      const result = await manager.start();

      expect(result.success).toBe(true);
      expect(spawnSpy).toHaveBeenCalledTimes(1);
      expect(spawnSpy).toHaveBeenCalledWith(
        'node',
        ['C:/apps/api/dist/main.js'],
        expect.objectContaining({
          cwd: expect.any(String),
          env: expect.objectContaining({
            PORT: '4000',
          }),
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      );

      const status = manager.getStatus();
      expect(status.running).toBe(true);
      expect(status.pid).toBe(12345);
      expect(status.uptime).toBeGreaterThanOrEqual(0);
      expect(status.error).toBeUndefined();
    });

    it('returns success: true without spawning again if already running', async () => {
      const manager = new ServerManager({
        apiDistPath: 'apps/api/dist/main.js',
        spawnFunction: spawnSpy,
      });

      const firstStart = await manager.start();
      expect(firstStart.success).toBe(true);
      expect(spawnSpy).toHaveBeenCalledTimes(1);

      const secondStart = await manager.start();
      expect(secondStart.success).toBe(true);
      expect(spawnSpy).toHaveBeenCalledTimes(1);
    });

    it('captures stdout and stderr from child process without crashing', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const manager = new ServerManager({
        apiDistPath: 'apps/api/dist/main.js',
        spawnFunction: spawnSpy,
      });

      await manager.start();

      mockChildProcess.stdout.emit('data', Buffer.from('Nest application initialized'));
      mockChildProcess.stderr.emit('data', Buffer.from('Database connection warning'));

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[API-Server]'));
      expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[API-Server-Err]'));
    });

    it('handles synchronous spawn errors gracefully and updates error status', async () => {
      const throwingSpawn = vi.fn().mockImplementation(() => {
        throw new Error('spawn ENOENT node');
      });

      const manager = new ServerManager({
        apiDistPath: 'apps/api/dist/main.js',
        spawnFunction: throwingSpawn,
      });

      const result = await manager.start();

      expect(result.success).toBe(false);
      expect(result.error).toContain('spawn ENOENT node');

      const status = manager.getStatus();
      expect(status.running).toBe(false);
      expect(status.error).toContain('spawn ENOENT node');
    });
  });

  describe('stop()', () => {
    it('kills child process with SIGTERM and resets status to stopped', async () => {
      const manager = new ServerManager({
        apiDistPath: 'apps/api/dist/main.js',
        spawnFunction: spawnSpy,
      });

      await manager.start();
      expect(manager.getStatus().running).toBe(true);

      const stopResult = await manager.stop();

      expect(stopResult.success).toBe(true);
      expect(mockChildProcess.kill).toHaveBeenCalledWith('SIGTERM');

      const status = manager.getStatus();
      expect(status.running).toBe(false);
      expect(status.pid).toBeUndefined();
      expect(status.uptime).toBe(0);
    });

    it('returns success: true immediately when stopping an already stopped server', async () => {
      const manager = new ServerManager({
        apiDistPath: 'apps/api/dist/main.js',
        spawnFunction: spawnSpy,
      });

      const stopResult = await manager.stop();

      expect(stopResult.success).toBe(true);
      expect(spawnSpy).not.toHaveBeenCalled();
    });

    it('handles process kill errors gracefully and returns success: false', async () => {
      const stubbornChild = createMockChildProcess();
      stubbornChild.kill = vi.fn().mockImplementation(() => {
        throw new Error('EPERM: operation not permitted');
      });

      const manager = new ServerManager({
        apiDistPath: 'apps/api/dist/main.js',
        spawnFunction: vi.fn().mockReturnValue(stubbornChild),
      });

      await manager.start();
      const stopResult = await manager.stop();

      expect(stopResult.success).toBe(false);
    });
  });

  describe('process error and abnormal exit handling', () => {
    it('handles asynchronous child process error event', async () => {
      const manager = new ServerManager({
        apiDistPath: 'apps/api/dist/main.js',
        spawnFunction: spawnSpy,
      });

      await manager.start();
      expect(manager.getStatus().running).toBe(true);

      mockChildProcess.emit('error', new Error('Child process crashed unexpectedly'));

      const status = manager.getStatus();
      expect(status.running).toBe(false);
      expect(status.pid).toBeUndefined();
      expect(status.error).toContain('Child process crashed unexpectedly');
    });

    it('handles child process abnormal exit with non-zero exit code', async () => {
      const manager = new ServerManager({
        apiDistPath: 'apps/api/dist/main.js',
        spawnFunction: spawnSpy,
      });

      await manager.start();
      expect(manager.getStatus().running).toBe(true);

      mockChildProcess.emit('exit', 1, null);

      const status = manager.getStatus();
      expect(status.running).toBe(false);
      expect(status.pid).toBeUndefined();
      expect(status.error).toContain('Process exited with code 1');
    });

    it('handles abnormal termination by signal (not SIGTERM)', async () => {
      const manager = new ServerManager({
        apiDistPath: 'apps/api/dist/main.js',
        spawnFunction: spawnSpy,
      });

      await manager.start();
      mockChildProcess.emit('exit', null, 'SIGKILL');

      const status = manager.getStatus();
      expect(status.running).toBe(false);
      expect(status.error).toContain('Process terminated by signal SIGKILL');
    });
  });

  describe('restart()', () => {
    it('stops existing process and starts a new one properly', async () => {
      const firstChild = createMockChildProcess(1111);
      const secondChild = createMockChildProcess(2222);

      let spawnCount = 0;
      const customSpawn = vi.fn().mockImplementation(() => {
        spawnCount++;
        return spawnCount === 1 ? firstChild : secondChild;
      });

      const manager = new ServerManager({
        apiDistPath: 'apps/api/dist/main.js',
        spawnFunction: customSpawn,
      });

      await manager.start();
      expect(manager.getStatus().pid).toBe(1111);

      const restartResult = await manager.restart();

      expect(restartResult.success).toBe(true);
      expect(firstChild.kill).toHaveBeenCalledWith('SIGTERM');
      expect(customSpawn).toHaveBeenCalledTimes(2);

      const status = manager.getStatus();
      expect(status.running).toBe(true);
      expect(status.pid).toBe(2222);
    });
  });
});
