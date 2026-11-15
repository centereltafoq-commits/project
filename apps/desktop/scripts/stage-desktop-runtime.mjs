import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const desktopDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(desktopDir, '../..');
const apiDir = path.join(repoRoot, 'apps', 'api');
const webDir = path.join(repoRoot, 'apps', 'web');
const sharedDir = path.join(repoRoot, 'packages', 'shared');

const runtimeRoot = path.join(desktopDir, 'runtime');
const appRuntimeDir = path.join(runtimeRoot, 'app-runtime');
const targetApiDir = path.join(appRuntimeDir, 'api');
const targetApiNodeModules = path.join(targetApiDir, 'node_modules');
const targetWebDir = path.join(appRuntimeDir, 'web');
const targetPgsqlDir = path.join(runtimeRoot, 'pgsql');
const sourcePgsqlDir = path.join(desktopDir, 'resources', 'pgsql');

function assertExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Missing required build output for ${label}: ${targetPath}`);
  }
}

function copyDirClean(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
}

/**
 * Resolves a package directory starting from a consumer's directory using Node's
 * module resolution semantics (supports hoisted root node_modules & nested deps).
 */
function resolvePackageDir(pkgName, fromDir) {
  const resolver = createRequire(path.join(fromDir, 'package.json'));
  try {
    const pkgJsonPath = resolver.resolve(`${pkgName}/package.json`);
    return path.dirname(fs.realpathSync(pkgJsonPath));
  } catch {
    // Fallback for packages without exported package.json in "exports" field
    try {
      const entry = resolver.resolve(pkgName);
      let cursor = path.dirname(fs.realpathSync(entry));
      while (cursor && cursor !== path.dirname(cursor)) {
        const candidatePkg = path.join(cursor, 'package.json');
        if (fs.existsSync(candidatePkg)) {
          const parsed = JSON.parse(fs.readFileSync(candidatePkg, 'utf8'));
          if (parsed.name === pkgName) {
            return cursor;
          }
        }
        cursor = path.dirname(cursor);
      }
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Collects transitive production dependencies (dependencies + optionalDependencies)
 * from apps/api so the packaged desktop app executes apps/api/dist/main.js
 * standalone without devDependencies or the full monorepo node_modules.
 */
function collectProductionPackages(rootConsumerDirs) {
  const visited = new Map(); // packageName -> sourceDir
  const queue = [];

  for (const dir of rootConsumerDirs) {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const depNames = [
      ...Object.keys(pkg.dependencies || {}),
      ...Object.keys(pkg.optionalDependencies || {}),
    ];
    for (const depName of depNames) {
      queue.push({ depName, fromDir: dir });
    }
  }

  while (queue.length > 0) {
    const { depName, fromDir } = queue.shift();
    if (depName === '@edu-center/shared') {
      continue;
    }

    const resolvedDir = resolvePackageDir(depName, fromDir);
    if (!resolvedDir) {
      continue;
    }

    const resolvedKey = `${depName}::${resolvedDir}`;
    if (visited.has(resolvedKey)) {
      continue;
    }
    visited.set(resolvedKey, { depName, resolvedDir });

    const pkgJsonFile = path.join(resolvedDir, 'package.json');
    if (fs.existsSync(pkgJsonFile)) {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonFile, 'utf8'));
      const childDeps = [
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.optionalDependencies || {}),
      ];
      for (const child of childDeps) {
        queue.push({ depName: child, fromDir: resolvedDir });
      }
    }
  }

  return visited;
}

function stageRuntime() {
  assertExists(path.join(apiDir, 'dist', 'main.js'), '@edu-center/api build');
  assertExists(path.join(webDir, 'dist', 'index.html'), '@edu-center/web build');
  assertExists(path.join(sharedDir, 'dist', 'index.js'), '@edu-center/shared build');

  console.log('[Stage] Cleaning previous desktop runtime...');
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
  fs.mkdirSync(targetApiNodeModules, { recursive: true });
  fs.mkdirSync(targetWebDir, { recursive: true });
  fs.mkdirSync(targetPgsqlDir, { recursive: true });

  console.log('[Stage] Copying apps/api dist, drizzle, and indexes...');
  copyDirClean(path.join(apiDir, 'dist'), path.join(targetApiDir, 'dist'));
  copyDirClean(path.join(apiDir, 'drizzle'), path.join(targetApiDir, 'drizzle'));
  fs.copyFileSync(path.join(apiDir, 'package.json'), path.join(targetApiDir, 'package.json'));

  const trigramSrc = path.join(apiDir, 'src', 'database', 'indexes', 'trigram-indexes.sql');
  if (fs.existsSync(trigramSrc)) {
    const trigramDest = path.join(targetApiDir, 'dist', 'database', 'indexes', 'trigram-indexes.sql');
    fs.mkdirSync(path.dirname(trigramDest), { recursive: true });
    fs.copyFileSync(trigramSrc, trigramDest);
  }

  console.log('[Stage] Copying apps/web dist...');
  copyDirClean(path.join(webDir, 'dist'), path.join(targetWebDir, 'dist'));

  console.log('[Stage] Staging @edu-center/shared workspace package...');
  const targetSharedDir = path.join(targetApiNodeModules, '@edu-center', 'shared');
  fs.mkdirSync(targetSharedDir, { recursive: true });
  copyDirClean(path.join(sharedDir, 'dist'), path.join(targetSharedDir, 'dist'));
  fs.copyFileSync(path.join(sharedDir, 'package.json'), path.join(targetSharedDir, 'package.json'));

  console.log('[Stage] Collecting API production dependencies...');
  const packages = collectProductionPackages([apiDir, sharedDir]);
  let copiedCount = 0;
  for (const { depName, resolvedDir } of packages.values()) {
    const destPkgDir = path.join(targetApiNodeModules, depName);
    if (!fs.existsSync(destPkgDir)) {
      copyDirClean(resolvedDir, destPkgDir);
      copiedCount += 1;
    }
  }

  if (fs.existsSync(path.join(sourcePgsqlDir, 'bin', 'pg_ctl.exe'))) {
    console.log('[Stage] Copying bundled Portable PostgreSQL binaries...');
    copyDirClean(sourcePgsqlDir, targetPgsqlDir);
  } else {
    console.log('[Stage] Note: apps/desktop/resources/pgsql not found; creating placeholder pgsql dir (external PostgreSQL supported).');
    fs.writeFileSync(
      path.join(targetPgsqlDir, 'README.txt'),
      'Optional Portable PostgreSQL binaries folder. Run scripts/prepare-portable-postgres.ps1 before packaging to embed standalone PostgreSQL.\n',
      'utf8',
    );
  }

  console.log(`[Stage] Complete! Staged ${copiedCount} production packages into ${appRuntimeDir}`);
}

stageRuntime();
