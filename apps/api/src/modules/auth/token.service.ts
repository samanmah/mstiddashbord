import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { type UserRole } from '@ppm/contracts';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { type AppConfig } from '../../config/configuration';

export interface AccessTokenPayload {
  sub: string;
  username: string;
  role: UserRole;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private get config(): AppConfig {
    return this.configService.get<AppConfig>('app')!;
  }

  async signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.jwt.accessSecret,
      expiresIn: this.config.jwt.accessTtl,
    });
  }

  async signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      secret: this.config.jwt.refreshSecret,
      expiresIn: this.config.jwt.refreshTtl,
    });
  }

  async verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    return this.jwt.verifyAsync<RefreshTokenPayload>(token, {
      secret: this.config.jwt.refreshSecret,
    });
  }

  /** شناسه یکتا برای refresh token (jti). */
  newTokenId(): string {
    return randomUUID();
  }

  /** توکن CSRF تصادفی. */
  generateCsrfToken(): string {
    return randomBytes(24).toString('hex');
  }

  /** Hash کردن refresh token خام برای ذخیره در دیتابیس (SHA-256). */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  refreshExpiryDate(): Date {
    return new Date(Date.now() + this.config.jwt.refreshTtl * 1000);
  }
}
