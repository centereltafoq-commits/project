import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StoreManager, DesktopConfig, DEFAULT_CONFIG } from './store-manager';
import * as fs from 'fs';
import * as path from 'path';

describe('StoreManager', () => {
  const tempDir = path.resolve(__dirname, '../../test-temp-store');
  const tempFile = path.join(tempDir, 'subfolder', 'desktop-config.json');

  beforeEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns default config when file does not exist', () => {
    const store = new StoreManager(tempFile);
    const config = store.getConfig();

    expect(config.serverMode).toBe('server');
    expect(config.serverUrl).toBe('http://localhost:4000');
    expect(config.directPrintEnabled).toBe(true);
    expect(config.isFirstLaunch).toBe(true);
    expect(config.windowBounds).toEqual({
      width: 1280,
      height: 850,
    });
    expect(fs.existsSync(tempFile)).toBe(false);
  });

  it('saves config updates, sets isFirstLaunch to false, ensures parent directory exists, and reloads from disk', () => {
    const store = new StoreManager(tempFile);

    const saved = store.saveConfig({
      serverMode: 'server',
      serverUrl: 'http://192.168.1.100:4000',
      defaultThermalPrinter: 'POS-80C',
      windowBounds: { width: 1440, height: 900, x: 100, y: 50 },
    });

    expect(saved.serverMode).toBe('server');
    expect(saved.serverUrl).toBe('http://192.168.1.100:4000');
    expect(saved.defaultThermalPrinter).toBe('POS-80C');
    expect(saved.directPrintEnabled).toBe(true);
    expect(saved.isFirstLaunch).toBe(false);
    expect(saved.windowBounds).toEqual({
      width: 1440,
      height: 900,
      x: 100,
      y: 50,
    });
    expect(fs.existsSync(tempFile)).toBe(true);

    // Reload in a new StoreManager instance to verify disk persistence
    const reloadedStore = new StoreManager(tempFile);
    const reloadedConfig = reloadedStore.getConfig();

    expect(reloadedConfig.serverMode).toBe('server');
    expect(reloadedConfig.serverUrl).toBe('http://192.168.1.100:4000');
    expect(reloadedConfig.defaultThermalPrinter).toBe('POS-80C');
    expect(reloadedConfig.isFirstLaunch).toBe(false);
    expect(reloadedConfig.windowBounds).toEqual({
      width: 1440,
      height: 900,
      x: 100,
      y: 50,
    });
  });

  it('gracefully recovers when file contains corrupted JSON', () => {
    const parentDir = path.dirname(tempFile);
    fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(tempFile, 'INVALID_CORRUPTED_JSON_{{[[', 'utf8');

    const store = new StoreManager(tempFile);
    const config = store.getConfig();

    expect(config.serverMode).toBe(DEFAULT_CONFIG.serverMode);
    expect(config.serverUrl).toBe(DEFAULT_CONFIG.serverUrl);
    expect(config.isFirstLaunch).toBe(true);
    expect(config.windowBounds).toEqual(DEFAULT_CONFIG.windowBounds);
  });

  it('resets config to defaults and deletes the file from disk', () => {
    const store = new StoreManager(tempFile);
    store.saveConfig({
      serverMode: 'server',
      serverUrl: 'http://192.168.1.200:4000',
    });

    expect(fs.existsSync(tempFile)).toBe(true);
    expect(store.getConfig().serverMode).toBe('server');
    expect(store.getConfig().isFirstLaunch).toBe(false);

    const resetConfig = store.resetConfig();

    expect(resetConfig.serverMode).toBe('server');
    expect(resetConfig.serverUrl).toBe('http://localhost:4000');
    expect(resetConfig.isFirstLaunch).toBe(true);
    expect(fs.existsSync(tempFile)).toBe(false);

    // Verify reloading after reset yields defaults
    const reloaded = new StoreManager(tempFile);
    expect(reloaded.getConfig().serverMode).toBe('server');
    expect(reloaded.getConfig().isFirstLaunch).toBe(true);
  });

  it('preserves existing fields when applying partial updates', () => {
    const store = new StoreManager(tempFile);
    store.saveConfig({ defaultThermalPrinter: 'XP-80' });

    expect(store.getConfig().defaultThermalPrinter).toBe('XP-80');
    expect(store.getConfig().serverMode).toBe('server');
    expect(store.getConfig().serverUrl).toBe('http://localhost:4000');

    store.saveConfig({ serverMode: 'client' });
    expect(store.getConfig().defaultThermalPrinter).toBe('XP-80');
    expect(store.getConfig().serverMode).toBe('client');
  });

  it('preserves isFirstLaunch when saving windowBounds only', () => {
    const store = new StoreManager(tempFile);
    expect(store.getConfig().isFirstLaunch).toBe(true);

    const afterBounds = store.saveConfig({
      windowBounds: { width: 1366, height: 768, x: 0, y: 0 },
    });
    expect(afterBounds.isFirstLaunch).toBe(true);
  });

  it('returns cloned copy of config to prevent external direct mutations', () => {
    const store = new StoreManager(tempFile);
    const config1 = store.getConfig();
    config1.serverMode = 'client';
    config1.windowBounds.width = 9999;

    const config2 = store.getConfig();
    expect(config2.serverMode).toBe('server');
    expect(config2.windowBounds.width).toBe(1280);
  });
});
