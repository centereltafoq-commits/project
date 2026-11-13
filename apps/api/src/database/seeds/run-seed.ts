import * as path from 'path';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as argon2 from 'argon2';
import { DEFAULT_ROLE_PERMISSIONS, SystemRole } from '@edu-center/shared';
import * as schema from '../schemas';
import { permissions, rolePermissions, roles, users } from '../schemas';
import { seedMaintenanceAndAvailability } from './seed-maintenance.runner';
import { seedCatalogEntities } from './seed-catalog.runner';
import { seedStaffSettlementsAndExpenses } from './seed-finance.runner';
import { buildSeedPermissionsList, SEED_ROLES_DATA } from './seed-identity.data';
import { seedEnrollmentsAndSessions } from './seed-operations.runner';
import { seedAttendanceAndStudentPayments } from './seed-student-finance.runner';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

async function runSeed(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required to run database seed.');
  }

  const isProd = process.env.NODE_ENV === 'production';
  const ownerEmail = (
    process.env.SEED_OWNER_EMAIL || (isProd ? '' : 'owner@educenter.local')
  ).toLowerCase();
  const ownerPassword =
    process.env.SEED_OWNER_PASSWORD || (isProd ? '' : 'Owner@123456');
  const staffDefaultPassword = process.env.SEED_STAFF_PASSWORD || ownerPassword;

  if (!ownerEmail || !ownerPassword) {
    throw new Error(
      'SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD must be explicitly set in production.',
    );
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const db = drizzle(pool, { schema });

  try {
    console.info('[Seed] Starting idempotent Educational Center ERP database seed...');

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
        .values({ code: r.code, nameAr: r.nameAr, description: r.description, isSystem: true })
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
            .onConflictDoNothing({ target: [rolePermissions.roleId, rolePermissions.permissionId] });
        }
      }
    }

    const [ownerHash, staffHash] = await Promise.all([
      argon2.hash(ownerPassword, { type: argon2.argon2id }),
      argon2.hash(staffDefaultPassword, { type: argon2.argon2id }),
    ]);

    const userSpecs = [
      { email: ownerEmail, fullName: 'م. محمد طارق (مالك السنتر)', phone: '01000000001', role: SystemRole.OWNER, hash: ownerHash },
      { email: 'manager@educenter.local', fullName: 'أ. طارق سليم (مدير السنتر)', phone: '01000000002', role: SystemRole.MANAGER, hash: staffHash },
      { email: 'accountant@educenter.local', fullName: 'أ. هاني عبد الفتاح (المحاسب)', phone: '01000000003', role: SystemRole.ACCOUNTANT, hash: staffHash },
      { email: 'attendance@educenter.local', fullName: 'أ. مروة سامي (مسؤولة الحضور)', phone: '01000000004', role: SystemRole.ATTENDANCE_EMPLOYEE, hash: staffHash },
      { email: 'teacher@educenter.local', fullName: 'أ. محمود عبد الرحمن الشرقاوي', phone: '01011223344', role: SystemRole.TEACHER, hash: staffHash },
    ];

    const userIdByRole = new Map<SystemRole, string>();
    for (const u of userSpecs) {
      const [uRow] = await db
        .insert(users)
        .values({
          fullName: u.fullName,
          email: u.email,
          phone: u.phone,
          passwordHash: u.hash,
          roleId: roleIdByCode.get(u.role)!,
          isActive: true,
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            fullName: u.fullName,
            passwordHash: u.hash,
            roleId: roleIdByCode.get(u.role)!,
            isActive: true,
          },
        })
        .returning({ id: users.id });
      userIdByRole.set(u.role, uRow.id);
    }

    const catalog = await seedCatalogEntities(db, userIdByRole.get(SystemRole.TEACHER)!);

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const todayDate = `${yearMonth}-${String(now.getDate()).padStart(2, '0')}`;

    const ctx = {
      yearMonth,
      todayDate,
      actorUserId: userIdByRole.get(SystemRole.OWNER)!,
      accountantUserId: userIdByRole.get(SystemRole.ACCOUNTANT)!,
      ...catalog,
    };

    const { enrollmentSpecs, groupSessionsMap } = await seedEnrollmentsAndSessions(db, ctx);
    const groupAccs = await seedAttendanceAndStudentPayments(
      db,
      ctx,
      enrollmentSpecs,
      groupSessionsMap,
    );
    await seedStaffSettlementsAndExpenses(db, ctx, groupAccs);
    await seedMaintenanceAndAvailability(db, ctx);

    console.info(
      `[Seed] Completed successfully! Seeded ${permList.length} permissions, 5 roles, 5 users, 5 classrooms, 4 teachers, 3 assistants, ${catalog.studentIds.length} students, and 4 groups for ${yearMonth}.`,
    );
  } finally {
    await pool.end();
  }
}

runSeed().catch((err) => {
  console.error('[Seed] Fatal error during database seeding:', err);
  process.exit(1);
});
