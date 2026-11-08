# Design Specification: Desktop Application Subsystem (`@edu-center/desktop`)

**Date:** 2026-11-08  
**Author:** Senior Software Architect  
**Status:** Approved for Implementation Planning  
**Target:** Educational Center Multi-Device Local Area Network (LAN) & Windows Desktop App

---

## 1. Overview & Business Objectives

Educational centers operate in physical premises where multiple administrative stations (Reception, Cashier, Owner Office, Supervisor Rooms) coordinate operations concurrently. 

This design establishes a dedicated Windows Desktop Application package (`@edu-center/desktop`) inside the monorepo that provides:
1. **Multi-Station Local Network Operation (Client/Server Mode):**
   - **Server Station (الجهاز الرئيسي):** Runs the local PostgreSQL database and launches the NestJS backend as a managed background process, broadcasting its local network IP (e.g. `192.168.1.15:4000`) for all other center machines.
   - **Client Stations (أجهزة الاستقبال والفرعية):** Connect to the server station over the local Wi-Fi / Ethernet network via an initial zero-hassle connection setup wizard.
2. **Direct Silent Thermal Printing (الطباعة الصامتة المباشرة):**
   - Bypasses the native browser print preview dialog for student payment receipts, sending formatted 80mm thermal receipt jobs directly to the cashier's USB/network thermal printer in <300ms.
   - Provides standard A4 preview printing for detailed financial reports and schedules.
3. **Enterprise Security & Reliability:**
   - Strict Electron context isolation (`contextIsolation: true`, `nodeIntegration: false`).
   - Resilient offline/disconnection detection with auto-reconnect polling and friendly Arabic notifications.
   - Single-click Windows Installer (`EduCenter-Setup.exe`) generation via `electron-builder`.

---

## 2. Monorepo Architecture & Package Structure

A new workspace package `apps/desktop` will be introduced into the root `package.json` workspaces.

```
management system/
├── apps/
│   ├── api/                    # NestJS Backend API
│   ├── web/                    # React 18 + Vite Web Application
│   └── desktop/                # NEW: Electron Desktop Subsystem
│       ├── package.json        # Electron, electron-builder, dependencies
│       ├── tsconfig.json       # TypeScript configuration for Main & Preload
│       ├── electron-builder.json # Windows NSIS installer packaging configuration
│       ├── resources/          # Center icons (icon.ico, icon.png)
│       └── src/
│           ├── main/
│           │   ├── index.ts              # Electron Main Process entry point & Window lifecycle
│           │   ├── server-manager.ts     # Managed child process controller for NestJS API
│           │   ├── printer-manager.ts    # Native silent thermal printing & printer discovery
│           │   ├── network-utils.ts      # IPv4 local network interface detector
│           │   ├── store-manager.ts      # Local persistent configuration (server URL, printers)
│           │   └── ipc-handlers.ts       # IPC message handlers exposing capabilities to preload
│           └── preload/
│               ├── index.ts              # Secure ContextBridge exposing window.desktopApi
│               └── desktop-api.types.ts  # TypeScript declarations for the exposed API
```

---

## 3. Detailed Component Architecture

### 3.1. Main Process Lifecycle (`src/main/index.ts`)
- Initializes a single-instance lock (`app.requestSingleInstanceLock()`). If another instance launches, it restores and focuses the primary window.
- Manages `BrowserWindow` creation with optimized desktop window dimensions (1280x800 minimum, remembered from previous session via `store-manager`).
- Evaluates application mode:
  - If server configuration is missing, loads an internal connection setup view.
  - If configured in **Server Mode**, checks if NestJS API is running; if not, triggers `serverManager.startServer()`, verifies port 4000 availability, and loads `http://localhost:4000`.
  - If configured in **Client Mode**, verifies ping to the remote server IP (e.g., `http://192.168.1.50:4000/api/settings`), and loads the remote web interface.

### 3.2. Server Manager (`src/main/server-manager.ts`)
- **Child Process Execution:** Spawns `node apps/api/dist/main.js` with inherited environment variables and working directory.
- **Health Checks & Telemetry:** Periodically probes `GET /api/settings` to ascertain readiness.
- **Lifecycle Guarantees:** Registers process exit hooks (`before-quit`, `SIGINT`, `SIGTERM`) to gracefully terminate the backend child process without leaving orphaned processes on port 4000.
- **Local IP Discovery:** Uses Node's `os.networkInterfaces()` to detect all non-internal IPv4 addresses and identifies the active LAN IP to display to the owner (e.g. `http://192.168.1.100:4000`).

### 3.3. Direct Thermal Receipt Printer Manager (`src/main/printer-manager.ts`)
- **Printer Discovery:** Calls `webContents.getPrintersAsync()` to retrieve all installed Windows printers with status, model name, and default flags.
- **Silent Printing Pipeline:**
  1. The Web UI sends receipt payload and target printer name via `desktopApi.printReceiptSilent({ printerName, htmlContent, width: '80mm' })`.
  2. Main process creates a hidden, offscreen `BrowserWindow` with explicit CSS width for 80mm roll paper (72mm printable width, margin 0).
  3. Loads the formatted receipt HTML with custom barcode/QR code rendering.
  4. Calls `offscreenWindow.webContents.print({ silent: true, deviceName: printerName, printBackground: true })`.
  5. Destroys the offscreen window upon print completion and returns a success status with timestamp.

### 3.4. Secure Context Bridge (`src/preload/index.ts`)
Exposes `window.desktopApi` to the web renderer via `contextBridge.exposeInMainWorld`:

```typescript
export interface DesktopApi {
  isDesktop: boolean;
  platform: 'win32' | 'darwin' | 'linux';
  version: string;
  
  // Connection & Mode Config
  getConnectionConfig: () => Promise<ConnectionConfig>;
  saveConnectionConfig: (config: ConnectionConfig) => Promise<{ success: boolean }>;
  testServerConnection: (url: string) => Promise<{ ok: boolean; status?: number; error?: string }>;
  getLocalNetworkIps: () => Promise<string[]>;
  
  // Server Management (Server Mode)
  getServerStatus: () => Promise<{ running: boolean; pid?: number; port: number; uptime?: number }>;
  startLocalServer: () => Promise<{ success: boolean; error?: string }>;
  stopLocalServer: () => Promise<{ success: boolean }>;
  restartLocalServer: () => Promise<{ success: boolean }>;
  
  // Hardware & Printing
  getInstalledPrinters: () => Promise<PrinterInfo[]>;
  printReceiptSilent: (options: SilentPrintOptions) => Promise<{ success: boolean; error?: string }>;
  
  // System Events
  onServerStatusChanged: (callback: (status: ServerStatus) => void) => () => void;
  onNetworkStatusChanged: (callback: (online: boolean) => void) => () => void;
}
```

---

## 4. Frontend Web Integration (`apps/web`)

1. **Desktop Detection & Environment Detection:**
   - A global hook `useDesktop()` detects if `window.desktopApi?.isDesktop` exists.
   - If in desktop mode, it surfaces the local hardware controls (Printer selection, Server IP display in header for Owner).
2. **Server Connection Wizard Screen (`DesktopConnectionModal` / `ConnectionSetupView`):**
   - Renders automatically if the desktop app cannot reach the server or when launched for the first time.
   - Displays clear Arabic interface:
     - **زر "تشغيل هذا الجهاز كسيرفر رئيسي للسنتر":** Configures `http://localhost:4000`, starts local server, and displays the local IP to share with team members.
     - **حقل "الاتصال بسيرفر السنتر":** Accepts `http://[IP]:4000` with an instant "فحص الاتصال" (Test Ping) button that checks health before saving.
3. **Thermal Receipt Printing Integration:**
   - On the Student Payment page (`/finance` & receipt modal), if `useDesktop()` is active and a default receipt printer is configured in settings, clicking "طباعة الإيصال" invokes `desktopApi.printReceiptSilent(...)` directly.
   - If not in desktop mode (or if direct printing is toggled off), it gracefully falls back to the existing standard browser print dialog (`window.print()`).
4. **Settings Page Enhancements (`/settings`):**
   - Adds a "إعدادات أجهزة السنتر والطباعة (Desktop & Hardware)" section when running inside the desktop app.
   - Allows selecting the default 80mm thermal printer from a dropdown populated by `desktopApi.getInstalledPrinters()`.
   - Shows local server status and network IP for the Owner.

---

## 5. Security Architecture

1. **Context Isolation & Sandbox:**
   - `webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }`.
   - No direct access to `require('child_process')` or `fs` from the renderer.
2. **Strict IPC Input Validation:**
   - All IPC parameters (printer names, server URLs) are strictly sanitized and validated against whitelist schemes (`http://`, `https://`).
   - Printer HTML content is rendered inside an isolated offscreen window with script execution disabled (`javascript: false`).
3. **Database & Network Boundaries:**
   - PostgreSQL remains isolated on the server machine, listening on standard port `5432` or accessible via local loopback.
   - Clients only communicate via the authenticated NestJS HTTP/WebSocket API. No direct database exposure over LAN.

---

## 6. Build, Packaging & Distribution Pipeline

1. **Development Commands:**
   - `npm run dev:desktop`: Concurrently launches API, Web, and Electron Main in watch mode.
   - `npm run dev:desktop:client`: Launches Electron pointing to a remote dev server.
2. **Production Packaging (`electron-builder`):**
   - Compiles TypeScript for Main and Preload.
   - Runs `npm run build` across `@edu-center/shared`, `@edu-center/api`, and `@edu-center/web`.
   - Bundles the production frontend assets and runtime binaries into an NSIS installer:
     - Output: `apps/desktop/dist/EduCenter-Setup-1.0.0.exe`
     - Desktop icon, Start Menu shortcut, uninstaller included.
     - Option for Portable EXE (`EduCenter-Portable.exe`) for running from USB flash drives.

---

## 7. Testing & Verification Plan

1. **Unit Tests:**
   - `server-manager.spec.ts`: Tests process spawning, signal termination, crash recovery, and health check polling.
   - `printer-manager.spec.ts`: Tests printer enumeration, payload formatting, and error handling for disconnected printers.
   - `network-utils.spec.ts`: Tests IPv4 LAN IP resolution across virtual and physical network adapters.
2. **Integration Tests:**
   - ContextBridge interface tests verifying type contracts and IPC channel whitelisting.
   - Frontend `useDesktop()` hook test simulating both web browser and desktop runtime environments.
3. **End-to-End Build Verification:**
   - Build `apps/desktop` and ensure zero TypeScript compilation errors.
   - Verify that all existing 164 monorepo tests continue to pass without regression.

---

## 8. User Approval & Next Steps

Upon review and approval of this design specification:
1. Commit this specification to `docs/superpowers/specs/2026-11-08-desktop-application-design.md`.
2. Invoke the `writing-plans` skill to generate a step-by-step implementation plan.
3. Execute the implementation with test-driven discipline.
