import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type UserRole } from '@ppm/contracts';

export interface RequestUser {
  id: string;
  username: string;
  role: UserRole;
}

export const CurrentUser = createParamDecorator(
  (data: keyof RequestUser | undefined, ctx: ExecutionContext): RequestUser | string => {
    const request = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
    const user = request.user;
    return data ? user[data] : user;
  },
);
