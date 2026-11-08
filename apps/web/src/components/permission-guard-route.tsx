import * as React from 'react';
import { PermissionCode, SystemRole } from '@edu-center/shared';
import { useAuth } from '@/features/auth/auth-context';
import { ForbiddenPage } from './forbidden-page';

interface PermissionGuardRouteProps {
  permission?: PermissionCode | string;
  anyPermissions?: Array<PermissionCode | string>;
  requiredRole?: SystemRole | string;
  children: React.ReactNode;
}

export function PermissionGuardRoute({
  permission,
  anyPermissions,
  requiredRole,
  children,
}: PermissionGuardRouteProps) {
  const { user, hasPermission } = useAuth();

  if (requiredRole && user?.roleCode !== requiredRole) {
    return (
      <ForbiddenPage
        message="هذا القسم مخصص فقط لمالك النظام (Owner). لا تملك الصلاحية للوصول إليه."
      />
    );
  }

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
