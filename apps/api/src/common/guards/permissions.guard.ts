import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SystemRole } from '@edu-center/shared';
import {
  REQUIRED_PERMISSIONS_KEY,
  REQUIRE_ANY_PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requireAnyPermissions = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_ANY_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    const hasRequired = Boolean(requiredPermissions && requiredPermissions.length > 0);
    const hasRequireAny = Boolean(requireAnyPermissions && requireAnyPermissions.length > 0);

    if (!hasRequired && !hasRequireAny) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('ليس لديك صلاحية للوصول إلى هذا الإجراء');
    }

    if (user.roleCode === SystemRole.OWNER) {
      return true;
    }

    const userPermissionSet = new Set(user.permissions || []);

    if (hasRequired) {
      const hasAll = requiredPermissions!.every((perm) => userPermissionSet.has(perm));
      if (!hasAll) {
        throw new ForbiddenException('ليس لديك الصلاحية الكافية لتنفيذ هذه العملية');
      }
    }

    if (hasRequireAny) {
      const hasAny = requireAnyPermissions!.some((perm) => userPermissionSet.has(perm));
      if (!hasAny) {
        throw new ForbiddenException('ليس لديك الصلاحية الكافية لتنفيذ هذه العملية');
      }
    }

    return true;
  }
}

