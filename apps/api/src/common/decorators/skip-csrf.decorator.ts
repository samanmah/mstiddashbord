import { SetMetadata } from '@nestjs/common';

export const SKIP_CSRF_KEY = 'skipCsrf';

/** مسیرهایی که از بررسی CSRF معاف هستند (مثل ورود که خودش توکن CSRF را صادر می‌کند). */
export const SkipCsrf = () => SetMetadata(SKIP_CSRF_KEY, true);
