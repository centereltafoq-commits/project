import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { UsersRepository } from '../users/users.repository';
import { UsersService } from '../users/users.service';
import { AuthRepository } from './auth.repository';
import { LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly usersService: UsersService,
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogsService,
  ) {}

  async login(dto: LoginDto, meta: { ipAddress?: string; userAgent?: string }) {
    const user = await this.usersRepository.findByEmailWithRole(dto.email);
    if (!user || !user.isActive) {
      await this.audit.record({
        actorUserId: user?.id ?? null,
        actorName: user?.fullName ?? dto.email,
        action: 'LOGIN_FAILED',
        entityType: 'AUTH',
        entityId: user?.id ?? null,
        afterData: {
          email: dto.email,
          reason: !user ? 'UNKNOWN_EMAIL' : 'INACTIVE_ACCOUNT',
          userAgent: meta.userAgent ?? null,
        },
        ipAddress: meta.ipAddress,
      });
      throw new UnauthorizedException(
        !user
          ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
          : 'هذا الحساب موقوف حالياً، يرجى التواصل مع مدير النظام',
      );
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      await this.audit.record({
        actorUserId: user.id,
        actorName: user.fullName,
        action: 'LOGIN_FAILED',
        entityType: 'AUTH',
        entityId: user.id,
        afterData: {
          email: dto.email,
          reason: 'INVALID_PASSWORD',
          userAgent: meta.userAgent ?? null,
        },
        ipAddress: meta.ipAddress,
      });
      throw new UnauthorizedException('البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }

    await this.usersRepository.update(user.id, { lastLoginAt: new Date() });

    const tokens = await this.issueTokens(user.id, user.email, user.roleCode, meta);
    const permissions = await this.usersService.getEffectivePermissions(
      user.id,
      user.roleId,
      user.roleCode,
    );

    await this.audit.record({
      actorUserId: user.id,
      actorName: user.fullName,
      action: 'LOGIN',
      entityType: 'AUTH',
      entityId: user.id,
      ipAddress: meta.ipAddress,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        roleCode: user.roleCode,
        roleNameAr: user.roleNameAr,
        permissions,
      },
    };
  }

  async refresh(rawRefreshToken: string, meta: { ipAddress?: string; userAgent?: string }) {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('رمز التحديث غير صالح');
    }

    let decoded: { sub: string; jti: string };
    try {
      decoded = await this.jwtService.verifyAsync<{ sub: string; jti: string }>(rawRefreshToken, {
        secret: this.config.getOrThrow<string>('jwtRefreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً');
    }

    const stored = await this.authRepository.findValidRefreshTokenById(decoded.jti);
    if (!stored || stored.userId !== decoded.sub) {
      throw new UnauthorizedException('رمز التحديث غير صالح أو ملغى');
    }

    const hashMatches = await argon2.verify(stored.tokenHash, rawRefreshToken);
    if (!hashMatches) {
      await this.authRepository.revokeAllForUser(decoded.sub);
      throw new UnauthorizedException('تم رصد محاولة غير مصرح بها، تم إنهاء الجلسة');
    }

    await this.authRepository.revokeRefreshToken(stored.id);

    const user = await this.usersRepository.findByIdWithRole(decoded.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('الحساب غير نشط');
    }

    const tokens = await this.issueTokens(user.id, user.email, user.roleCode, meta);
    const permissions = await this.usersService.getEffectivePermissions(
      user.id,
      user.roleId,
      user.roleCode,
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        roleCode: user.roleCode,
        roleNameAr: user.roleNameAr,
        permissions,
      },
    };
  }

  async logout(
    rawRefreshToken?: string,
    actor?: { id?: string; fullName?: string },
    meta?: { ipAddress?: string; userAgent?: string; bearerToken?: string },
  ) {
    let userId = actor?.id;
    let userName = actor?.fullName;

    if (rawRefreshToken) {
      try {
        const decoded = await this.jwtService.verifyAsync<{ sub: string; jti: string }>(rawRefreshToken, {
          secret: this.config.getOrThrow<string>('jwtRefreshSecret'),
        });
        await this.authRepository.revokeRefreshToken(decoded.jti);
        if (!userId && decoded?.sub) {
          userId = decoded.sub;
        }
      } catch {
        // Ignore expired/invalid refresh token on logout
      }
    }

    if (!userId && meta?.bearerToken) {
      try {
        const decoded = this.jwtService.decode(meta.bearerToken) as { sub?: string };
        if (decoded?.sub) {
          userId = decoded.sub;
        }
      } catch {
        // ignore invalid token decode
      }
    }

    if (userId && !userName) {
      const user = await this.usersRepository.findByIdWithRole(userId);
      if (user) {
        userName = user.fullName;
      }
    }

    if (userId) {
      await this.audit.record({
        actorUserId: userId,
        actorName: userName || 'مستخدم',
        action: 'LOGOUT',
        entityType: 'AUTH',
        entityId: userId,
        ipAddress: meta?.ipAddress,
      });
    }
  }

  async getMe(userId: string) {
    const user = await this.usersRepository.findByIdWithRole(userId);
    if (!user) {
      throw new UnauthorizedException('المستخدم غير موجود');
    }
    const permissions = await this.usersService.getEffectivePermissions(
      user.id,
      user.roleId,
      user.roleCode,
    );
    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      roleCode: user.roleCode,
      roleNameAr: user.roleNameAr,
      permissions,
    };
  }

  private async issueTokens(
    userId: string,
    email: string,
    roleCode: string,
    meta: { ipAddress?: string; userAgent?: string },
  ) {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email, roleCode },
      {
        secret: this.config.getOrThrow<string>('jwtAccessSecret'),
        expiresIn: this.config.getOrThrow<string>('jwtAccessExpiresIn') as any,
      },
    );

    const refreshDays = this.config.getOrThrow<number>('jwtRefreshExpiresInDays');
    const expiresAt = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);
    const tokenId = randomUUID();

    const refreshToken = await this.jwtService.signAsync(
      { sub: userId, jti: tokenId },
      {
        secret: this.config.getOrThrow<string>('jwtRefreshSecret'),
        expiresIn: `${refreshDays}d` as any,
      },
    );

    const tokenHash = await argon2.hash(refreshToken);
    await this.authRepository.createRefreshToken({
      id: tokenId,
      userId,
      tokenHash,
      expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return { accessToken, refreshToken };
  }
}
