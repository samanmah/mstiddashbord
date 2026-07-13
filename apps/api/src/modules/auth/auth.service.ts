import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type AuthUser,
  AuditAction,
  ErrorCode,
  normalizeUsername,
  type UserRole,
} from '@ppm/contracts';
import { type User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../../common/services/password.service';
import { type AppConfig } from '../../config/configuration';
import { AuditService, type AuditContext } from '../audit/audit.service';
import { TokenService } from './token.service';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

export interface LoginResult {
  user: AuthUser;
  tokens: IssuedTokens;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly configService: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private get config(): AppConfig {
    return this.configService.get<AppConfig>('app')!;
  }

  private invalidCredentials(): never {
    throw new UnauthorizedException({
      code: ErrorCode.INVALID_CREDENTIALS,
      message: 'نام کاربری یا رمز عبور نادرست است.',
    });
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role as UserRole,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    };
  }

  async login(
    username: string,
    password: string,
    rememberMe: boolean,
    ctx: AuditContext,
  ): Promise<LoginResult & { rememberMe: boolean }> {
    const normalized = normalizeUsername(username);
    const user = await this.prisma.user.findUnique({
      where: { normalizedUsername: normalized },
    });

    // جلوگیری از User Enumeration: پیام یکسان برای همه حالت‌های شکست.
    if (!user) {
      // یک verify ساختگی برای هم‌سطح‌سازی زمان پاسخ.
      await this.passwords.verify(
        '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$3g2Z1Q9Zq0v0m0k0a0b0c0d0e0f0g0h0i0j0k0l0m0',
        password,
      );
      await this.audit.record({
        ...ctx,
        userId: null,
        entityType: 'Auth',
        action: AuditAction.LOGIN_FAILED,
        newValue: { username: normalized, reason: 'USER_NOT_FOUND' },
      });
      this.invalidCredentials();
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenException({
        code: ErrorCode.ACCOUNT_LOCKED,
        message: `حساب کاربری به‌دلیل تلاش‌های ناموفق موقتاً قفل شده است. لطفاً بعداً تلاش کنید.`,
      });
    }

    const valid = user.isActive && (await this.passwords.verify(user.passwordHash, password));

    if (!valid) {
      await this.registerFailedAttempt(user, ctx);
      this.invalidCredentials();
    }

    // ورود موفق: بازنشانی شمارنده و به‌روزرسانی زمان ورود.
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const tokens = await this.issueTokens(updated, ctx);

    await this.audit.record({
      ...ctx,
      userId: user.id,
      entityType: 'Auth',
      entityId: user.id,
      action: AuditAction.LOGIN,
    });

    return { user: this.toAuthUser(updated), tokens, rememberMe };
  }

  private async registerFailedAttempt(user: User, ctx: AuditContext): Promise<void> {
    const attempts = user.failedLoginCount + 1;
    const shouldLock = attempts >= this.config.login.maxAttempts;
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: shouldLock ? 0 : attempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + this.config.login.lockMinutes * 60 * 1000)
          : user.lockedUntil,
      },
    });
    await this.audit.record({
      ...ctx,
      userId: user.id,
      entityType: 'Auth',
      entityId: user.id,
      action: AuditAction.LOGIN_FAILED,
      newValue: { attempts, locked: shouldLock },
    });
  }

  private async issueTokens(user: User, ctx: AuditContext): Promise<IssuedTokens> {
    const jti = this.tokens.newTokenId();
    const accessToken = await this.tokens.signAccessToken({
      sub: user.id,
      username: user.username,
      role: user.role as UserRole,
    });
    const refreshToken = await this.tokens.signRefreshToken({ sub: user.id, jti });
    const csrfToken = this.tokens.generateCsrfToken();

    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId: user.id,
        tokenHash: this.tokens.hashRefreshToken(refreshToken),
        expiresAt: this.tokens.refreshExpiryDate(),
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
      },
    });

    return { accessToken, refreshToken, csrfToken };
  }

  async refresh(
    refreshTokenRaw: string | undefined,
    ctx: AuditContext,
  ): Promise<LoginResult> {
    if (!refreshTokenRaw) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'نشست منقضی شده است. لطفاً دوباره وارد شوید.',
      });
    }

    let payload;
    try {
      payload = await this.tokens.verifyRefreshToken(refreshTokenRaw);
    } catch {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'نشست منقضی شده است. لطفاً دوباره وارد شوید.',
      });
    }

    const tokenHash = this.tokens.hashRefreshToken(refreshTokenRaw);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    // تشخیص استفاده مجدد از توکن باطل‌شده → ابطال همه توکن‌های کاربر.
    if (!stored || stored.tokenHash !== tokenHash) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'نشست نامعتبر است. لطفاً دوباره وارد شوید.',
      });
    }

    if (stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'نشست منقضی شده است. لطفاً دوباره وارد شوید.',
      });
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'حساب کاربری غیرفعال است.',
      });
    }

    // چرخش توکن: ابطال قدیمی و صدور جدید.
    const newTokens = await this.issueTokens(user, ctx);
    const newHashPayload = await this.tokens.verifyRefreshToken(newTokens.refreshToken);
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date(), replacedByTokenId: newHashPayload.jti },
    });

    return { user: this.toAuthUser(user), tokens: newTokens };
  }

  async logout(refreshTokenRaw: string | undefined, ctx: AuditContext): Promise<void> {
    if (!refreshTokenRaw) return;
    try {
      const payload = await this.tokens.verifyRefreshToken(refreshTokenRaw);
      const stored = await this.prisma.refreshToken.findUnique({
        where: { id: payload.jti },
      });
      if (stored && !stored.revokedAt) {
        await this.prisma.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() },
        });
      }
      await this.audit.record({
        ...ctx,
        userId: payload.sub,
        entityType: 'Auth',
        entityId: payload.sub,
        action: AuditAction.LOGOUT,
      });
    } catch {
      // توکن نامعتبر — خروج بی‌صدا.
    }
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'نشست معتبر نیست.',
      });
    }
    return this.toAuthUser(user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ctx: AuditContext,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException({
        code: ErrorCode.UNAUTHORIZED,
        message: 'نشست معتبر نیست.',
      });
    }
    const valid = await this.passwords.verify(user.passwordHash, currentPassword);
    if (!valid) {
      throw new UnauthorizedException({
        code: ErrorCode.INVALID_CREDENTIALS,
        message: 'رمز فعلی نادرست است.',
      });
    }
    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
    // ابطال همه نشست‌های دیگر پس از تغییر رمز.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      ...ctx,
      userId,
      entityType: 'User',
      entityId: userId,
      action: AuditAction.PASSWORD_CHANGE,
    });
  }
}
