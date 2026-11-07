import * as React from 'react';
import { PermissionCode } from '@edu-center/shared';
import { useAuth } from '@/features/auth/auth-context';
import { ForbiddenPage } from './forbidden-page';

interface PermissionGuardRouteProps {
  permission?: PermissionCode | string;
  anyPermissions?: Array<PermissionCode | string>;
  children: React.ReactNode;
}

export function PermissionGuardRoute({
  permission,
  anyPermissions,
  children,
}: PermissionGuardRouteProps) {
  const { hasPermission } = useAuth();

  if (permission && !hasPermission(permission as any)) {
    return <ForbiddenPage permission={permission} />;
  }

  if (anyPermissions && anyPermissions.length > 0) {
    const hasAny = anyPermissions.some((perm) => hasPermission(perm as any));
    if (!hasAny) {
      return <ForbiddenPage permission={anyPermissions.join(' أو ')} />;
    }
  }

  return <>{children}</>;
}
