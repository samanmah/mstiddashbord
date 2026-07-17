import { UserRole, type AuthUser } from '@ppm/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from './api-client';
import { authService } from './services';

vi.mock('./api-client', () => ({
  apiRequest: vi.fn(),
}));

describe('authService.me', () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it('unwraps AuthUser from { user: AuthUser } response', async () => {
    const user: AuthUser = {
      id: 'user-1',
      username: 'editor',
      fullName: 'ویرایشگر',
      role: UserRole.PROJECT_EDITOR,
      lastLoginAt: null,
    };
    vi.mocked(apiRequest).mockResolvedValue({ user });

    const result = await authService.me();

    expect(apiRequest).toHaveBeenCalledWith('/auth/me');
    expect(result).toEqual(user);
    expect(result.role).toBe(UserRole.PROJECT_EDITOR);
    expect(result).not.toHaveProperty('user');
  });
});
