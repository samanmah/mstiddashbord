import { ForbiddenException } from '@nestjs/common';
import { type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@ppm/contracts';
import { RolesGuard } from './roles.guard';

function makeContext(user: { role: UserRole } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows access when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(makeContext({ role: UserRole.MANAGER_VIEWER }))).toBe(true);
  });

  it('allows PROJECT_EDITOR to access editor-only route', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.PROJECT_EDITOR]);
    expect(guard.canActivate(makeContext({ role: UserRole.PROJECT_EDITOR }))).toBe(true);
  });

  it('blocks MANAGER_VIEWER from an editor-only route', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.PROJECT_EDITOR]);
    expect(() =>
      guard.canActivate(makeContext({ role: UserRole.MANAGER_VIEWER })),
    ).toThrow(ForbiddenException);
  });

  it('blocks unauthenticated requests from a protected route', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.PROJECT_EDITOR]);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
