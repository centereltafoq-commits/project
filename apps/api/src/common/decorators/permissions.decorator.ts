import { SetMetadata } from '@nestjs/common';
import { PermissionCode } from '@edu-center/shared';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

export const REQUIRE_ANY_PERMISSIONS_KEY = 'requireAnyPermissions';
export const RequireAnyPermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(REQUIRE_ANY_PERMISSIONS_KEY, permissions);

