import { UserRole, type AuthUser } from '@ppm/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authService } from '@/lib/services';
import { useAuth } from './use-auth';

vi.mock('@/lib/services', () => ({
  authService: {
    me: vi.fn(),
  },
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('useAuth', () => {
  beforeEach(() => {
    vi.mocked(authService.me).mockReset();
  });

  it('sets isEditor true when role is PROJECT_EDITOR', async () => {
    const user: AuthUser = {
      id: 'user-1',
      username: 'editor',
      fullName: 'ویرایشگر',
      role: UserRole.PROJECT_EDITOR,
      lastLoginAt: null,
    };
    vi.mocked(authService.me).mockResolvedValue(user);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.user?.role).toBe(UserRole.PROJECT_EDITOR);
    expect(result.current.isEditor).toBe(true);
  });

  it('sets isEditor false when role is MANAGER_VIEWER', async () => {
    const user: AuthUser = {
      id: 'user-2',
      username: 'viewer',
      fullName: 'مشاهده‌گر',
      role: UserRole.MANAGER_VIEWER,
      lastLoginAt: null,
    };
    vi.mocked(authService.me).mockResolvedValue(user);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isEditor).toBe(false);
  });
});
