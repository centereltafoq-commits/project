import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SystemRole } from '@edu-center/shared';
import { CacheService } from '../../common/cache/cache.module';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateRoleDto, UpdateRolePermissionsDto } from './dto/role.dto';
import { RolesRepository } from './roles.repository';

@Injectable()
export class RolesService {
  constructor(
    private readonly repository: RolesRepository,
    private readonly cache: CacheService,
    private readonly audit: AuditLogsService,
  ) {}

  async listRoles() {
    return this.repository.findAllRolesWithPermissions();
  }

  async listPermissions() {
    return this.repository.findAllPermissions();
  }

  async createRole(dto: CreateRoleDto, actor: AuthenticatedUser) {
    const normalizedCode = dto.code.trim().toUpperCase();
    const existing = await this.repository.findByCode(normalizedCode);
    if (existing) {
      throw new ConflictException('كود الدور الوظيفي مستخدم بالفعل');
    }

    const created = await this.repository.createRoleWithPermissions(
      { code: normalizedCode, nameAr: dto.nameAr, description: dto.description },
      dto.permissionCodes,
    );

    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'CREATE_ROLE',
      entityType: 'ROLE',
      entityId: created.id,
      afterData: { ...created, permissionCodes: dto.permissionCodes },
    });

    return created;
  }

  async updateRolePermissions(roleId: string, dto: UpdateRolePermissionsDto, actor: AuthenticatedUser) {
    const role = await this.repository.findById(roleId);
    if (!role) {
      throw new NotFoundException('الدور الوظيفي غير موجود');
    }
    if (role.code === SystemRole.OWNER) {
      throw new BadRequestException('لا يمكن تقليص صلاحيات مالك النظام (Owner)');
    }

    await this.repository.updateRoleAndPermissions(
      roleId,
      { nameAr: dto.nameAr, description: dto.description },
      dto.permissionCodes,
    );

    await this.cache.invalidatePrefix('auth:perms:');
    await this.audit.record({
      actorUserId: actor.id,
      actorName: actor.fullName,
      action: 'UPDATE_ROLE_PERMISSIONS',
      entityType: 'ROLE',
      entityId: roleId,
      afterData: dto,
    });

    return { success: true };
  }
}

