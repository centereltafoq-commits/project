import * as fs from 'fs';
import * as path from 'path';
import * as argon2 from 'argon2';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
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

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });

  try {
    const tblRes = await pool.query<{ tbl: string | null }>(
      "SELECT to_regclass('public.users') AS tbl",
    );
    const hasUsersTable = Boolean(tblRes.rows[0]?.tbl);

    if (!hasUsersTable) {
      const drizzleDir = resolveDrizzleDir(options?.drizzleDir);
      if (!drizzleDir) {
        throw new Error('Could not locate Drizzle SQL migration files to initialize empty database');
      }

      const sqlFiles = fs
        .readdirSync(drizzleDir)
        .filter((f) => f.endsWith('.sql'))
        .sort();

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const file of sqlFiles) {
          const content = fs.readFileSync(path.join(drizzleDir, file), 'utf8');
          const statements = splitDrizzleSqlStatements(content);
          for (const stmt of statements) {
            await client.query(stmt);
          }
        }
        await client.query('COMMIT');
        schemaInitialized = true;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }

      const trigramPath = resolveTrigramSqlPath();
      if (trigramPath) {
        try {
          const trigramSql = fs.readFileSync(trigramPath, 'utf8');
          await pool.query(trigramSql);
        } catch {
          // Non-fatal: pg_trgm extension might require elevated privileges on some hosts
        }
      }
    }

    const userCountRes = await pool.query<{ cnt: number }>('SELECT COUNT(*)::int AS cnt FROM users');
    if ((userCountRes.rows[0]?.cnt ?? 0) === 0) {
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

      const roleIdByCode = new Map<SystemRole, string>();
      for (const r of SEED_ROLES_DATA) {
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

      const ownerEmail = (process.env.SEED_OWNER_EMAIL || 'admin@educenter.com').toLowerCase();
      const ownerPassword = process.env.SEED_OWNER_PASSWORD || 'Admin@123456';
      const ownerHash = await argon2.hash(ownerPassword, { type: argon2.argon2id });

      const [ownerRow] = await db
        .insert(users)
        .values({
          fullName: 'مالك ومدير السنتر',
          email: ownerEmail,
          phone: '01000000001',
          passwordHash: ownerHash,
          roleId: roleIdByCode.get(SystemRole.OWNER)!,
          isActive: true,
        })
        .onConflictDoNothing({ target: users.email })
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
