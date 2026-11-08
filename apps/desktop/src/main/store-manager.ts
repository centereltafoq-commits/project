import * as fs from 'fs';
import * as path from 'path';

/**
 * Persistent configuration schema for the desktop application.
 */
export interface DesktopConfig {
  serverMode: 'server' | 'client';
  serverUrl: string;
  defaultThermalPrinter?: string;
  directPrintEnabled: boolean;
  isFirstLaunch: boolean;
  windowBounds: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
}

/**
 * Standard default configuration applied on first installation or after reset.
 */
export const DEFAULT_CONFIG: DesktopConfig = {
  serverMode: 'client',
  serverUrl: 'http://localhost:4000',
  directPrintEnabled: true,
  isFirstLaunch: true,
  windowBounds: {
    width: 1280,
    height: 850,
  },
};

/**
 * Resolves the default file path for configuration persistence.
 * Uses Electron's userData directory when running in Electron,
 * or defaults to current working directory in test/node environments.
 */
function resolveDefaultConfigPath(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron');
    const app = electron?.app || electron?.default?.app;
    if (app && typeof app.getPath === 'function') {
      return path.join(app.getPath('userData'), 'desktop-config.json');
    }
  } catch {
    // Running in Node.js test environment or standalone process
  }

  return path.join(process.cwd(), 'desktop-config.json');
}

/**
 * Persistent Store Manager for Desktop Application settings and window states.
 */
export class StoreManager {
  private filePath: string;
  private config: DesktopConfig;

  constructor(customFilePath?: string) {
    this.filePath = customFilePath || resolveDefaultConfigPath();
    this.config = this.load();
  }

  /**
   * Loads configuration from persistent disk storage.
   * Gracefully falls back to default settings if file is absent or corrupted.
   */
  private load(): DesktopConfig {
    try {
      if (fs.existsSync(this.filePath)) {
        const rawContent = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(rawContent);

        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          windowBounds: {
            ...DEFAULT_CONFIG.windowBounds,
            ...(parsed.windowBounds || {}),
          },
        };
      }
    } catch (err) {
      console.warn('[StoreManager] Failed to read or parse config file. Using default configuration.', err);
    }

    return {
      ...DEFAULT_CONFIG,
      windowBounds: { ...DEFAULT_CONFIG.windowBounds },
    };
  }

  /**
   * Retrieves an immutable snapshot copy of current configuration.
   */
  public getConfig(): DesktopConfig {
    return {
      ...this.config,
      windowBounds: { ...this.config.windowBounds },
    };
  }

  /**
   * Merges partial configuration updates, marks first launch completed,
   * ensures target directory exists, and persists securely to disk.
   *
   * @param updates Partial updates to apply to configuration
   * @returns Updated DesktopConfig snapshot
   */
  public saveConfig(updates: Partial<DesktopConfig>): DesktopConfig {
    const updatedWindowBounds = updates.windowBounds
      ? { ...this.config.windowBounds, ...updates.windowBounds }
      : { ...this.config.windowBounds };

    this.config = {
      ...this.config,
      ...updates,
      windowBounds: updatedWindowBounds,
      isFirstLaunch: false,
    };

    try {
      const parentDir = path.dirname(this.filePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      fs.writeFileSync(this.filePath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (err) {
      console.error('[StoreManager] Failed to write config to disk:', err);
    }

    return this.getConfig();
  }

  /**
   * Resets configuration to default state and deletes persistent file from disk if present.
   *
   * @returns Reset DesktopConfig snapshot
   */
  public resetConfig(): DesktopConfig {
    this.config = {
      ...DEFAULT_CONFIG,
      windowBounds: { ...DEFAULT_CONFIG.windowBounds },
      isFirstLaunch: true,
    };

    if (fs.existsSync(this.filePath)) {
      try {
        fs.unlinkSync(this.filePath);
      } catch (err) {
        console.error('[StoreManager] Failed to delete config file on reset:', err);
      }
    }

    return this.getConfig();
  }
}
