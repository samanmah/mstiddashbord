'use client';

import { UserRole } from '@ppm/contracts';
import {
  ClipboardList,
  FolderKanban,
  History,
  LayoutDashboard,
  Upload,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/admin', label: 'خانهٔ مدیریت', icon: LayoutDashboard, exact: true },
  { href: '/admin/projects', label: 'پروژه‌ها', icon: FolderKanban, exact: false },
  { href: '/admin/import', label: 'ورود از Excel', icon: Upload, exact: true },
  { href: '/admin/users', label: 'کاربران', icon: Users, exact: true },
  { href: '/admin/audit-log', label: 'تاریخچهٔ تغییرات', icon: History, exact: true },
];

export default function AdminLayout({ children }: { children: ReactNode }): React.JSX.Element {
  const pathname = usePathname();

  return (
    <AuthGuard requireRole={UserRole.PROJECT_EDITOR}>
      <div data-testid="admin-shell" className="flex min-h-screen bg-page">
        <aside
          data-testid="admin-nav"
          className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-l border-borderx bg-navy-900 text-white md:flex"
        >
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-4">
            <ClipboardList className="h-6 w-6 text-brand-yellow" aria-hidden />
            <div>
              <p className="text-sm font-bold">پنل مدیریت</p>
              <p className="text-[10px] text-white/60">سامانهٔ پایش پروژه</p>
            </div>
          </div>
          <nav className="flex-1 space-y-1 p-3">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                    active ? 'bg-white/15 font-bold text-brand-yellow' : 'text-white/80 hover:bg-white/10',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-white/10 p-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden />
              بازگشت به داشبورد
            </Link>
          </div>
        </aside>

        <div className="flex-1">
          {/* نوار موبایل */}
          <div className="no-print sticky top-0 z-20 flex items-center gap-2 overflow-x-auto border-b border-borderx bg-navy-900 px-3 py-2 text-white md:hidden">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-md px-3 py-1.5 text-xs hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <main className="p-4 md:p-6">{children}</main>
        </div>
      </div>
    </AuthGuard>
  );
}
