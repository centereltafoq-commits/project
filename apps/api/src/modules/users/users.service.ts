import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { ALL_PERMISSIONS, SystemRole } from '@edu-center/shared';
import { CacheService } from '../../common/cache/cache.module';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { createPaginatedResult } from '../../common/utils/pagination.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserPermissionOverridesDto,
  UserQueryDto,
} from './dto/user.dto';
import { normalizeUserPhone } from './user-phone.util';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly repository: UsersRepository,
    private readonly cache: CacheService,
    private readonly audit: AuditLogsService,
  ) {}

  async list(query: UserQueryDto) {
    const { rows, total, page, limit } = await this.repository.findPaginated(query);
    return createPaginatedResult(rows, total, page, limit);
  }

  async getById(id: string) {
    const user = await this.repository.findByIdWithRole(id);
    if (!user) {
      throw new NotFoundException('المستخدم غير موجود');
    }
    const [overrides, effectivePermissions] = await Promise.all([
      this.repository.getUserOverrides(id),
      this.getEffectivePermissions(user.id, user.roleId, user.roleCode),
    ]);
    return { ...user, overrides, effectivePermissions };
  }

  async getEffectivePermissions(
    userId: string,
    roleId: string,
    roleCode: string,
  ): Promise<string[]> {
    if (roleCode === SystemRole.OWNER) {
      return ALL_PERMISSIONS;
    }
    const cacheKey = `auth:perms:${userId}`;
    const cached = await this.cache.get<string[]>(cacheKey);
    if (cached) return cached;

    const perms = await this.repository.computeEffectivePermissions(userId, roleId);
    await this.cache.set(cacheKey, perms, 300);
    return perms;
  }

  async create(dto: CreateUserDto, actor: AuthenticatedUser) {
    const normalizedPhone = normalizeUserPhone(dto.phone);
    if (normalizedPhone.length < 8) {
      throw new BadRequestException('رقم الهاتف يجب ألا يقل عن 8 أرقام');
    }

    const existingPhone = await this.repository.findByPhoneWithRole(normalizedPhone);
    if (existingPhone) {
      throw new ConflictException('رقم الهاتف مسجل لمستخدم آخر');
    }

    const normalizedEmail = dto.email?.trim() ? dto.email.trim().toLowerCase() : null;
    if (normalizedEmail) {
      const existingEmail = await this.repository.findByEmailWithRole(normalizedEmail);
      if (existingEmail) {
        throw new ConflictException('البريد الإلكتروني مسجل لمستخدم آخر');
      }
    }

    const passwordHash = await argon2.hash(dto.password);
    const created = await this.repository.create({
      fullName: dto.fullName.trim(),
      phone: normalizedPhone,
      email: normalizedEmail,
      passwordHash,
      roleId: dto.roleId,
      isActive: dto.isActive ?? true,
    });

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'CREATE_USER',
      entityType: 'USER',
      entityId: created.id,
      afterData: created,
    });

    return created;
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthenticatedUser) {
    const existing = await this.repository.findByIdWithRole(id);
    if (!existing) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    const updates: Parameters<UsersRepository['update']>[1] = {};
    if (dto.fullName !== undefined) updates.fullName = dto.fullName.trim();
    if (dto.phone !== undefined) {
      const normalizedPhone = normalizeUserPhone(dto.phone);
      if (normalizedPhone.length < 8) {
        throw new BadRequestException('رقم الهاتف يجب ألا يقل عن 8 أرقام');
      }
      const existingPhone = await this.repository.findByPhoneWithRole(normalizedPhone);
      if (existingPhone && existingPhone.id !== id) {
        throw new ConflictException('رقم الهاتف مسجل لمستخدم آخر');
      }
      updates.phone = normalizedPhone;
    }
    if (dto.email !== undefined) {
      const normalizedEmail = dto.email?.trim() ? dto.email.trim().toLowerCase() : null;
      if (normalizedEmail) {
        const existingEmail = await this.repository.findByEmailWithRole(normalizedEmail);
        if (existingEmail && existingEmail.id !== id) {
          throw new ConflictException('البريد الإلكتروني مسجل لمستخدم آخر');
        }
      }
      updates.email = normalizedEmail;
    }
    if (dto.roleId !== undefined) updates.roleId = dto.roleId;
    if (dto.isActive !== undefined) updates.isActive = dto.isActive;
    if (dto.password) {
      updates.passwordHash = await argon2.hash(dto.password);
    }

    const updated = await this.repository.update(id, updates);
    await this.cache.invalidatePrefix(`auth:perms:${id}`);

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'UPDATE_USER',
      entityType: 'USER',
      entityId: id,
      beforeData: existing,
      afterData: updated,
    });

    return updated;
  }

  async updatePermissionOverrides(
    id: string,
    dto: UpdateUserPermissionOverridesDto,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.repository.findByIdWithRole(id);
    if (!existing) {
      throw new NotFoundException('المستخدم غير موجود');
    }

    await this.repository.replaceUserOverrides(id, dto.overrides);
    await this.cache.invalidatePrefix(`auth:perms:${id}`);

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'UPDATE_USER_PERMISSIONS',
      entityType: 'USER',
      entityId: id,
      afterData: dto.overrides,
    });

    return { success: true };
  }
}

