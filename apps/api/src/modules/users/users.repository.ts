import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, eq, ilike, inArray, or, SQL } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import {
  permissions,
  rolePermissions,
  roles,
  userPermissions,
  users,
} from '../../database/schemas';
import { normalizePagination } from '../../common/utils/pagination.util';
import { UserQueryDto } from './dto/user.dto';
import { normalizeUserPhone } from './user-phone.util';

@Injectable()
export class UsersRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async findPaginated(query: UserQueryDto) {
    const { page, limit, offset } = normalizePagination(query.page, query.limit);
    const conditions: SQL[] = [];

    if (query.roleId) {
      conditions.push(eq(users.roleId, query.roleId));
    }
    if (query.isActive === 'true' || query.isActive === 'false') {
      conditions.push(eq(users.isActive, query.isActive === 'true'));
    }
    if (query.search) {
      const pattern = `%${query.search}%`;
      conditions.push(
        or(
          ilike(users.fullName, pattern),
          ilike(users.email, pattern),
          ilike(users.phone, pattern),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          phone: users.phone,
          roleId: users.roleId,
          roleCode: roles.code,
          roleNameAr: roles.nameAr,
          isActive: users.isActive,
          lastLoginAt: users.lastLoginAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .innerJoin(roles, eq(users.roleId, roles.id))
        .where(whereClause)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(users).where(whereClause),
    ]);

    return { rows, total: Number(total), page, limit };
  }

  async findByEmailWithRole(email: string) {
    const [row] = await this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        passwordHash: users.passwordHash,
        roleId: users.roleId,
        roleCode: roles.code,
        roleNameAr: roles.nameAr,
        isActive: users.isActive,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.email, email.trim().toLowerCase()))
      .limit(1);
    return row ?? null;
  }

  async findByPhoneWithRole(phone: string) {
    const trimmed = phone.trim();
    const normalized = normalizeUserPhone(trimmed);
    const phoneMatch =
      normalized && normalized !== trimmed
        ? or(eq(users.phone, normalized), eq(users.phone, trimmed))
        : eq(users.phone, normalized || trimmed);

    const [row] = await this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        passwordHash: users.passwordHash,
        roleId: users.roleId,
        roleCode: roles.code,
        roleNameAr: roles.nameAr,
        isActive: users.isActive,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(phoneMatch)
      .limit(1);
    return row ?? null;
  }

  async findByIdWithRole(id: string) {
    const [row] = await this.db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        roleId: users.roleId,
        roleCode: roles.code,
        roleNameAr: roles.nameAr,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, id))
      .limit(1);
    return row ?? null;
  }

  async findPasswordHashById(id: string): Promise<string | null> {
    const [row] = await this.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row?.passwordHash ?? null;
  }


  async computeEffectivePermissions(userId: string, roleId: string): Promise<string[]> {
    const [rolePerms, overrides] = await Promise.all([
      this.db
        .select({ code: permissions.code })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.roleId, roleId)),
      this.db
        .select({
          code: permissions.code,
          isGranted: userPermissions.isGranted,
        })
        .from(userPermissions)
        .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
        .where(eq(userPermissions.userId, userId)),
    ]);

    const effective = new Set<string>(rolePerms.map((p) => p.code));
    for (const ov of overrides) {
      if (ov.isGranted) {
        effective.add(ov.code);
      } else {
        effective.delete(ov.code);
      }
    }
    return Array.from(effective);
  }

  async getUserOverrides(userId: string) {
    return this.db
      .select({
        permissionCode: permissions.code,
        isGranted: userPermissions.isGranted,
      })
      .from(userPermissions)
      .innerJoin(permissions, eq(userPermissions.permissionId, permissions.id))
      .where(eq(userPermissions.userId, userId));
  }

  async create(data: {
    fullName: string;
    phone: string;
    email?: string | null;
    passwordHash: string;
    roleId: string;
    isActive: boolean;
  }) {
    const normalizedEmail = data.email?.trim() ? data.email.trim().toLowerCase() : null;
    const normalizedPhone = normalizeUserPhone(data.phone);
    const [created] = await this.db
      .insert(users)
      .values({
        fullName: data.fullName,
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash: data.passwordHash,
        roleId: data.roleId,
        isActive: data.isActive,
      })
      .returning({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        roleId: users.roleId,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });
    return created;
  }

  async update(
    id: string,
    updates: Partial<{
      fullName: string;
      email: string | null;
      phone: string | null;
      roleId: string;
      isActive: boolean;
      passwordHash: string;
      lastLoginAt: Date;
    }>,
  ) {
    const [updated] = await this.db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        roleId: users.roleId,
        isActive: users.isActive,
      });
    return updated ?? null;
  }

  async replaceUserOverrides(
    userId: string,
    overrides: Array<{ permissionCode: string; isGranted: boolean }>,
  ) {
    await this.db.transaction(async (tx) => {
      await tx.delete(userPermissions).where(eq(userPermissions.userId, userId));
      if (overrides.length === 0) return;

      const codes = overrides.map((o) => o.permissionCode);
      const perms = await tx.select().from(permissions).where(inArray(permissions.code, codes));
      const idByCode = new Map(perms.map((p) => [p.code, p.id]));

      const rowsToInsert = overrides
        .filter((o) => idByCode.has(o.permissionCode))
        .map((o) => ({
          userId,
          permissionId: idByCode.get(o.permissionCode)!,
          isGranted: o.isGranted,
        }));

      if (rowsToInsert.length > 0) {
        await tx.insert(userPermissions).values(rowsToInsert);
      }
    });
  }
}

