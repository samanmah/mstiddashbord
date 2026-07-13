'use client';

import type { AuthUser } from '@ppm/contracts';
import { UserRole } from '@ppm/contracts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { isApiError } from '@/lib/api-error';
import { authService } from '@/lib/services';

export const AUTH_QUERY_KEY = ['auth', 'me'] as const;

export interface UseAuthResult {
  user: AuthUser | null;
  isLoading: boolean;
  isError: boolean;
  isEditor: boolean;
  refetch: () => Promise<unknown>;
  clear: () => void;
}

export function useAuth(): UseAuthResult {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: async () => {
      try {
        return await authService.me();
      } catch (error) {
        if (isApiError(error) && error.isUnauthorized) {
          return null;
        }
        throw error;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  const clear = useCallback(() => {
    queryClient.setQueryData(AUTH_QUERY_KEY, null);
    queryClient.clear();
  }, [queryClient]);

  const user = query.data ?? null;

  return {
    user,
    isLoading: query.isLoading,
    isError: query.isError,
    isEditor: user?.role === UserRole.PROJECT_EDITOR,
    refetch: query.refetch,
    clear,
  };
}
