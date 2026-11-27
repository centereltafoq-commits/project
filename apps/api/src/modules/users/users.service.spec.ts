import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SystemRole } from '@edu-center/shared';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

describe('UsersService - Phone-Based Users Management', () => {
  const actor: AuthenticatedUser = {
    id: 'owner-1',
    phone: '01000000001',
    fullName: 'المالك',
    roleCode: SystemRole.OWNER,
    permissions: [],
  };

  let repo: any;
  let cache: any;
  let audit: any;
  let service: UsersService;

  beforeEach(() => {
    repo = {
      findPaginated: vi.fn(),
      findByIdWithRole: vi.fn(),
      findByPhoneWithRole: vi.fn().mockResolvedValue(null),
      findByEmailWithRole: vi.fn().mockResolvedValue(null),
      getUserOverrides: vi.fn(),
      computeEffectivePermissions: vi.fn(),
      create: vi.fn().mockImplementation(async (data) => ({ id: 'u-new', ...data })),
      update: vi.fn().mockImplementation(async (id, updates) => ({ id, ...updates })),
    };
    cache = {
      get: vi.fn(),
      set: vi.fn(),
      invalidatePrefix: vi.fn().mockResolvedValue(undefined),
    };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    service = new UsersService(repo, cache, audit);
  });

  it('creates a user strictly by normalized phone number without requiring email', async () => {
    const created = await service.create(
      {
        fullName: '  محاسب السنتر  ',
        phone: '٠١٠ ٥٥٥٥ ٦٦٦٦',
        password: 'Password@123',
        roleId: 'role-acc',
      },
      actor,
    );

    expect(repo.findByPhoneWithRole).toHaveBeenCalledWith('01055556666');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: 'محاسب السنتر',
        phone: '01055556666',
        email: null,
        roleId: 'role-acc',
      }),
    );
    expect(created.phone).toBe('01055556666');
  });

  it('rejects creating a user when the normalized phone already belongs to another user', async () => {
    repo.findByPhoneWithRole.mockResolvedValueOnce({ id: 'existing-1', phone: '01000000002' });

    await expect(
      service.create(
        {
          fullName: 'مستخدم مكرر',
          phone: '01000000002',
          password: 'Password@123',
          roleId: 'role-mgr',
        },
        actor,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('updates user phone and password and rejects colliding phone numbers', async () => {
    repo.findByIdWithRole.mockResolvedValue({
      id: 'u-1',
      fullName: 'موظف',
      phone: '01000000009',
      email: null,
      roleId: 'role-sec',
      roleCode: SystemRole.SECRETARY,
      roleNameAr: 'سكرتارية',
      isActive: true,
    });

    await service.update('u-1', { phone: '011 2222 3333', password: 'NewPass@123' }, actor);
    expect(repo.update).toHaveBeenCalledWith(
      'u-1',
      expect.objectContaining({
        phone: '01122223333',
        passwordHash: expect.any(String),
      }),
    );

    repo.findByPhoneWithRole.mockResolvedValueOnce({ id: 'u-other', phone: '01000000001' });
    await expect(service.update('u-1', { phone: '01000000001' }, actor)).rejects.toThrow(
      ConflictException,
    );
  });
});
