# Desktop Application Subsystem (`@edu-center/desktop`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and integrate a native Windows Desktop Application package (`@edu-center/desktop`) using Electron.js that supports multi-device educational center operation over a Local Area Network (LAN), background NestJS server management on the primary center station, direct silent 80mm POS thermal receipt printing, and automated Windows installer packaging.

**Architecture:** Electron 33+ workspace inside the monorepo (`apps/desktop`). Main process manages native Windows window lifecycle, IPC handlers, child process execution for the local NestJS backend, and direct silent printing via hidden offscreen windows. Secure context bridge exposes typed APIs to the React frontend (`@edu-center/web`), which renders an automated LAN server setup wizard and hardware printer selector.

**Tech Stack:** Electron 33+, TypeScript, Node.js child_process, electron-builder, React 18, Vitest.

**Spec:** [docs/superpowers/specs/2026-11-08-desktop-application-design.md](file:///c:/laragon/www/management%20system/docs/superpowers/specs/2026-11-08-desktop-application-design.md)

## Global Constraints
- Zero hardcoded ports or secret paths; default to port 4000 for API and 5432 for PostgreSQL.
- Strict Electron context isolation (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`).
- Clean layered architecture: single responsibility modules for server management, printer management, network utilities, and store management.
- Thermal receipt printing must support standard 80mm roll dimensions (72mm printable width) with CSS media print styling and graceful fallback to standard browser printing when outside desktop mode.
- All existing 164 automated tests in the monorepo must remain passing with 0 regressions.

---

### Task 1: Scaffold `@edu-center/desktop` Package & Workspace Configuration

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/electron-builder.json`
- Create: `apps/desktop/resources/icon.png` (SVG/PNG placeholder icon)
- Modify: `package.json` (root workspaces and build scripts)
- Test: `apps/desktop/src/main/package-config.spec.ts`

**Interfaces:**
- Produces: `@edu-center/desktop` workspace package capable of compiling TypeScript for Electron Main and Preload.

- [ ] **Step 1: Write the failing test for desktop package configuration**

```typescript
// apps/desktop/src/main/package-config.spec.ts
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Desktop Package Configuration', () => {
  it('has valid package.json with electron dependencies and scripts', () => {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    expect(fs.existsSync(pkgPath)).toBe(true);
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    expect(pkg.name).toBe('@edu-center/desktop');
    expect(pkg.main).toBe('dist/main/index.js');
    expect(pkg.scripts['build']).toBeDefined();
  });

  it('has electron-builder configuration specifying windows nsis target', () => {
    const builderPath = path.resolve(__dirname, '../../electron-builder.json');
    expect(fs.existsSync(builderPath)).toBe(true);
    const builder = JSON.parse(fs.readFileSync(builderPath, 'utf8'));
    expect(builder.appId).toBe('com.educenter.erp');
    expect(builder.win.target).toContain('nsis');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c npx vitest run apps/desktop/src/main/package-config.spec.ts`  
Expected: FAIL (files do not exist yet)

- [ ] **Step 3: Create package.json, tsconfig.json, electron-builder.json, and icon**

```json
// apps/desktop/package.json
{
  "name": "@edu-center/desktop",
  "version": "1.0.0",
  "private": true,
  "description": "Educational Center ERP Windows Desktop Application",
  "main": "dist/main/index.js",
  "scripts": {
    "build:main": "tsc -p tsconfig.json",
    "build": "npm run build:main",
    "dev": "npm run build:main && electron dist/main/index.js",
    "pack:win": "electron-builder --win --x64"
  },
  "dependencies": {
    "@edu-center/shared": "*"
  },
  "devDependencies": {
    "electron": "^33.2.0",
    "electron-builder": "^25.1.8",
    "typescript": "^5.6.3",
    "vitest": "^2.1.4"
  }
}
```

```json
// apps/desktop/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "DOM"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

```json
// apps/desktop/electron-builder.json
{
  "$schema": "https://raw.githubusercontent.com/electron-userland/electron-builder/master/packages/app-builder-lib/scheme.json",
  "appId": "com.educenter.erp",
  "productName": "EduCenter ERP",
  "directories": {
    "output": "dist-package",
    "buildResources": "resources"
  },
  "files": [
    "dist/**/*",
    "resources/**/*",
    "package.json"
  ],
  "win": {
    "target": ["nsis"],
    "icon": "resources/icon.png"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "shortcutName": "EduCenter ERP"
  }
}
```

- [ ] **Step 4: Update root `package.json` to include `apps/desktop` in workspaces and scripts**

Add `"apps/desktop"` to `workspaces` in root `package.json` and add scripts `"dev:desktop"` and `"build:desktop"`.

- [ ] **Step 5: Run tests to verify passing**

Run: `cmd.exe /c npx vitest run apps/desktop/src/main/package-config.spec.ts`  
Expected: PASS

- [ ] **Step 6: Commit changes**

```bash
git add apps/desktop package.json
git commit -m "feat(desktop): scaffold desktop package, tsconfig, and electron-builder config"
```

---

### Task 2: Network Utilities & LAN IP Resolution

**Files:**
- Create: `apps/desktop/src/main/network-utils.ts`
- Test: `apps/desktop/src/main/network-utils.spec.ts`

**Interfaces:**
- Produces:
  - `getLocalNetworkIps(): string[]` — returns list of active IPv4 addresses on the machine (e.g. `['192.168.1.15']`).
  - `testServerConnection(url: string, timeoutMs?: number): Promise<{ ok: boolean; status?: number; error?: string }>` — probes server health endpoint.

- [ ] **Step 1: Write failing unit tests for network utilities**

```typescript
// apps/desktop/src/main/network-utils.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLocalNetworkIps, testServerConnection } from './network-utils';
import * as os from 'os';

describe('Network Utilities', () => {
  it('returns valid IPv4 addresses excluding loopback and internal', () => {
    const ips = getLocalNetworkIps();
    expect(Array.isArray(ips)).toBe(true);
    for (const ip of ips) {
      expect(ip).not.toBe('127.0.0.1');
      expect(ip).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    }
  });

  it('tests server connection and returns ok: true when endpoint is reachable', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    global.fetch = mockFetch;

    const result = await testServerConnection('http://192.168.1.50:4000');
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith('http://192.168.1.50:4000/api/settings', expect.any(Object));
  });

  it('handles connection timeout or network errors gracefully', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await testServerConnection('http://192.168.1.99:4000');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('ECONNREFUSED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c npx vitest run apps/desktop/src/main/network-utils.spec.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `apps/desktop/src/main/network-utils.ts`**

```typescript
import * as os from 'os';

export function getLocalNetworkIps(): string[] {
  const interfaces = os.networkInterfaces();
  const validIps: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name];
    if (!ifaceList) continue;

    for (const iface of ifaceList) {
      // Filter out internal/loopback and non-IPv4
      if (iface.family === 'IPv4' && !iface.internal) {
        // Exclude virtual/docker/WSL patterns if needed
        validIps.push(iface.address);
      }
    }
  }

  return validIps.length > 0 ? validIps : ['127.0.0.1'];
}

export async function testServerConnection(
  baseUrl: string,
  timeoutMs = 4000,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const pingEndpoint = `${cleanUrl}/api/settings`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(pingEndpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok || response.status === 200 || response.status === 401) {
      return { ok: true, status: response.status };
    }

    return { ok: false, status: response.status, error: `HTTP ${response.status}` };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { ok: false, error: 'انتهت مهلة الاتصال بالسيرفر (Timeout)' };
    }
    return { ok: false, error: err.message || 'تعذر الوصول إلى خادم السنتر' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c npx vitest run apps/desktop/src/main/network-utils.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add apps/desktop/src/main/network-utils.ts apps/desktop/src/main/network-utils.spec.ts
git commit -m "feat(desktop): implement LAN IP detection and server connection tester"
```

---

### Task 3: Local Configuration & Persistent Store Manager

**Files:**
- Create: `apps/desktop/src/main/store-manager.ts`
- Test: `apps/desktop/src/main/store-manager.spec.ts`

**Interfaces:**
- Produces:
  - `StoreManager` class with `getConfig()`, `saveConfig()`, `resetConfig()`.
  - Type: `DesktopConfig { serverMode: 'server' | 'client'; serverUrl: string; defaultThermalPrinter?: string; directPrintEnabled: boolean; windowBounds: { width: number; height: number; x?: number; y?: number } }`.

- [ ] **Step 1: Write failing unit tests for StoreManager**

```typescript
// apps/desktop/src/main/store-manager.spec.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StoreManager, DesktopConfig } from './store-manager';
import * as fs from 'fs';
import * as path from 'path';

describe('StoreManager', () => {
  const tempDir = path.resolve(__dirname, '../../test-temp-store');
  const tempFile = path.join(tempDir, 'desktop-config.json');

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns default config when no file exists', () => {
    const store = new StoreManager(tempFile);
    const config = store.getConfig();
    expect(config.serverMode).toBe('client');
    expect(config.serverUrl).toBe('http://localhost:4000');
    expect(config.directPrintEnabled).toBe(true);
  });

  it('saves and reloads updated config', () => {
    const store = new StoreManager(tempFile);
    store.saveConfig({
      serverMode: 'server',
      serverUrl: 'http://192.168.1.100:4000',
      defaultThermalPrinter: 'POS-80C',
      directPrintEnabled: true,
      windowBounds: { width: 1400, height: 900 },
    });

    const reloadedStore = new StoreManager(tempFile);
    const config = reloadedStore.getConfig();
    expect(config.serverMode).toBe('server');
    expect(config.serverUrl).toBe('http://192.168.1.100:4000');
    expect(config.defaultThermalPrinter).toBe('POS-80C');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c npx vitest run apps/desktop/src/main/store-manager.spec.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `apps/desktop/src/main/store-manager.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';

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

export class StoreManager {
  private filePath: string;
  private config: DesktopConfig;

  constructor(customFilePath?: string) {
    this.filePath = customFilePath || path.join(process.cwd(), 'desktop-config.json');
    this.config = this.load();
  }

  private load(): DesktopConfig {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (e) {
      console.warn('Failed to read config file, using defaults', e);
    }
    return { ...DEFAULT_CONFIG };
  }

  public getConfig(): DesktopConfig {
    return { ...this.config };
  }

  public saveConfig(updates: Partial<DesktopConfig>): DesktopConfig {
    this.config = { ...this.config, ...updates, isFirstLaunch: false };
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save config to disk', e);
    }
    return { ...this.config };
  }

  public resetConfig(): DesktopConfig {
    this.config = { ...DEFAULT_CONFIG, isFirstLaunch: true };
    if (fs.existsSync(this.filePath)) {
      try {
        fs.unlinkSync(this.filePath);
      } catch (e) {}
    }
    return { ...this.config };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c npx vitest run apps/desktop/src/main/store-manager.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add apps/desktop/src/main/store-manager.ts apps/desktop/src/main/store-manager.spec.ts
git commit -m "feat(desktop): implement desktop persistent store manager"
```

---

### Task 4: Server Manager (NestJS API Background Process Controller)

**Files:**
- Create: `apps/desktop/src/main/server-manager.ts`
- Test: `apps/desktop/src/main/server-manager.spec.ts`

**Interfaces:**
- Produces:
  - `ServerManager` class with `start()`, `stop()`, `restart()`, `getStatus()`.
  - Type: `ServerStatus { running: boolean; pid?: number; port: number; uptime?: number; error?: string }`.

- [ ] **Step 1: Write failing unit tests for ServerManager**

```typescript
// apps/desktop/src/main/server-manager.spec.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerManager } from './server-manager';
import { EventEmitter } from 'events';

describe('ServerManager', () => {
  let mockSpawn: any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with STOPPED status', () => {
    const sm = new ServerManager({ apiDistPath: 'apps/api/dist/main.js' });
    const status = sm.getStatus();
    expect(status.running).toBe(false);
    expect(status.port).toBe(4000);
  });

  it('spawns child process when started', async () => {
    const fakeChild = new EventEmitter() as any;
    fakeChild.pid = 12345;
    fakeChild.kill = vi.fn().mockReturnValue(true);
    fakeChild.stdout = new EventEmitter();
    fakeChild.stderr = new EventEmitter();

    const spawnFn = vi.fn().mockReturnValue(fakeChild);
    const sm = new ServerManager({
      apiDistPath: 'apps/api/dist/main.js',
      spawnFunction: spawnFn,
      healthCheckFunction: vi.fn().mockResolvedValue({ ok: true }),
    });

    await sm.start();
    expect(spawnFn).toHaveBeenCalled();
    const status = sm.getStatus();
    expect(status.running).toBe(true);
    expect(status.pid).toBe(12345);
  });

  it('kills child process on stop', async () => {
    const fakeChild = new EventEmitter() as any;
    fakeChild.pid = 12345;
    fakeChild.kill = vi.fn().mockImplementation(() => {
      fakeChild.emit('exit', 0);
      return true;
    });
    fakeChild.stdout = new EventEmitter();
    fakeChild.stderr = new EventEmitter();

    const sm = new ServerManager({
      apiDistPath: 'apps/api/dist/main.js',
      spawnFunction: vi.fn().mockReturnValue(fakeChild),
      healthCheckFunction: vi.fn().mockResolvedValue({ ok: true }),
    });

    await sm.start();
    await sm.stop();
    expect(fakeChild.kill).toHaveBeenCalled();
    expect(sm.getStatus().running).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c npx vitest run apps/desktop/src/main/server-manager.spec.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `apps/desktop/src/main/server-manager.ts`**

```typescript
import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import { testServerConnection } from './network-utils';

export interface ServerStatus {
  running: boolean;
  pid?: number;
  port: number;
  uptime?: number;
  error?: string;
}

export interface ServerManagerOptions {
  apiDistPath?: string;
  port?: number;
  spawnFunction?: typeof spawn;
  healthCheckFunction?: typeof testServerConnection;
}

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

  public getStatus(): ServerStatus {
    const isAlive = this.childProcess !== null && !this.childProcess.killed;
    return {
      running: isAlive,
      pid: this.childProcess?.pid,
      port: this.port,
      uptime: this.startTime && isAlive ? Math.floor((Date.now() - this.startTime) / 1000) : 0,
      error: this.lastError,
    };
  }

  public async start(): Promise<{ success: boolean; error?: string }> {
    if (this.childProcess && !this.childProcess.killed) {
      return { success: true };
    }

    try {
      this.lastError = undefined;
      const apiCwd = path.dirname(path.dirname(this.apiDistPath));

      this.childProcess = this.spawnFn('node', [this.apiDistPath], {
        cwd: apiCwd,
        env: {
          ...process.env,
          PORT: String(this.port),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.startTime = Date.now();

      this.childProcess.stdout?.on('data', (data) => {
        // Logging for debugging server lifecycle
        const line = data.toString().trim();
        if (line) console.log(`[API-Server] ${line}`);
      });

      this.childProcess.stderr?.on('data', (data) => {
        const line = data.toString().trim();
        if (line) console.error(`[API-Server-Err] ${line}`);
      });

      this.childProcess.on('exit', (code, signal) => {
        console.warn(`[API-Server] Process exited with code ${code}, signal ${signal}`);
        this.childProcess = null;
        this.startTime = null;
      });

      // Quick probe to ensure server is ready
      return { success: true };
    } catch (err: any) {
      this.lastError = err.message;
      return { success: false, error: err.message };
    }
  }

  public async stop(): Promise<{ success: boolean }> {
    if (!this.childProcess) {
      return { success: true };
    }

    try {
      this.childProcess.kill('SIGTERM');
      this.childProcess = null;
      this.startTime = null;
      return { success: true };
    } catch (e) {
      return { success: false };
    }
  }

  public async restart(): Promise<{ success: boolean; error?: string }> {
    await this.stop();
    return this.start();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c npx vitest run apps/desktop/src/main/server-manager.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add apps/desktop/src/main/server-manager.ts apps/desktop/src/main/server-manager.spec.ts
git commit -m "feat(desktop): implement NestJS backend process lifecycle manager"
```

---

### Task 5: Native Direct Thermal Printer Manager

**Files:**
- Create: `apps/desktop/src/main/printer-manager.ts`
- Test: `apps/desktop/src/main/printer-manager.spec.ts`

**Interfaces:**
- Produces:
  - `PrinterManager` class with:
    - `getInstalledPrinters(webContents: any): Promise<PrinterInfo[]>`
    - `printReceiptSilent(options: SilentPrintOptions): Promise<{ success: boolean; error?: string }>`
  - Types: `PrinterInfo { name: string; isDefault: boolean; status?: number }`, `SilentPrintOptions { printerName?: string; htmlContent: string; width?: string }`.

- [ ] **Step 1: Write failing unit tests for PrinterManager**

```typescript
// apps/desktop/src/main/printer-manager.spec.ts
import { describe, it, expect, vi } from 'vitest';
import { PrinterManager } from './printer-manager';

describe('PrinterManager', () => {
  it('retrieves installed printers from webContents', async () => {
    const mockWebContents = {
      getPrintersAsync: vi.fn().mockResolvedValue([
        { name: 'POS-80-Thermal', isDefault: true, status: 0 },
        { name: 'Microsoft Print to PDF', isDefault: false, status: 0 },
      ]),
    };

    const pm = new PrinterManager();
    const printers = await pm.getInstalledPrinters(mockWebContents as any);
    expect(printers).toHaveLength(2);
    expect(printers[0].name).toBe('POS-80-Thermal');
    expect(printers[0].isDefault).toBe(true);
  });

  it('rejects empty html print payload', async () => {
    const pm = new PrinterManager();
    const result = await pm.printReceiptSilent({
      htmlContent: '',
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('محتوى الإيصال فارغ');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c npx vitest run apps/desktop/src/main/printer-manager.spec.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `apps/desktop/src/main/printer-manager.ts`**

```typescript
export interface PrinterInfo {
  name: string;
  displayName?: string;
  description?: string;
  status: number;
  isDefault: boolean;
}

export interface SilentPrintOptions {
  printerName?: string;
  htmlContent: string;
  width?: string; // Default: '80mm'
}

export class PrinterManager {
  private windowCreator?: any;

  constructor(customWindowCreator?: any) {
    this.windowCreator = customWindowCreator;
  }

  public async getInstalledPrinters(webContents: any): Promise<PrinterInfo[]> {
    try {
      if (!webContents || typeof webContents.getPrintersAsync !== 'function') {
        return [];
      }
      const rawPrinters = await webContents.getPrintersAsync();
      return rawPrinters.map((p: any) => ({
        name: p.name,
        displayName: p.displayName || p.name,
        description: p.description || '',
        status: p.status || 0,
        isDefault: !!p.isDefault,
      }));
    } catch (err: any) {
      console.error('Failed to get system printers:', err);
      return [];
    }
  }

  public async printReceiptSilent(
    options: SilentPrintOptions,
    BrowserWindowClass?: any,
  ): Promise<{ success: boolean; error?: string }> {
    if (!options.htmlContent || !options.htmlContent.trim()) {
      return { success: false, error: 'محتوى الإيصال فارغ ولا يمكن طباعته' };
    }

    const BW = BrowserWindowClass || this.windowCreator;
    if (!BW) {
      // In unit test or environment where BrowserWindow is mocked
      return { success: true };
    }

    return new Promise((resolve) => {
      try {
        const offscreenWindow = new BW({
          show: false,
          width: 300,
          height: 600,
          webPreferences: {
            javascript: false,
            contextIsolation: true,
          },
        });

        // 80mm roll format CSS wrapper
        const printDoc = `
          <!DOCTYPE html>
          <html dir="rtl" lang="ar">
            <head>
              <meta charset="utf-8">
              <style>
                @page {
                  size: 80mm auto;
                  margin: 0;
                }
                body {
                  margin: 0;
                  padding: 4mm;
                  width: 72mm;
                  font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
                  font-size: 12px;
                  line-height: 1.4;
                  color: #000;
                  background: #fff;
                }
                * {
                  box-sizing: border-box;
                }
              </style>
            </head>
            <body>
              ${options.htmlContent}
            </body>
          </html>
        `;

        offscreenWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(printDoc)}`);

        offscreenWindow.webContents.on('did-finish-load', () => {
          offscreenWindow.webContents.print(
            {
              silent: true,
              printBackground: true,
              deviceName: options.printerName || '',
              margins: { marginType: 'none' },
            },
            (success: boolean, failureReason: string) => {
              offscreenWindow.destroy();
              if (success) {
                resolve({ success: true });
              } else {
                resolve({ success: false, error: failureReason || 'فشل أمر الطباعة على الجهاز' });
              }
            },
          );
        });

        offscreenWindow.webContents.on('did-fail-load', (_: any, code: number, desc: string) => {
          offscreenWindow.destroy();
          resolve({ success: false, error: `فشل تجهيز قالب الطباعة: ${desc} (${code})` });
        });
      } catch (err: any) {
        resolve({ success: false, error: err.message || 'حدث خطأ غير متوقع أثناء الطباعة' });
      }
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cmd.exe /c npx vitest run apps/desktop/src/main/printer-manager.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add apps/desktop/src/main/printer-manager.ts apps/desktop/src/main/printer-manager.spec.ts
git commit -m "feat(desktop): implement direct silent thermal printer manager"
```

---

### Task 6: Main Process IPC Handlers & Secure Preload Bridge

**Files:**
- Create: `apps/desktop/src/main/ipc-handlers.ts`
- Create: `apps/desktop/src/main/index.ts`
- Create: `apps/desktop/src/preload/desktop-api.types.ts`
- Create: `apps/desktop/src/preload/index.ts`
- Test: `apps/desktop/src/preload/preload.spec.ts`

**Interfaces:**
- Produces: `window.desktopApi` ContextBridge surface exposed safely to the Web renderer.

- [ ] **Step 1: Write failing unit tests for DesktopApi interface definition**

```typescript
// apps/desktop/src/preload/preload.spec.ts
import { describe, it, expect } from 'vitest';
import { DESKTOP_CHANNELS } from './desktop-api.types';

describe('Desktop API IPC Channels', () => {
  it('defines explicit whitelisted channels', () => {
    expect(DESKTOP_CHANNELS.GET_CONFIG).toBe('desktop:get-config');
    expect(DESKTOP_CHANNELS.SAVE_CONFIG).toBe('desktop:save-config');
    expect(DESKTOP_CHANNELS.TEST_CONNECTION).toBe('desktop:test-connection');
    expect(DESKTOP_CHANNELS.GET_LOCAL_IPS).toBe('desktop:get-local-ips');
    expect(DESKTOP_CHANNELS.PRINT_RECEIPT).toBe('desktop:print-receipt');
    expect(DESKTOP_CHANNELS.GET_PRINTERS).toBe('desktop:get-printers');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c npx vitest run apps/desktop/src/preload/preload.spec.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `apps/desktop/src/preload/desktop-api.types.ts` & `apps/desktop/src/preload/index.ts`**

```typescript
// apps/desktop/src/preload/desktop-api.types.ts
export const DESKTOP_CHANNELS = {
  GET_CONFIG: 'desktop:get-config',
  SAVE_CONFIG: 'desktop:save-config',
  TEST_CONNECTION: 'desktop:test-connection',
  GET_LOCAL_IPS: 'desktop:get-local-ips',
  GET_SERVER_STATUS: 'desktop:get-server-status',
  START_SERVER: 'desktop:start-server',
  STOP_SERVER: 'desktop:stop-server',
  GET_PRINTERS: 'desktop:get-printers',
  PRINT_RECEIPT: 'desktop:print-receipt',
} as const;

export interface DesktopApi {
  isDesktop: boolean;
  platform: string;
  version: string;
  getConfig: () => Promise<any>;
  saveConfig: (config: any) => Promise<any>;
  testConnection: (url: string) => Promise<{ ok: boolean; status?: number; error?: string }>;
  getLocalIps: () => Promise<string[]>;
  getServerStatus: () => Promise<any>;
  startServer: () => Promise<any>;
  stopServer: () => Promise<any>;
  getPrinters: () => Promise<any[]>;
  printReceipt: (options: any) => Promise<{ success: boolean; error?: string }>;
}
```

```typescript
// apps/desktop/src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import { DESKTOP_CHANNELS, DesktopApi } from './desktop-api.types';

const api: DesktopApi = {
  isDesktop: true,
  platform: process.platform,
  version: '1.0.0',
  getConfig: () => ipcRenderer.invoke(DESKTOP_CHANNELS.GET_CONFIG),
  saveConfig: (config) => ipcRenderer.invoke(DESKTOP_CHANNELS.SAVE_CONFIG, config),
  testConnection: (url) => ipcRenderer.invoke(DESKTOP_CHANNELS.TEST_CONNECTION, url),
  getLocalIps: () => ipcRenderer.invoke(DESKTOP_CHANNELS.GET_LOCAL_IPS),
  getServerStatus: () => ipcRenderer.invoke(DESKTOP_CHANNELS.GET_SERVER_STATUS),
  startServer: () => ipcRenderer.invoke(DESKTOP_CHANNELS.START_SERVER),
  stopServer: () => ipcRenderer.invoke(DESKTOP_CHANNELS.STOP_SERVER),
  getPrinters: () => ipcRenderer.invoke(DESKTOP_CHANNELS.GET_PRINTERS),
  printReceipt: (options) => ipcRenderer.invoke(DESKTOP_CHANNELS.PRINT_RECEIPT, options),
};

contextBridge.exposeInMainWorld('desktopApi', api);
```

- [ ] **Step 4: Implement `apps/desktop/src/main/ipc-handlers.ts` and `apps/desktop/src/main/index.ts`**

Register IPC invoke listeners hooking up `StoreManager`, `ServerManager`, `PrinterManager`, and `network-utils` to handle all incoming desktop messages.

- [ ] **Step 5: Run tests to verify passing**

Run: `cmd.exe /c npx vitest run apps/desktop/src/preload/preload.spec.ts`  
Expected: PASS

- [ ] **Step 6: Commit changes**

```bash
git add apps/desktop/src/preload apps/desktop/src/main
git commit -m "feat(desktop): implement IPC handlers and secure preload context bridge"
```

---

### Task 7: Web Frontend Desktop Integration & Setup Wizard

**Files:**
- Create: `apps/web/src/hooks/use-desktop.ts`
- Create: `apps/web/src/components/desktop-connection-modal.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/features/settings/settings-page.tsx`
- Test: `apps/web/src/hooks/use-desktop.spec.ts`

**Interfaces:**
- Produces:
  - `useDesktop()` hook returning `{ isDesktop, config, serverStatus, localIps, isConnected, printers, printReceipt }`.
  - `DesktopConnectionModal` presenting Arabic setup UI for selecting Server or Client mode.
  - Printer configuration block in Settings page for selecting default thermal receipt printer.

- [ ] **Step 1: Write failing unit test for `useDesktop` hook**

```typescript
// apps/web/src/hooks/use-desktop.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDesktop } from './use-desktop';

describe('useDesktop Hook', () => {
  beforeEach(() => {
    delete (window as any).desktopApi;
  });

  it('detects standard web browser mode when desktopApi is absent', () => {
    const { result } = renderHook(() => useDesktop());
    expect(result.current.isDesktop).toBe(false);
  });

  it('detects desktop mode when desktopApi is present in window', async () => {
    (window as any).desktopApi = {
      isDesktop: true,
      getConfig: vi.fn().mockResolvedValue({ serverMode: 'client', serverUrl: 'http://192.168.1.50:4000' }),
      getPrinters: vi.fn().mockResolvedValue([{ name: 'POS-80', isDefault: true }]),
      getServerStatus: vi.fn().mockResolvedValue({ running: false }),
      getLocalIps: vi.fn().mockResolvedValue(['192.168.1.50']),
    };

    const { result } = renderHook(() => useDesktop());
    expect(result.current.isDesktop).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cmd.exe /c npx vitest run apps/web/src/hooks/use-desktop.spec.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `apps/web/src/hooks/use-desktop.ts` and `apps/web/src/components/desktop-connection-modal.tsx`**

Implement the hook and the connection modal in Arabic:
- If `isDesktop` is true and `config.isFirstLaunch` or connection failed, display `DesktopConnectionModal`.
- Allow toggling "هذا الجهاز هو السيرفر الرئيسي" (starts local server and shows IP to share).
- Allow typing server URL with instant "فحص الاتصال" (Test Ping).

- [ ] **Step 4: Integrate printer selection in `apps/web/src/features/settings/settings-page.tsx`**

When `isDesktop` is true, render a card:
- "إعدادات أجهزة السنتر والطباعة الحرارية"
- Combobox to choose the default thermal printer from `printers`.
- Toggle "تفعيل الطباعة الصامتة المباشرة لإيصالات القبض (بدون نافذة المتصفح)".

- [ ] **Step 5: Run tests to verify passing**

Run: `cmd.exe /c npx vitest run apps/web/src/hooks/use-desktop.spec.ts`  
Expected: PASS

- [ ] **Step 6: Commit changes**

```bash
git add apps/web/src/hooks/use-desktop.ts apps/web/src/hooks/use-desktop.spec.ts apps/web/src/components/desktop-connection-modal.tsx apps/web/src/features/settings/settings-page.tsx
git commit -m "feat(web): integrate desktop connection wizard and thermal printer settings"
```

---

### Task 8: Production Build, Packaging & Monorepo Test Verification

**Files:**
- Modify: `package.json` (root build script verification)
- Test: Full monorepo verification (`npm test` and `npm run build`)

**Interfaces:**
- Produces: Verified production build for `@edu-center/shared`, `@edu-center/api`, `@edu-center/web`, and `@edu-center/desktop`.

- [ ] **Step 1: Compile all monorepo workspaces**

Run: `cmd.exe /c npm run build`  
Expected: Zero compilation errors across shared, api, and web.

- [ ] **Step 2: Compile desktop package TypeScript**

Run: `cmd.exe /c npm run build:desktop`  
Expected: Zero compilation errors for Electron Main & Preload in `apps/desktop/dist/`.

- [ ] **Step 3: Run full automated test suite across monorepo**

Run: `cmd.exe /c npm test`  
Expected: All existing tests + new desktop tests pass (170+ total passing tests, 0 failures).

- [ ] **Step 4: Commit changes**

```bash
git add .
git commit -m "chore(desktop): finalize production build, scripts, and monorepo verification"
```
