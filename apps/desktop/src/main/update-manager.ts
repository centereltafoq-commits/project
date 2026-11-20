import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import type { DesktopUpdateSettings, StoreManager } from './store-manager';

export type UpdateState =
  | 'IDLE'
  | 'UNCONFIGURED'
  | 'CHECKING'
  | 'AVAILABLE'
  | 'DOWNLOADING'
  | 'DOWNLOADED'
  | 'UP_TO_DATE'
  | 'ERROR';

export interface DesktopUpdateStatus {
  state: UpdateState;
  currentVersion: string;
  availableVersion?: string;
  downloadPercent?: number;
  error?: string;
  lastCheckedAt?: string;
  isConfigured: boolean;
  githubOwner: string;
  githubRepo: string;
}

export interface AutoUpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  setFeedURL?: (options: { provider: 'github'; owner: string; repo: string }) => void;
  checkForUpdates: () => Promise<any>;
  quitAndInstall: (isSilent?: boolean, isForceRunAfter?: boolean) => void;
  on: (event: string, listener: (...args: any[]) => void) => any;
}

export interface UpdateManagerOptions {
  storeManager: StoreManager;
  currentVersion?: string;
  onStatusChange?: (status: DesktopUpdateStatus) => void;
  onBeforeInstallQuit?: () => Promise<void> | void;
  autoUpdaterFactory?: () => AutoUpdaterLike | null;
}

const DEFAULT_GITHUB_OWNER = 'centereltafoq-commits';
const DEFAULT_GITHUB_REPO = 'system-erp-';

function readPackagedUpdateFeed(): { owner: string; repo: string } | null {
  try {
    const withRes = process as NodeJS.Process & { resourcesPath?: string };
    if (!withRes.resourcesPath) return null;
    const ymlPath = path.join(withRes.resourcesPath, 'app-update.yml');
    if (!fs.existsSync(ymlPath)) return null;
    const content = fs.readFileSync(ymlPath, 'utf8');
    const ownerMatch = content.match(/^owner:\s*(.+)$/m);
    const repoMatch = content.match(/^repo:\s*(.+)$/m);
    const owner = ownerMatch?.[1]?.trim().replace(/^['"]|['"]$/g, '') || '';
    const repo = repoMatch?.[1]?.trim().replace(/^['"]|['"]$/g, '') || '';
    if (!owner || !repo) {
      return null;
    }
    return { owner, repo };
  } catch {
    return null;
  }
}

function loadDefaultAutoUpdater(): AutoUpdaterLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('electron-updater');
    return mod?.autoUpdater ?? null;
  } catch {
    return null;
  }
}

/**
 * Coordinates desktop auto-updates from GitHub Releases while safely remaining
 * passive until a valid GitHub repository is linked.
 */
export class UpdateManager {
  private status: DesktopUpdateStatus;
  private updater: AutoUpdaterLike | null = null;
  private listenersAttached = false;

  constructor(private readonly options: UpdateManagerOptions) {
    const currentVersion =
      options.currentVersion ||
      (typeof app?.getVersion === 'function' ? app.getVersion() : '1.0.0');

    const resolved = this.resolveTargetRepo();
    this.status = {
      state: resolved.isConfigured ? 'IDLE' : 'UNCONFIGURED',
      currentVersion,
      isConfigured: resolved.isConfigured,
      githubOwner: resolved.owner,
      githubRepo: resolved.repo,
    };
  }

  private resolveTargetRepo(): {
    isConfigured: boolean;
    owner: string;
    repo: string;
  } {
    const cfgSettings: DesktopUpdateSettings | undefined =
      this.options.storeManager.getConfig().updateSettings;
    const customOwner = cfgSettings?.githubOwner?.trim() || '';
    const customRepo = cfgSettings?.githubRepo?.trim() || '';

    if (customOwner && customRepo) {
      return { isConfigured: true, owner: customOwner, repo: customRepo };
    }

    const packagedFeed = readPackagedUpdateFeed();
    if (packagedFeed) {
      return { isConfigured: true, owner: packagedFeed.owner, repo: packagedFeed.repo };
    }

    if (!cfgSettings) {
      return {
        isConfigured: true,
        owner: DEFAULT_GITHUB_OWNER,
        repo: DEFAULT_GITHUB_REPO,
      };
    }

    return {
      isConfigured: false,
      owner: customOwner,
      repo: customRepo || DEFAULT_GITHUB_REPO,
    };
  }

  private emitStatus(patch: Partial<DesktopUpdateStatus>): DesktopUpdateStatus {
    const resolved = this.resolveTargetRepo();
    this.status = {
      ...this.status,
      isConfigured: resolved.isConfigured,
      githubOwner: resolved.owner,
      githubRepo: resolved.repo,
      ...patch,
    };
    this.options.onStatusChange?.(this.getStatus());
    return this.getStatus();
  }

  private ensureUpdater(): AutoUpdaterLike | null {
    if (!this.updater) {
      this.updater = this.options.autoUpdaterFactory
        ? this.options.autoUpdaterFactory()
        : loadDefaultAutoUpdater();
    }
    if (!this.updater) return null;

    this.updater.autoDownload = true;
    this.updater.autoInstallOnAppQuit = true;

    if (!this.listenersAttached) {
      this.listenersAttached = true;
      this.updater.on('checking-for-update', () => {
        this.emitStatus({ state: 'CHECKING', error: undefined });
      });
      this.updater.on('update-available', (info: any) => {
        this.emitStatus({
          state: 'AVAILABLE',
          availableVersion: info?.version,
          downloadPercent: 0,
          lastCheckedAt: new Date().toISOString(),
        });
      });
      this.updater.on('update-not-available', () => {
        this.emitStatus({
          state: 'UP_TO_DATE',
          availableVersion: undefined,
          downloadPercent: undefined,
          lastCheckedAt: new Date().toISOString(),
        });
      });
      this.updater.on('download-progress', (progress: any) => {
        this.emitStatus({
          state: 'DOWNLOADING',
          downloadPercent: Math.round(Number(progress?.percent || 0)),
        });
      });
      this.updater.on('update-downloaded', (info: any) => {
        this.emitStatus({
          state: 'DOWNLOADED',
          availableVersion: info?.version || this.status.availableVersion,
          downloadPercent: 100,
          lastCheckedAt: new Date().toISOString(),
        });
      });
      this.updater.on('error', (err: any) => {
        this.emitStatus({
          state: 'ERROR',
          error: err?.message || 'تعذر التحقق من التحديثات من GitHub Releases',
          lastCheckedAt: new Date().toISOString(),
        });
      });
    }

    return this.updater;
  }

  public getStatus(): DesktopUpdateStatus {
    return { ...this.status };
  }

  public syncConfiguration(): DesktopUpdateStatus {
    const resolved = this.resolveTargetRepo();
    if (!resolved.isConfigured) {
      return this.emitStatus({ state: 'UNCONFIGURED', error: undefined });
    }
    if (this.status.state === 'UNCONFIGURED') {
      return this.emitStatus({ state: 'IDLE', error: undefined });
    }
    return this.emitStatus({});
  }

  public async checkForUpdates(): Promise<DesktopUpdateStatus> {
    const resolved = this.resolveTargetRepo();
    if (!resolved.isConfigured) {
      return this.emitStatus({
        state: 'UNCONFIGURED',
        error: 'لم يتم ربط مستودع GitHub للتحديثات بعد',
      });
    }

    const updater = this.ensureUpdater();
    if (!updater) {
      return this.emitStatus({
        state: 'ERROR',
        error: 'وحدة التحديث غير متاحة في وضع التشغيل الحالي',
      });
    }

    if (typeof updater.setFeedURL === 'function' && resolved.owner && resolved.repo) {
      updater.setFeedURL({
        provider: 'github',
        owner: resolved.owner,
        repo: resolved.repo,
      });
    }

    try {
      this.emitStatus({ state: 'CHECKING', error: undefined });
      await updater.checkForUpdates();
    } catch (err: any) {
      this.emitStatus({
        state: 'ERROR',
        error: err?.message || 'تعذر الاتصال بـ GitHub للتحقق من التحديثات',
        lastCheckedAt: new Date().toISOString(),
      });
    }

    return this.getStatus();
  }

  public async installDownloadedUpdate(): Promise<{ success: boolean; error?: string }> {
    if (this.status.state !== 'DOWNLOADED' || !this.updater) {
      return {
        success: false,
        error: 'لا يوجد تحديث جاهز للتثبيت حالياً',
      };
    }

    try {
      await this.options.onBeforeInstallQuit?.();
      this.updater.quitAndInstall(false, true);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'تعذر تثبيت التحديث تلقائياً',
      };
    }
  }
}
