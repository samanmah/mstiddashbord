'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

const TABS = [
  { slug: 'general', label: 'اطلاعات عمومی' },
  { slug: 'indicators', label: 'شاخص‌ها' },
  { slug: 'monthly-progress', label: 'پیشرفت ماهانه' },
  { slug: 'activities', label: 'فعالیت‌ها' },
  { slug: 'risks', label: 'ریسک‌ها' },
  { slug: 'decisions', label: 'تصمیمات' },
];

export function ProjectTabs({ projectId }: { projectId: string }): React.JSX.Element {
  const pathname = usePathname();
  const { isEditor } = useAuth();
  return (
    <nav className="mb-5 flex flex-wrap gap-1 border-b border-borderx">
      {TABS.map((tab) => {
        const href = `/admin/projects/${projectId}/${tab.slug}`;
        const active = pathname === href;
        return (
          <Link
            key={tab.slug}
            href={href}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
              active
                ? 'border-navy-800 font-bold text-navy-900'
                : 'border-transparent text-grayx-header hover:text-ink',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
      {isEditor ? (
        <Link
          href={`/admin/projects/${projectId}/control`}
          className={cn(
            '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
            pathname.startsWith(`/admin/projects/${projectId}/control`)
              ? 'border-navy-800 font-bold text-navy-900'
              : 'border-transparent text-brand-blue hover:text-navy-900',
          )}
        >
          کنترل پروژه پیشرفته
        </Link>
      ) : null}
    </nav>
  );
}
