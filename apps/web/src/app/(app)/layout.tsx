'use client';

import type { ReactNode } from 'react';
import { AuthGuard } from '@/components/auth-guard';

export default function AppLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return <AuthGuard>{children}</AuthGuard>;
}
