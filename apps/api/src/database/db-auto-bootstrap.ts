import * as fs from 'fs';
import * as path from 'path';
import * as argon2 from 'argon2';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { DEFAULT_ROLE_PERMISSIONS, SystemRole } from '@edu-center/shared';
import * as schema from './schemas';
import { permissions, rolePermissions, roles, systemSettings, users } from './schemas';
import { buildSeedPermissionsList, SEED_ROLES_DATA } from './seeds/seed-identity.data';

export interface DbAutoBootstrapResult {
  databaseCreated: boolean;
  schemaInitialized: boolean;
  identitySeeded: boolean;
}

export function resolveDrizzleDir(explicitDir?: string): string | null {
  if (typeof explicitDir === 'string' && explicitDir.trim().length > 0) {
    const resolved = path.resolve(explicitDir);
    if (fs.existsSync(resolved) && fs.readdirSync(resolved).some((f) => f.endsWith('.sql'))) {
      return resolved;
    }
    return null;
  }

  const candidates = [
    process.env.API_DRIZZLE_DIR,
    path.resolve(__dirname, '../../drizzle'),
    path.resolve(process.cwd(), 'drizzle'),
    path.resolve(process.cwd(), 'apps/api/drizzle'),
  ].filter((p): p is string => typeof p === 'string' && p.trim().length > 0);

  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith('.sql'))) {
      return dir;
    }
  }
  return null;
}

function resolveTrigramSqlPath(): string | null {
  const candidates = [
    path.resolve(__dirname, 'indexes/trigram-indexes.sql'),
    path.resolve(__dirname, '../../src/database/indexes/trigram-indexes.sql'),
    path.resolve(process.cwd(), 'src/database/indexes/trigram-indexes.sql'),
    path.resolve(process.cwd(), 'apps/api/src/database/indexes/trigram-indexes.sql'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

/**
 * Splits a Drizzle-generated SQL file into executable SQL statements.
 */
export function splitDrizzleSqlStatements(sqlContent: string): string[] {
  return sqlContent
    .split('--> statement-breakpoint')
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
}

/**
 * Ensures the target PostgreSQL database exists, applies baseline schema DDL
 * when empty, and seeds baseline roles/permissions + default OWNER user so a
 * brand-new teacher installation works immediately with zero manual setup.
 */
export async function ensureDatabaseReady(
  databaseUrl: string,
  options?: { drizzleDir?: string },
): Promise<DbAutoBootstrapResult> {
  if (!databaseUrl || !databaseUrl.trim()) {
    throw new Error('DATABASE_URL is required before booting the API');
  }

  let databaseCreated = false;
  let schemaInitialized = false;
  let identitySeeded = false;

  const parsed = new URL(databaseUrl);
  const dbName = parsed.pathname.replace(/^\//, '').trim();
  if (dbName && !/^[a-zA-Z0-9_-]+$/.test(dbName)) {
    throw new Error(`Invalid PostgreSQL database name: ${dbName}`);
  }

  if (dbName && dbName !== 'postgres') {
    const maintenanceUrl = new URL(parsed.toString());
    maintenanceUrl.pathname = '/postgres';
    const maintPool = new Pool({
      connectionString: maintenanceUrl.toString(),
      connectionTimeoutMillis: 5000,
    });
    try {
      const existsRes = await maintPool.query<{ exists: number }>(
        'SELECT 1 AS exists FROM pg_database WHERE datname = $1 LIMIT 1',
        [dbName],
      );
      if (existsRes.rowCount === 0) {
        await maintPool.query(`CREATE DATABASE "${dbName}"`);
        databaseCreated = true;
      }
    } catch {
      // Ignore if maintenance DB is restricted; continue directly with target DB
    } finally {
      await maintPool.end().catch(() => undefined);
    }
  }

  const drizzleDir = resolveDrizzleDir(options?.drizzleDir);
  if (!drizzleDir) {
    throw new Error('Could not locate Drizzle SQL migration files to initialize the database');
  }
  schemaInitialized = await migrateDatabaseSchema(databaseUrl, { drizzleDir });

  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  try {
    const trigramPath = resolveTrigramSqlPath();
    if (trigramPath && schemaInitialized) {
      try {
        const trigramSql = fs.readFileSync(trigramPath, 'utf8');
        await pool.query(trigramSql);
      } catch {
        // Non-fatal: pg_trgm extension might require elevated privileges on some hosts
      }
    }

    const db = drizzle(pool, { schema });
    const permList = buildSeedPermissionsList();
    const permIdByCode = new Map<string, string>();

    for (const p of permList) {
      const [row] = await db
        .insert(permissions)
        .values(p)
        .onConflictDoUpdate({
          target: permissions.code,
          set: { module: p.module, nameAr: p.nameAr },
        })
        .returning({ id: permissions.id, code: permissions.code });
      permIdByCode.set(row.code, row.id);
    }

    const existingRoles = await db
      .select({ id: roles.id, code: roles.code })
      .from(roles);
    const existingRoleCodeSet = new Set(existingRoles.map((r) => r.code));
    const roleIdByCode = new Map<SystemRole, string>(
      existingRoles.map((r) => [r.code as SystemRole, r.id]),
    );

    for (const r of SEED_ROLES_DATA) {
      const isNewRole = !existingRoleCodeSet.has(r.code);
      const [roleRow] = await db
        .insert(roles)
        .values({
          code: r.code,
          nameAr: r.nameAr,
          description: r.description,
          isSystem: true,
        })
        .onConflictDoUpdate({
          target: roles.code,
          set: { nameAr: r.nameAr, description: r.description, isSystem: true },
        })
        .returning({ id: roles.id });
      roleIdByCode.set(r.code, roleRow.id);

      // Seed default permissions only when introducing a new built-in role so custom edits by OWNER stay intact
      if (isNewRole) {
        for (const code of DEFAULT_ROLE_PERMISSIONS[r.code] || []) {
          const permId = permIdByCode.get(code);
          if (permId) {
            await db
              .insert(rolePermissions)
              .values({ roleId: roleRow.id, permissionId: permId })
              .onConflictDoNothing({
                target: [rolePermissions.roleId, rolePermissions.permissionId],
              });
          }
        }
      }
    }

    const userCountRes = await pool.query<{ cnt: number }>('SELECT COUNT(*)::int AS cnt FROM users');
    if ((userCountRes.rows[0]?.cnt ?? 0) === 0) {
      const ownerEmail = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase() || 'admin@educenter.com';
      const ownerPhone = process.env.SEED_OWNER_PHONE?.trim() || '01000000001';
      const ownerPassword = process.env.SEED_OWNER_PASSWORD || 'Admin@123456';
      const ownerHash = await argon2.hash(ownerPassword, { type: argon2.argon2id });

      const [ownerRow] = await db
        .insert(users)
        .values({
          fullName: 'مالك ومدير السنتر',
          email: ownerEmail,
          phone: ownerPhone,
          passwordHash: ownerHash,
          roleId: roleIdByCode.get(SystemRole.OWNER)!,
          isActive: true,
        })
        .onConflictDoNothing()
        .returning({ id: users.id });

      await db
        .insert(systemSettings)
        .values({
          id: 'default',
          centerName: 'سنتر النخبة التعليمي',
          centerSubtitle: 'نظام الإدارة المتكامل',
          currencySymbol: 'ج.م',
          updatedBy: ownerRow?.id ?? null,
        })
        .onConflictDoNothing({ target: systemSettings.id });

      identitySeeded = true;
    }
  } finally {
    await pool.end();
  }

  return {
    databaseCreated,
    schemaInitialized,
    identitySeeded,
  };
}

const MIGRATION_LOCK_KEY = 'edu-center:database-migrations';
const MIGRATION_HISTORY_SCHEMA = 'drizzle';
const MIGRATION_HISTORY_TABLE = '__drizzle_migrations';

/** Apply Drizzle's numbered migrations under one PostgreSQL session lock. */
export async function migrateDatabaseSchema(
  databaseUrl: string,
  options?: { drizzleDir?: string },
): Promise<boolean> {
  if (!databaseUrl || !databaseUrl.trim()) {
    throw new Error('DATABASE_URL is required before applying database migrations');
  }
  const drizzleDir = resolveDrizzleDir(options?.drizzleDir);
  if (!drizzleDir) {
    throw new Error('Could not locate Drizzle SQL migration files');
  }

  const migrations = readMigrationFiles({ migrationsFolder: drizzleDir });
  if (migrations.length === 0) throw new Error('No numbered Drizzle migrations were found');

  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 });
  const client = await pool.connect();
  let lockAcquired = false;
  let schemaInitialized = false;
  try {
    await client.query('SELECT pg_advisory_lock(hashtextextended($1, 0))', [MIGRATION_LOCK_KEY]);
    lockAcquired = true;

    const migrationHistory = await client.query<{ tbl: string | null }>(
      "SELECT to_regclass('drizzle.__drizzle_migrations') AS tbl",
    );
    let appliedHashes: string[] = [];
    if (migrationHistory.rows[0]?.tbl) {
      const result = await client.query<{ hash: string }>(
        'SELECT hash FROM drizzle.__drizzle_migrations ORDER BY created_at',
      );
      appliedHashes = result.rows.map((row) => row.hash);
    }

    if (appliedHashes.length === 0) {
      const tableCount = await client.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
      );
      const isEmptyDatabase = Number(tableCount.rows[0]?.count ?? 0) === 0;

      if (!isEmptyDatabase) {
        await assertBaselineSchemaPresent(client, drizzleDir);
        const baseline = migrations[0]!;
        await client.query('BEGIN');
        try {
          await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
          await client.query(`
            CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
              id SERIAL PRIMARY KEY,
              hash text NOT NULL,
              created_at bigint
            )
          `);
          await client.query(
            'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
            [baseline.hash, baseline.folderMillis],
          );
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK').catch(() => undefined);
          throw error;
        }
      } else {
        schemaInitialized = true;
      }
    } else {
      const firstMigration = migrations[0]!;
      if (!appliedHashes.includes(firstMigration.hash)) {
        throw new Error(
          'Migration history does not contain the baseline migration hash; refusing to apply the baseline over an existing schema.',
        );
      }
    }

    const db = drizzle(client, { schema });
    await migrate(db, {
      migrationsFolder: drizzleDir,
      migrationsSchema: MIGRATION_HISTORY_SCHEMA,
      migrationsTable: MIGRATION_HISTORY_TABLE,
    });
    return schemaInitialized;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Database migration failed: ${message}`, { cause: error });
  } finally {
    if (lockAcquired) {
      await client
        .query('SELECT pg_advisory_unlock(hashtextextended($1, 0))', [MIGRATION_LOCK_KEY])
        .catch(() => undefined);
    }
    client.release();
    await pool.end();
  }
}

async function assertBaselineSchemaPresent(
  client: import('pg').PoolClient,
  drizzleDir: string,
): Promise<void> {
  const snapshotPath = path.join(drizzleDir, 'meta', '0000_snapshot.json');
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(`Cannot verify an existing database: baseline snapshot is missing at ${snapshotPath}`);
  }

  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8')) as {
    tables?: Record<string, { name: string; columns?: Record<string, unknown> }>;
  };
  const expected = Object.values(snapshot.tables ?? {});
  const actualResult = await client.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public'`,
  );
  const actual = new Set(actualResult.rows.map((row) => `${row.table_name}.${row.column_name}`));
  const missing = expected.flatMap((table) =>
    Object.keys(table.columns ?? {})
      .filter((column) => !actual.has(`${table.name}.${column}`))
      .map((column) => `${table.name}.${column}`),
  );

  if (missing.length > 0) {
    throw new Error(
      `Existing database is missing ${missing.length} required baseline column(s): ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? ', …' : ''}. Restore the missing schema items or restore a valid database backup before migrating.`,
    );
  }
}
