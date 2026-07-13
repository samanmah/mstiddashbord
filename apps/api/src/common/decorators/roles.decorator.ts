import { SetMetadata } from '@nestjs/common';
import { type UserRole } from '@ppm/contracts';

export const ROLES_KEY = 'roles';

/** نقش‌های مجاز برای دسترسی به یک مسیر. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
