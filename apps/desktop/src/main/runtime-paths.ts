import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface RuntimeSecrets {
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  annualResetPin: string;
}

/**
 * Resolves a writable user-data directory for desktop configs, logs,
 * generated cryptographic secrets, and local PostgreSQL data files.
 */
export function resolveDesktopDataDir(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron');
    const app = electron?.app || electron?.default?.app;
    if (app && typeof app.getPath === 'function') {
      return app.getPath('userData');
    }
  } catch {
    // Running outside Electron (Vitest or Node CLI)
  }

  return path.join(os.homedir(), '.educenter-erp');
}

function getPackagedResourcesPath(): string | null {
  const withRes = process as NodeJS.Process & { resourcesPath?: string };
  if (typeof withRes.resourcesPath === 'string' && withRes.resourcesPath.trim().length > 0) {
    return withRes.resourcesPath;
  }
  return null;
}

/**
 * Resolves the built NestJS API entrypoint path (`dist/main.js`) across both
 * packaged electron-builder resources and monorepo development mode.
 */
export function resolveApiDistPath(explicitPath?: string): string {
  if (explicitPath) {
    return path.resolve(explicitPath);
  }

  const resPath = getPackagedResourcesPath();
  const candidates = [
    resPath ? path.join(resPath, 'app-runtime', 'api', 'dist', 'main.js') : null,
    path.resolve(process.cwd(), 'apps/api/dist/main.js'),
    path.resolve(__dirname, '../../../../api/dist/main.js'),
  ].filter((p): p is string => Boolean(p));

  return candidates.find((p) => fs.existsSync(p)) ?? candidates[0]!;
}

/**
 * Resolves built React SPA files (`web/dist`) so the unified API serves frontend pages.
 */
export function resolveWebDistPath(): string | null {
  const resPath = getPackagedResourcesPath();
  const candidates = [
    resPath ? path.join(resPath, 'app-runtime', 'web', 'dist') : null,
    path.resolve(process.cwd(), 'apps/web/dist'),
    path.resolve(__dirname, '../../../../web/dist'),
  ].filter((p): p is string => Boolean(p));

  return candidates.find((p) => fs.existsSync(path.join(p, 'index.html'))) ?? null;
}

/**
 * Resolves Drizzle SQL migration directory for auto-initializing blank DBs.
 */
export function resolveApiDrizzleDir(): string | null {
  const resPath = getPackagedResourcesPath();
  const candidates = [
    resPath ? path.join(resPath, 'app-runtime', 'api', 'drizzle') : null,
    path.resolve(process.cwd(), 'apps/api/drizzle'),
    path.resolve(__dirname, '../../../../api/drizzle'),
  ].filter((p): p is string => Boolean(p));

  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

/**
 * Resolves bundled Portable PostgreSQL installation folder if packaged.
 */
export function resolvePortablePostgresDir(): string | null {
  const resPath = getPackagedResourcesPath();
  const candidates = [
    resPath ? path.join(resPath, 'pgsql') : null,
    path.resolve(process.cwd(), 'apps/desktop/resources/pgsql'),
    path.resolve(__dirname, '../../resources/pgsql'),
  ].filter((p): p is string => Boolean(p));

  return (
    candidates.find((p) => fs.existsSync(path.join(p, 'bin', 'pg_ctl.exe'))) ?? null
  );
}

/**
 * Determines which Node binary runs the local API server. Inside Electron,
 * uses Electron's embedded Node engine (`ELECTRON_RUN_AS_NODE=1`) so end-users
 * never need to install Node.js manually.
 */
export function resolveNodeRuntimeCommand(explicitCommand?: string): {
  command: string;
  useElectronAsNode: boolean;
} {
  if (explicitCommand) {
    return { command: explicitCommand, useElectronAsNode: false };
  }

  const versions = process.versions as Record<string, string | undefined>;
  if (versions?.electron) {
    return { command: process.execPath, useElectronAsNode: true };
  }

  return { command: 'node', useElectronAsNode: false };
}

/**
 * Reads or generates persistent cryptographic runtime secrets inside dataDir so
 * fresh installations boot securely without manual `.env` file editing.
 */
export function ensureRuntimeSecrets(dataDir = resolveDesktopDataDir()): RuntimeSecrets {
  const secretsPath = path.join(dataDir, 'runtime-secrets.json');

  try {
    if (fs.existsSync(secretsPath)) {
      const parsed = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
      if (
        typeof parsed?.jwtAccessSecret === 'string' &&
        parsed.jwtAccessSecret.length >= 24 &&
        typeof parsed?.jwtRefreshSecret === 'string' &&
        parsed.jwtRefreshSecret.length >= 24
      ) {
        return {
          jwtAccessSecret: parsed.jwtAccessSecret,
          jwtRefreshSecret: parsed.jwtRefreshSecret,
          annualResetPin:
            typeof parsed.annualResetPin === 'string' ? parsed.annualResetPin : '123456',
        };
      }
    }
  } catch {
    // Regenerate cleanly if file was unreadable
  }

  const generated: RuntimeSecrets = {
    jwtAccessSecret: crypto.randomBytes(48).toString('hex'),
    jwtRefreshSecret: crypto.randomBytes(48).toString('hex'),
    annualResetPin: '123456',
  };

  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(secretsPath, JSON.stringify(generated, null, 2), 'utf8');
  } catch {
    // Non-fatal in read-only environments
  }

  return generated;
}
