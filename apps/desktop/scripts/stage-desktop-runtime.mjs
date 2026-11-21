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

const desktopRequire = createRequire(path.join(desktopDir, 'package.json'));
const esbuild = desktopRequire('esbuild');

const ESSENTIAL_PG_EXES = new Set([
  'postgres.exe',
  'initdb.exe',
  'pg_ctl.exe',
  'pg_dump.exe',
  'pg_restore.exe',
  'psql.exe',
]);

function assertExists(targetPath, label) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Missing required build output for ${label}: ${targetPath}`);
  }
}

function copyDirClean(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
}

function measureDir(dirPath) {
  let fileCount = 0;
  let totalBytes = 0;
  const stack = [dirPath];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!cur || !fs.existsSync(cur)) continue;
    for (const entry of fs.readdirSync(cur, { withFileTypes: true })) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        fileCount += 1;
        totalBytes += fs.statSync(full).size;
      }
    }
  }
  return { fileCount, totalMB: (totalBytes / (1024 * 1024)).toFixed(1) };
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
 * Collects transitive production dependencies for explicit native external packages (e.g. argon2)
 * without staging thousands of JS packages already bundled into dist/main.js by esbuild.
 */
function collectPackageTree(seedPackages, fromDir) {
  const visited = new Map();
  const queue = seedPackages.map((depName) => ({ depName, fromDir }));

  while (queue.length > 0) {
    const { depName, fromDir: consumerDir } = queue.shift();
    const resolvedDir = resolvePackageDir(depName, consumerDir);
    if (!resolvedDir) continue;

    const resolvedKey = `${depName}::${resolvedDir}`;
    if (visited.has(resolvedKey)) continue;
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

/**
 * Copies only the runtime-required Portable PostgreSQL files (omitting StackBuilder/wxWidgets,
 * regression tools, 452 localized PO catalogs, and unused contrib extensions) to cut startup
 * extraction time drastically while keeping initdb/postgres/pg_ctl/pg_dump/pg_trgm 100% functional.
 */
function copySlimPostgres(srcDir, destDir) {
  const srcBin = path.join(srcDir, 'bin');
  const destBin = path.join(destDir, 'bin');
  fs.mkdirSync(destBin, { recursive: true });
  for (const entry of fs.readdirSync(srcBin, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const lower = entry.name.toLowerCase();
    const isEssentialExe = lower.endsWith('.exe') && ESSENTIAL_PG_EXES.has(lower);
    const isRequiredDll = lower.endsWith('.dll') && !/^wx(msw|base)/i.test(lower);
    if (isEssentialExe || isRequiredDll) {
      fs.copyFileSync(path.join(srcBin, entry.name), path.join(destBin, entry.name));
    }
  }

  const system32Dir = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32');
  for (const vcDll of ['vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll']) {
    const destDll = path.join(destBin, vcDll);
    const srcSysDll = path.join(system32Dir, vcDll);
    if (!fs.existsSync(destDll) && fs.existsSync(srcSysDll)) {
      fs.copyFileSync(srcSysDll, destDll);
    }
  }

  copyDirClean(path.join(srcDir, 'lib'), path.join(destDir, 'lib'));

  const srcShare = path.join(srcDir, 'share');
  const destShare = path.join(destDir, 'share');
  fs.mkdirSync(destShare, { recursive: true });

  for (const entry of fs.readdirSync(srcShare, { withFileTypes: true })) {
    const srcPath = path.join(srcShare, entry.name);
    const destPath = path.join(destShare, entry.name);
    if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    } else if (
      entry.isDirectory() &&
      (entry.name === 'tsearch_data' || entry.name === 'timezonesets' || entry.name === 'timezone')
    ) {
      copyDirClean(srcPath, destPath);
    } else if (entry.isDirectory() && entry.name === 'extension') {
      fs.mkdirSync(destPath, { recursive: true });
      for (const extFile of fs.readdirSync(srcPath)) {
        if (extFile.startsWith('plpgsql') || extFile.startsWith('pg_trgm')) {
          fs.copyFileSync(path.join(srcPath, extFile), path.join(destPath, extFile));
        }
      }
    }
  }
}

async function stageRuntime() {
  assertExists(path.join(apiDir, 'dist', 'main.js'), '@edu-center/api build');
  assertExists(path.join(webDir, 'dist', 'index.html'), '@edu-center/web build');
  assertExists(path.join(sharedDir, 'dist', 'index.js'), '@edu-center/shared build');

  console.log('[Stage] Cleaning previous desktop runtime...');
  fs.rmSync(runtimeRoot, { recursive: true, force: true });
  fs.mkdirSync(path.join(targetApiDir, 'dist'), { recursive: true });
  fs.mkdirSync(targetApiNodeModules, { recursive: true });
  fs.mkdirSync(targetWebDir, { recursive: true });
  fs.mkdirSync(targetPgsqlDir, { recursive: true });

  console.log('[Stage] Bundling NestJS API into single file via esbuild...');
  await esbuild.build({
    entryPoints: [path.join(apiDir, 'dist', 'main.js')],
    outfile: path.join(targetApiDir, 'dist', 'main.js'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    keepNames: true,
    sourcemap: false,
    minify: false,
    external: [
      'argon2',
      'pg-native',
      '@nestjs/microservices',
      '@nestjs/microservices/*',
      '@nestjs/websockets',
      '@nestjs/websockets/*',
      'class-transformer/storage',
      'cache-manager',
      '@fastify/static',
      '@fastify/view',
      'fsevents',
    ],
    plugins: [
      {
        name: 'strip-ide-build-hooks',
        setup(build) {
          build.onResolve({ filter: /console-ninja|wallaby/i }, () => ({
            path: 'ide-hook-noop',
            namespace: 'ide-hook-noop',
          }));
          build.onLoad({ filter: /.*/, namespace: 'ide-hook-noop' }, () => ({
            contents: 'exports.default = function () {};',
            loader: 'js',
          }));
        },
      },
    ],
  });

  console.log('[Stage] Copying apps/api drizzle, package.json, and trigram SQL...');
  copyDirClean(path.join(apiDir, 'drizzle'), path.join(targetApiDir, 'drizzle'));
  fs.copyFileSync(path.join(apiDir, 'package.json'), path.join(targetApiDir, 'package.json'));

  const envFile = path.join(apiDir, '.env');
  const parsedEnv = {};
  if (fs.existsSync(envFile)) {
    for (const rawLine of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq > 0) {
        parsedEnv[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
      }
    }
  }
  const syncUrl = process.env.SUPABASE_SYNC_URL || parsedEnv.SUPABASE_SYNC_URL || '';
  const syncKey = process.env.SUPABASE_SYNC_KEY || parsedEnv.SUPABASE_SYNC_KEY || '';
  const syncBucket =
    process.env.SUPABASE_SYNC_BUCKET || parsedEnv.SUPABASE_SYNC_BUCKET || 'educenter-sync';
  if (syncUrl && syncKey) {
    fs.writeFileSync(
      path.join(targetApiDir, 'cloud-sync-defaults.json'),
      JSON.stringify(
        {
          SUPABASE_SYNC_URL: syncUrl,
          SUPABASE_SYNC_KEY: syncKey,
          SUPABASE_SYNC_BUCKET: syncBucket,
        },
        null,
        2,
      ),
      'utf8',
    );
    console.log('[Stage] Staged Supabase cloud-sync-defaults.json into desktop app-runtime.');
  }

  const trigramSrc = path.join(apiDir, 'src', 'database', 'indexes', 'trigram-indexes.sql');
  if (fs.existsSync(trigramSrc)) {
    for (const relDest of [
      path.join('dist', 'indexes', 'trigram-indexes.sql'),
      path.join('dist', 'database', 'indexes', 'trigram-indexes.sql'),
    ]) {
      const trigramDest = path.join(targetApiDir, relDest);
      fs.mkdirSync(path.dirname(trigramDest), { recursive: true });
      fs.copyFileSync(trigramSrc, trigramDest);
    }
  }

  console.log('[Stage] Staging native argon2 dependency tree...');
  const nativeDeps = collectPackageTree(['argon2'], apiDir);
  let copiedCount = 0;
  for (const { depName, resolvedDir } of nativeDeps.values()) {
    const destPkgDir = path.join(targetApiNodeModules, depName);
    if (!fs.existsSync(destPkgDir)) {
      copyDirClean(resolvedDir, destPkgDir);
      copiedCount += 1;
    }
  }

  console.log('[Stage] Copying apps/web dist...');
  copyDirClean(path.join(webDir, 'dist'), path.join(targetWebDir, 'dist'));

  if (fs.existsSync(path.join(sourcePgsqlDir, 'bin', 'pg_ctl.exe'))) {
    console.log('[Stage] Copying slimmed Portable PostgreSQL binaries...');
    copySlimPostgres(sourcePgsqlDir, targetPgsqlDir);
  } else {
    console.log(
      '[Stage] Note: apps/desktop/resources/pgsql not found; creating placeholder pgsql dir (external PostgreSQL supported).',
    );
    fs.writeFileSync(
      path.join(targetPgsqlDir, 'README.txt'),
      'Optional Portable PostgreSQL binaries folder. Run scripts/prepare-portable-postgres.ps1 before packaging to embed standalone PostgreSQL.\n',
      'utf8',
    );
  }

  const runtimeStats = measureDir(appRuntimeDir);
  const pgsqlStats = measureDir(targetPgsqlDir);
  console.log(
    `[Stage] Complete! app-runtime: ${runtimeStats.fileCount} files (${runtimeStats.totalMB} MB, ${copiedCount} native external pkg), pgsql: ${pgsqlStats.fileCount} files (${pgsqlStats.totalMB} MB).`,
  );
}

await stageRuntime();
