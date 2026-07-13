import {
  CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ErrorCode } from '@ppm/contracts';
import { type Request } from 'express';
import { SKIP_CSRF_KEY } from '../decorators/skip-csrf.decorator';

export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * محافظت CSRF با الگوی Double-Submit Cookie.
 * برای درخواست‌های تغییردهنده، مقدار کوکی `csrf_token` باید با هدر `X-CSRF-Token` برابر باشد.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const cookieToken = (request.cookies as Record<string, string> | undefined)?.[
      CSRF_COOKIE_NAME
    ];
    const headerToken = request.headers[CSRF_HEADER_NAME];

    if (
      !cookieToken ||
      !headerToken ||
      typeof headerToken !== 'string' ||
      cookieToken !== headerToken
    ) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'توکن امنیتی نامعتبر است. لطفاً صفحه را تازه‌سازی کنید.',
      });
    }
    return true;
  }
}
