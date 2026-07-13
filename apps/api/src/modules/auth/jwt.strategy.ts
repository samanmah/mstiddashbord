import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ErrorCode, type UserRole } from '@ppm/contracts';
import { type Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { type AppConfig } from '../../config/configuration';
import { type RequestUser } from '../../common/decorators/current-user.decorator';
import { ACCESS_COOKIE_NAME } from './cookies';

interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
}

function cookieExtractor(req: Request): string | null {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[ACCESS_COOKIE_NAME] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const config = configService.get<AppConfig>('app')!;
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: config.jwt.accessSecret,
    });
  }

  validate(payload: JwtPayload): RequestUser {
    if (!payload?.sub) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'نشست معتبر نیست.',
      });
    }
    return { id: payload.sub, username: payload.username, role: payload.role };
  }
}
