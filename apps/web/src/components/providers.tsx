'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { isApiError } from '@/lib/api-error';

export function Providers({ children }: { children: ReactNode }): React.JSX.Element {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // خطاهای احراز هویت/مجوز نباید Retry شوند
              if (isApiError(error) && [401, 403, 404, 409].includes(error.statusCode)) {
                return false;
              }
              return failureCount < 2;
            },
          },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="top-center"
        dir="rtl"
        richColors
        toastOptions={{ style: { fontFamily: 'inherit' } }}
      />
    </QueryClientProvider>
  );
}
