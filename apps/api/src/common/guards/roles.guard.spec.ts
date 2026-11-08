import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { SystemRole } from '@edu-center/shared';
import { AuthenticatedUser } from '../decorators/current-user.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { RolesGuard } from './roles.guard';

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

describe('RolesGuard', () => {
  it('allows access if route is marked public', () => {
    const reflector = {
      getAllAndOverride: vi.fn((key) => key === IS_PUBLIC_KEY),
    } as unknown as Reflector;

    const guard = new RolesGuard(reflector);
    const context = createMockContext();
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access if no roles are required', () => {
    const reflector = {
      getAllAndOverride: vi.fn(() => undefined),
    } as unknown as Reflector;

    const guard = new RolesGuard(reflector);
    const context = createMockContext();
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException if user is missing and roles are required', () => {
    const reflector = {
      getAllAndOverride: vi.fn((key) => {
        if (key === ROLES_KEY) return [SystemRole.OWNER];
        return undefined;
      }),
    } as unknown as Reflector;

    const guard = new RolesGuard(reflector);
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException if user roleCode does not match required role', () => {
    const reflector = {
      getAllAndOverride: vi.fn((key) => {
        if (key === ROLES_KEY) return [SystemRole.OWNER];
        return undefined;
      }),
    } as unknown as Reflector;

    const guard = new RolesGuard(reflector);
    const managerUser: AuthenticatedUser = {
      id: 'manager-1',
      email: 'manager@test.com',
      fullName: 'Manager User',
      roleCode: SystemRole.MANAGER,
      permissions: [],
    };
    const context = createMockContext(managerUser);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows access when user has the exact required role', () => {
    const reflector = {
      getAllAndOverride: vi.fn((key) => {
        if (key === ROLES_KEY) return [SystemRole.OWNER];
        return undefined;
      }),
    } as unknown as Reflector;

    const guard = new RolesGuard(reflector);
    const ownerUser: AuthenticatedUser = {
      id: 'owner-1',
      email: 'owner@test.com',
      fullName: 'Owner User',
      roleCode: SystemRole.OWNER,
      permissions: [],
    };
    const context = createMockContext(ownerUser);
    expect(guard.canActivate(context)).toBe(true);
  });
});
