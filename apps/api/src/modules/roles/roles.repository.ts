import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, inArray } from 'drizzle-orm';
import { DRIZZLE_DB, DrizzleDatabase } from '../../database/database.module';
import { permissions, rolePermissions, roles } from '../../database/schemas';

@Injectable()
export class RolesRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: DrizzleDatabase) {}

  async findAllRolesWithPermissions() {
    const [allRoles, mappings] = await Promise.all([
      this.db.select().from(roles).orderBy(asc(roles.createdAt)),
      this.db
        .select({
          roleId: rolePermissions.roleId,
          permissionCode: permissions.code,
        })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id)),
    ]);

    const byRole = new Map<string, string[]>();
    for (const m of mappings) {
      const list = byRole.get(m.roleId) ?? [];
      list.push(m.permissionCode);
      byRole.set(m.roleId, list);
    }

    return allRoles.map((r) => ({
      ...r,
      permissionCodes: byRole.get(r.id) ?? [],
    }));
  }

  async findAllPermissions() {
    return this.db.select().from(permissions).orderBy(asc(permissions.module), asc(permissions.code));
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(roles).where(eq(roles.id, id)).limit(1);
    return row ?? null;
  }

  async findByCode(code: string) {
    const [row] = await this.db.select().from(roles).where(eq(roles.code, code)).limit(1);
    return row ?? null;
  }

  async createRoleWithPermissions(
    data: { code: string; nameAr: string; description?: string },
    permissionCodes: string[],
  ) {
    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(roles)
        .values({
          code: data.code.toUpperCase(),
          nameAr: data.nameAr,
          description: data.description ?? null,
          isSystem: false,
        })
        .returning();

      if (permissionCodes.length > 0) {
        const perms = await tx
          .select()
          .from(permissions)
          .where(inArray(permissions.code, permissionCodes));
        if (perms.length > 0) {
          await tx.insert(rolePermissions).values(
            perms.map((p) => ({
              roleId: created.id,
              permissionId: p.id,
            })),
          );
        }
      }
      return created;
    });
  }

  async updateRoleAndPermissions(
    roleId: string,
    updates: { nameAr?: string; description?: string },
    permissionCodes: string[],
  ) {
    return this.db.transaction(async (tx) => {
      await tx
        .update(roles)
        .set({
          ...(updates.nameAr ? { nameAr: updates.nameAr } : {}),
          ...(updates.description !== undefined ? { description: updates.description } : {}),
          updatedAt: new Date(),
        })
        .where(eq(roles.id, roleId));

      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

      if (permissionCodes.length > 0) {
        const perms = await tx
          .select()
          .from(permissions)
          .where(inArray(permissions.code, permissionCodes));
        if (perms.length > 0) {
          await tx.insert(rolePermissions).values(
            perms.map((p) => ({
              roleId,
              permissionId: p.id,
            })),
          );
        }
      }
    });
  }
}

