import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getVersion: vi.fn().mockReturnValue('1.0.0'),
  },
}));

import { UpdateManager, type AutoUpdaterLike } from './update-manager';

describe('UpdateManager (GitHub Releases Auto-Update)', () => {
  let mockStore: any;
  let mockUpdater: AutoUpdaterLike & { _emit: (evt: string, ...args: any[]) => void };
  let listeners: Record<string, Function[]>;

  beforeEach(() => {
    listeners = {};
    mockUpdater = {
      autoDownload: false,
      autoInstallOnAppQuit: false,
      setFeedURL: vi.fn(),
      checkForUpdates: vi.fn().mockResolvedValue({}),
      quitAndInstall: vi.fn(),
      on: vi.fn().mockImplementation((event: string, cb: Function) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
      }),
      _emit: (evt: string, ...args: any[]) => {
        for (const cb of listeners[evt] || []) {
          cb(...args);
        }
      },
    };

    mockStore = {
      getConfig: vi.fn().mockReturnValue({
        serverUrl: 'http://localhost:4000',
        directPrintEnabled: true,
        keepRunningInTray: true,
        launchOnStartup: false,
        updateSettings: {
          autoCheck: true,
          githubOwner: '',
          githubRepo: '',
        },
        isFirstLaunch: false,
        windowBounds: { width: 1280, height: 850 },
      }),
    };
  });

  it('stays safely UNCONFIGURED until a real GitHub owner & repo are configured', async () => {
    const manager = new UpdateManager({
      storeManager: mockStore,
      autoUpdaterFactory: () => mockUpdater,
    });

    expect(manager.getStatus()).toMatchObject({
      state: 'UNCONFIGURED',
      isConfigured: false,
      currentVersion: '1.0.0',
    });

    const result = await manager.checkForUpdates();
    expect(result.state).toBe('UNCONFIGURED');
    expect(mockUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('configures GitHub Releases feed, emits progress/downloaded statuses, and stops services before quitAndInstall', async () => {
    mockStore.getConfig.mockReturnValue({
      updateSettings: {
        autoCheck: true,
        githubOwner: 'client-org',
        githubRepo: 'educenter-erp',
      },
    });

    const events: string[] = [];
    const onBeforeInstallQuit = vi.fn().mockResolvedValue(undefined);

    const manager = new UpdateManager({
      storeManager: mockStore,
      currentVersion: '1.0.0',
      onStatusChange: (status) => events.push(status.state),
      onBeforeInstallQuit,
      autoUpdaterFactory: () => mockUpdater,
    });

    expect(manager.getStatus()).toMatchObject({
      state: 'IDLE',
      isConfigured: true,
      githubOwner: 'client-org',
      githubRepo: 'educenter-erp',
    });

    await manager.checkForUpdates();

    expect(mockUpdater.setFeedURL).toHaveBeenCalledWith({
      provider: 'github',
      owner: 'client-org',
      repo: 'educenter-erp',
    });
    expect(mockUpdater.checkForUpdates).toHaveBeenCalledTimes(1);

    mockUpdater._emit('update-available', { version: '1.0.1' });
    mockUpdater._emit('download-progress', { percent: 55.4 });
    mockUpdater._emit('update-downloaded', { version: '1.0.1' });

    const downloaded = manager.getStatus();
    expect(downloaded).toMatchObject({
      state: 'DOWNLOADED',
      availableVersion: '1.0.1',
      downloadPercent: 100,
    });
    expect(events).toContain('DOWNLOADED');

    const installResult = await manager.installDownloadedUpdate();
    expect(installResult.success).toBe(true);
    expect(onBeforeInstallQuit).toHaveBeenCalledTimes(1);
    expect(mockUpdater.quitAndInstall).toHaveBeenCalledWith(false, true);
  });

  it('disables auto-updates cleanly when running as a Windows portable executable', async () => {
    const prevPortable = process.env.PORTABLE_EXECUTABLE_FILE;
    process.env.PORTABLE_EXECUTABLE_FILE = 'C:\\Users\\Client\\Desktop\\EduCenter-ERP-Portable-1.0.0.exe';
    try {
      const manager = new UpdateManager({
        storeManager: mockStore,
        autoUpdaterFactory: () => mockUpdater,
      });

      expect(manager.getStatus()).toMatchObject({
        state: 'UNCONFIGURED',
        isConfigured: false,
      });

      const res = await manager.checkForUpdates();
      expect(res.state).toBe('UNCONFIGURED');
      expect(res.error).toContain('النسخة المحمولة');
      expect(mockUpdater.checkForUpdates).not.toHaveBeenCalled();
    } finally {
      if (prevPortable === undefined) {
        delete process.env.PORTABLE_EXECUTABLE_FILE;
      } else {
        process.env.PORTABLE_EXECUTABLE_FILE = prevPortable;
      }
    }
  });
});
