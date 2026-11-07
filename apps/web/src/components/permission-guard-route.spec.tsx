import * as React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PERMISSIONS } from '@edu-center/shared';
import * as authContextModule from '@/features/auth/auth-context';
import { PermissionGuardRoute } from './permission-guard-route';

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: vi.fn(),
}));

describe('PermissionGuardRoute', () => {
  const useAuthMock = vi.mocked(authContextModule.useAuth);

  it('renders children when user has the required permission', () => {
    useAuthMock.mockReturnValue({
      hasPermission: (perm: string) => perm === PERMISSIONS.REPORTS_VIEW,
      user: { fullName: 'Test Admin', roleCode: 'ADMIN' },
    } as any);

    render(
      <MemoryRouter>
        <PermissionGuardRoute permission={PERMISSIONS.REPORTS_VIEW}>
          <div data-testid="protected-content">محتوى التقارير المحمي</div>
        </PermissionGuardRoute>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByText('غير مصرح بالوصول')).not.toBeInTheDocument();
  });

  it('renders 403 ForbiddenPage when user lacks the required permission', () => {
    useAuthMock.mockReturnValue({
      hasPermission: () => false,
      user: { fullName: 'Restricted User', roleCode: 'SECRETARY' },
    } as any);

    render(
      <MemoryRouter>
        <PermissionGuardRoute permission={PERMISSIONS.BACKUPS_VIEW}>
          <div data-testid="protected-content">محتوى النسخ الاحتياطية</div>
        </PermissionGuardRoute>
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByText('غير مصرح بالدخول إلى هذه الشاشة')).toBeInTheDocument();
    expect(screen.getByText(PERMISSIONS.BACKUPS_VIEW)).toBeInTheDocument();
  });

  it('allows access when user has any of the required anyPermissions', () => {
    useAuthMock.mockReturnValue({
      hasPermission: (perm: string) => perm === PERMISSIONS.TEACHERS_VIEW_OWN,
      user: { fullName: 'Teacher User', roleCode: 'TEACHER' },
    } as any);

    render(
      <MemoryRouter>
        <PermissionGuardRoute
          anyPermissions={[PERMISSIONS.TEACHERS_VIEW, PERMISSIONS.TEACHERS_VIEW_OWN]}
        >
          <div data-testid="protected-content">محتوى صفحة المدرسين</div>
        </PermissionGuardRoute>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('denies access when user lacks all of anyPermissions', () => {
    useAuthMock.mockReturnValue({
      hasPermission: () => false,
      user: { fullName: 'Guest User', roleCode: 'GUEST' },
    } as any);

    render(
      <MemoryRouter>
        <PermissionGuardRoute
          anyPermissions={[PERMISSIONS.TEACHERS_VIEW, PERMISSIONS.TEACHERS_VIEW_OWN]}
        >
          <div data-testid="protected-content">محتوى صفحة المدرسين</div>
        </PermissionGuardRoute>
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByText('غير مصرح بالدخول إلى هذه الشاشة')).toBeInTheDocument();
  });
});
