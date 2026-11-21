import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UsersRepository } from '../users/users.repository';
import { UsersService } from '../users/users.service';

interface JwtPayload {
  sub: string;
  email: string;
  roleCode: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly usersRepository: UsersRepository,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwtAccessSecret'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const byId = await this.usersRepository.findByIdWithRole(payload.sub);
    const user =
      byId ??
      (payload.email ? await this.usersRepository.findByEmailWithRole(payload.email) : null);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('الحساب غير نشط أو غير مصرح له');
    }
    const permissions = await this.usersService.getEffectivePermissions(
      user.id,
      user.roleId,
      user.roleCode,
    );
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roleCode: user.roleCode,
      permissions,
    };
  }
}

