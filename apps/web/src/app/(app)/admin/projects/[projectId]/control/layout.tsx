'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, ClipboardCheck, Upload } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FullPageSpinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/states';
import { EnableControlPanel } from '@/features/project-control/components/editor/enable-control-panel';
import { useControlPlan } from '@/features/project-control/hooks/use-control-plan';
import { useBaselines } from '@/features/project-control/hooks/use-control-baselines';
import { useDataQuality } from '@/features/project-control/hooks/use-control-dashboard';
import {
  dataQualityIssueCount,
  dataQualityTone,
} from '@/features/project-control/utils/control-status';
import { jalaliFa } from '@/features/project-control/utils/date-format';
import { formatCount } from '@/features/project-control/utils/progress-format';
import { useAuth } from '@/hooks/use-auth';
import { queryKeys } from '@/lib/query-keys';
import { projectService } from '@/lib/services';
import { cn } from '@/lib/utils';
import { faNumber } from '@/lib/utils';

const TABS = [
  { slug: 'overview', label: 'نمای کلی' },
  { slug: 'wbs', label: 'ساختار شکست کار' },
  { slug: 'gantt', label: 'گانت' },
  { slug: 'progress', label: 'پیشرفت' },
  { slug: 'dependencies', label: 'روابط' },
  { slug: 'baselines', label: 'خط مبنا' },
  { slug: 'imports', label: 'ورود اطلاعات' },
  { slug: 'data-quality', label: 'کیفیت داده' },
];

export default function ControlLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { projectId: string };
}): React.JSX.Element {
  const { projectId } = params;
  const pathname = usePathname();
  const { isEditor } = useAuth();

  const { data: project } = useQuery({
    queryKey: queryKeys.project(projectId),
    queryFn: () => projectService.get(projectId),
  });
  const planQuery = useControlPlan(projectId);
  const enabled = Boolean(planQuery.data);
  const dataQuality = useDataQuality(projectId, enabled);
  const baselines = useBaselines(projectId, enabled);

  if (planQuery.isLoading) return <FullPageSpinner label="در حال بارگذاری کنترل پروژه…" />;
  if (planQuery.isError) {
    return <ErrorState error={planQuery.error} onRetry={() => void planQuery.refetch()} />;
  }

  if (!enabled) {
    return (
      <EnableControlPanel
        projectId={projectId}
        projectTitle={project?.titleFa ?? 'این پروژه'}
        canEnable={isEditor}
      />
    );
  }

  const plan = planQuery.data!;
  const activeBaseline = baselines.data?.find((b) => b.isActive) ?? null;
  const dqCount = dataQualityIssueCount(dataQuality.data);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-navy-900">کنترل پروژهٔ پیشرفته</h2>
              <StatusBadge tone="green" label="فعال" />
            </div>
            <p className="mt-1 truncate text-sm text-grayx-header">{project?.titleFa}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-grayx-header">
              <span>
                تاریخ وضعیت: <span className="font-medium text-ink">{jalaliFa(plan.statusDate)}</span>
              </span>
              <span>
                خط مبنای فعال:{' '}
                <span className="font-medium text-ink">
                  {activeBaseline
                    ? `${activeBaseline.title} (#${faNumber(activeBaseline.baselineNumber)})`
                    : '—'}
                </span>
              </span>
              <span>
                نسخه: <span className="font-medium text-ink">{faNumber(plan.version)}</span>
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              tone={dataQualityTone(dqCount)}
              label={`کیفیت داده: ${dqCount === 0 ? 'بدون مسئله' : `${formatCount(dqCount)} مورد`}`}
            />
            <Link href={`/dashboard/projects/${projectId}`}>
              <Button variant="secondary" size="sm">
                <BarChart3 className="h-4 w-4" /> داشبورد
              </Button>
            </Link>
            {isEditor ? (
              <>
                <Link href={`/admin/projects/${projectId}/control/progress`}>
                  <Button variant="secondary" size="sm">
                    <ClipboardCheck className="h-4 w-4" /> ثبت پیشرفت
                  </Button>
                </Link>
                <Link href={`/admin/projects/${projectId}/control/imports`}>
                  <Button size="sm">
                    <Upload className="h-4 w-4" /> ورود اطلاعات
                  </Button>
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <nav className="sticky top-0 z-10 -mx-1 overflow-x-auto border-b border-borderx bg-page/95 px-1 backdrop-blur">
        <div className="flex min-w-max gap-1">
          {TABS.map((tab) => {
            const href = `/admin/projects/${projectId}/control/${tab.slug}`;
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={tab.slug}
                href={href}
                className={cn(
                  '-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm transition-colors',
                  active
                    ? 'border-navy-800 font-bold text-navy-900'
                    : 'border-transparent text-grayx-header hover:text-ink',
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div>{children}</div>
    </div>
  );
}
