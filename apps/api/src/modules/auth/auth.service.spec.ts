import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let mockUsersRepo: any;
  let mockUsersService: any;
  let mockAuthRepo: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockAudit: any;

  beforeEach(() => {
    mockUsersRepo = {
      findByPhoneWithRole: vi.fn(),
      findByEmailWithRole: vi.fn(),
      findByIdWithRole: vi.fn(),
      update: vi.fn(),
    };
    mockUsersService = {
      getEffectivePermissions: vi.fn(),
    };
    mockAuthRepo = {
      findValidRefreshTokenById: vi.fn(),
      revokeRefreshToken: vi.fn(),
      revokeAllForUser: vi.fn(),
      createRefreshToken: vi.fn(),
    };
    mockJwtService = {
      signAsync: vi.fn(),
      verifyAsync: vi.fn(),
      decode: vi.fn(),
    };
    mockConfigService = {
      get: vi.fn(),
      getOrThrow: vi.fn().mockReturnValue('refresh-secret'),
    };
    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(
      mockUsersRepo,
      mockUsersService,
      mockAuthRepo,
      mockJwtService,
      mockConfigService,
      mockAudit,
    );
  });

  describe('login', () => {
    it('records LOGIN_FAILED audit log and throws UnauthorizedException when phone is not found', async () => {
      mockUsersRepo.findByPhoneWithRole.mockResolvedValueOnce(null);

      await expect(
        service.login({ phone: '01099999999', password: 'wrong' }, { ipAddress: '127.0.0.1' }),
      ).rejects.toThrow('رقم الهاتف أو كلمة المرور غير صحيحة');

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: null,
          actorName: '01099999999',
          action: 'LOGIN_FAILED',
          entityType: 'AUTH',
          ipAddress: '127.0.0.1',
          afterData: expect.objectContaining({
            phone: '01099999999',
            reason: 'UNKNOWN_PHONE',
          }),
        }),
      );
    });
  });

  describe('logout', () => {
    it('records audit log when user actor is provided', async () => {
      await service.logout(undefined, { id: 'u-1', fullName: 'أحمد علي' }, { ipAddress: '127.0.0.1' });

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'u-1',
          actorName: 'أحمد علي',
          action: 'LOGOUT',
          entityType: 'AUTH',
          entityId: 'u-1',
          ipAddress: '127.0.0.1',
        }),
      );
    });

    it('decodes refresh token and revokes it, recording audit log', async () => {
      mockJwtService.verifyAsync.mockResolvedValueOnce({ sub: 'u-2', jti: 'jti-1' });
      mockUsersRepo.findByIdWithRole.mockResolvedValueOnce({ id: 'u-2', fullName: 'سارة محمد' });

      await service.logout('valid-refresh-token', undefined, { ipAddress: '192.168.1.1' });

      expect(mockAuthRepo.revokeRefreshToken).toHaveBeenCalledWith('jti-1');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'u-2',
          actorName: 'سارة محمد',
          action: 'LOGOUT',
          entityType: 'AUTH',
        }),
      );
    });

    it('decodes bearer token if no actor and refresh token is absent', async () => {
      mockJwtService.decode.mockReturnValueOnce({ sub: 'u-3' });
      mockUsersRepo.findByIdWithRole.mockResolvedValueOnce({ id: 'u-3', fullName: 'محمود حسن' });

      await service.logout(undefined, undefined, { bearerToken: 'bearer-xyz' });

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          actorUserId: 'u-3',
          actorName: 'محمود حسن',
          action: 'LOGOUT',
        }),
      );
    });
  });
});

