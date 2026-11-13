import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, SystemRole } from '@edu-center/shared';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import {
  REQUIRED_PERMISSIONS_KEY,
  REQUIRE_ANY_PERMISSIONS_KEY,
} from '../decorators/permissions.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PermissionsGuard } from './permissions.guard';

function createMockContext(user?: AuthenticatedUser): ExecutionContext {
  return {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
      getResponse: vi.fn(),
      getNext: vi.fn(),
    }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  it('allows access if route is marked public', () => {
    const reflector = {
      getAllAndOverride: vi.fn((key) => key === IS_PUBLIC_KEY),
    } as unknown as Reflector;

    const guard = new PermissionsGuard(reflector);
    const context = createMockContext();
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access if no permissions are required', () => {
    const reflector = {
      getAllAndOverride: vi.fn(() => undefined),
    } as unknown as Reflector;

    const guard = new PermissionsGuard(reflector);
    const context = createMockContext();
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException if user is missing and permissions are required', () => {
    const reflector = {
      getAllAndOverride: vi.fn((key) => {
        if (key === REQUIRED_PERMISSIONS_KEY) return [PERMISSIONS.USERS_VIEW];
        return undefined;
      }),
    } as unknown as Reflector;

    const guard = new PermissionsGuard(reflector);
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('always allows access for OWNER role', () => {
    const reflector = {
      getAllAndOverride: vi.fn((key) => {
        if (key === REQUIRED_PERMISSIONS_KEY) return [PERMISSIONS.FINANCE_CLOSE_MONTH];
        return undefined;
      }),
    } as unknown as Reflector;

    const guard = new PermissionsGuard(reflector);
    const ownerUser: AuthenticatedUser = {
      id: 'owner-id',
      email: 'owner@test.com',
      fullName: 'Owner User',
      roleCode: SystemRole.OWNER,
      permissions: [],
    };
    const context = createMockContext(ownerUser);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('enforces REQUIRED_PERMISSIONS_KEY (requires all permissions)', () => {
    const reflector = {
      getAllAndOverride: vi.fn((key) => {
        if (key === REQUIRED_PERMISSIONS_KEY) return [PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_MANAGE];
        return undefined;
      }),
    } as unknown as Reflector;

    const guard = new PermissionsGuard(reflector);

    const userWithOnlyOne: AuthenticatedUser = {
      id: 'user-1',
      email: 'user1@test.com',
      fullName: 'User 1',
      roleCode: SystemRole.ATTENDANCE_EMPLOYEE,
      permissions: [PERMISSIONS.USERS_VIEW],
    };
    expect(() => guard.canActivate(createMockContext(userWithOnlyOne))).toThrow(ForbiddenException);

    const userWithBoth: AuthenticatedUser = {
      id: 'user-2',
      email: 'user2@test.com',
      fullName: 'User 2',
      roleCode: SystemRole.MANAGER,
      permissions: [PERMISSIONS.USERS_VIEW, PERMISSIONS.USERS_MANAGE],
    };
    expect(guard.canActivate(createMockContext(userWithBoth))).toBe(true);
  });

  it('enforces REQUIRE_ANY_PERMISSIONS_KEY (requires at least one permission)', () => {
    const reflector = {
      getAllAndOverride: vi.fn((key) => {
        if (key === REQUIRE_ANY_PERMISSIONS_KEY) {
          return [PERMISSIONS.TEACHERS_VIEW, PERMISSIONS.TEACHERS_VIEW_OWN];
        }
        return undefined;
      }),
    } as unknown as Reflector;

    const guard = new PermissionsGuard(reflector);

    const userWithNone: AuthenticatedUser = {
      id: 'user-1',
      email: 'user1@test.com',
      fullName: 'User 1',
      roleCode: SystemRole.ATTENDANCE_EMPLOYEE,
      permissions: [PERMISSIONS.STUDENTS_VIEW],
    };
    expect(() => guard.canActivate(createMockContext(userWithNone))).toThrow(ForbiddenException);

    const teacherUser: AuthenticatedUser = {
      id: 'user-2',
      email: 'teacher@test.com',
      fullName: 'Teacher User',
      roleCode: SystemRole.TEACHER,
      permissions: [PERMISSIONS.TEACHERS_VIEW_OWN],
    };
    expect(guard.canActivate(createMockContext(teacherUser))).toBe(true);
  });

  it('enforces both required and requireAny when combined', () => {
    const reflector = {
      getAllAndOverride: vi.fn((key) => {
        if (key === REQUIRED_PERMISSIONS_KEY) return [PERMISSIONS.GROUPS_VIEW];
        if (key === REQUIRE_ANY_PERMISSIONS_KEY) {
          return [PERMISSIONS.TEACHERS_VIEW, PERMISSIONS.TEACHERS_VIEW_OWN];
        }
        return undefined;
      }),
    } as unknown as Reflector;

    const guard = new PermissionsGuard(reflector);

    // Has required but not any
    const user1: AuthenticatedUser = {
      id: 'user-1',
      email: 'user1@test.com',
      fullName: 'User 1',
      roleCode: SystemRole.ATTENDANCE_EMPLOYEE,
      permissions: [PERMISSIONS.GROUPS_VIEW],
    };
    expect(() => guard.canActivate(createMockContext(user1))).toThrow(ForbiddenException);

    // Has any but not required
    const user2: AuthenticatedUser = {
      id: 'user-2',
      email: 'user2@test.com',
      fullName: 'User 2',
      roleCode: SystemRole.TEACHER,
      permissions: [PERMISSIONS.TEACHERS_VIEW_OWN],
    };
    expect(() => guard.canActivate(createMockContext(user2))).toThrow(ForbiddenException);

    // Has both
    const user3: AuthenticatedUser = {
      id: 'user-3',
      email: 'user3@test.com',
      fullName: 'User 3',
      roleCode: SystemRole.MANAGER,
      permissions: [PERMISSIONS.GROUPS_VIEW, PERMISSIONS.TEACHERS_VIEW],
    };
    expect(guard.canActivate(createMockContext(user3))).toBe(true);
  });
});
