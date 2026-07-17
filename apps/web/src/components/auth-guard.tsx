'use client';

import { UserRole } from '@ppm/contracts';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { FullPageSpinner } from '@/components/ui/spinner';
import { useAuth } from '@/hooks/use-auth';

export interface AuthGuardProps {
  children: ReactNode;
  /** نقش موردنیاز؛ اگر تعیین نشود هر کاربر واردشده مجاز است. */
  requireRole?: UserRole;
}

export function AuthGuard({ children, requireRole }: AuthGuardProps): React.JSX.Element {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      const redirect = encodeURIComponent(pathname || '/dashboard');
      router.replace(`/login?redirect=${redirect}`);
    }
  }, [isLoading, user, router, pathname]);

  if (isLoading) {
    return <FullPageSpinner label="در حال بارگذاری…" />;
  }

  if (!user) {
    return <FullPageSpinner label="در حال انتقال به صفحهٔ ورود…" />;
  }

  if (requireRole && user.role !== requireRole) {
    // فقط ویرایشگر پروژه به بخش مدیریت دسترسی دارد
    if (requireRole === UserRole.PROJECT_EDITOR) {
      return <ForbiddenNotice />;
    }
  }

  return <>{children}</>;
}

function ForbiddenNotice(): React.JSX.Element {
  const router = useRouter();
  return (
    <div
      data-testid="forbidden-notice"
      className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <p className="text-2xl font-bold text-navy-900">۴۰۳ — دسترسی مجاز نیست</p>
      <p className="text-sm text-grayx-header">
        شما مجوز لازم برای مشاهدهٔ این بخش را ندارید.
      </p>
      <button className="btn btn-primary" onClick={() => router.replace('/dashboard')}>
        بازگشت به داشبورد
      </button>
    </div>
  );
}
