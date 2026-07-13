import { type CookieOptions, type Response } from 'express';
import { type AppConfig } from '../../config/configuration';
import { CSRF_COOKIE_NAME } from '../../common/guards/csrf.guard';

export const ACCESS_COOKIE_NAME = 'access_token';
export const REFRESH_COOKIE_NAME = 'refresh_token';

function baseOptions(config: AppConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    domain: config.cookie.domain,
    path: '/',
  };
}

export function setAuthCookies(
  res: Response,
  config: AppConfig,
  tokens: { accessToken: string; refreshToken: string; csrfToken: string },
  rememberMe: boolean,
): void {
  const accessMaxAge = config.jwt.accessTtl * 1000;
  const refreshMaxAge = config.jwt.refreshTtl * 1000;

  res.cookie(ACCESS_COOKIE_NAME, tokens.accessToken, {
    ...baseOptions(config),
    maxAge: accessMaxAge,
  });

  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
    ...baseOptions(config),
    path: '/api/v1/auth',
    // اگر «مرا به خاطر بسپار» غیرفعال باشد، refresh به‌صورت Session cookie نگهداری می‌شود.
    maxAge: rememberMe ? refreshMaxAge : undefined,
  });

  // توکن CSRF باید توسط جاوااسکریپت قابل خواندن باشد (HttpOnly نیست).
  res.cookie(CSRF_COOKIE_NAME, tokens.csrfToken, {
    httpOnly: false,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    domain: config.cookie.domain,
    path: '/',
    maxAge: rememberMe ? refreshMaxAge : undefined,
  });
}

export function clearAuthCookies(res: Response, config: AppConfig): void {
  const opts = baseOptions(config);
  res.clearCookie(ACCESS_COOKIE_NAME, opts);
  res.clearCookie(REFRESH_COOKIE_NAME, { ...opts, path: '/api/v1/auth' });
  res.clearCookie(CSRF_COOKIE_NAME, { ...opts, httpOnly: false });
}
